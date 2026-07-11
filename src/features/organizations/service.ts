import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import {
  canChangeRole,
  canRemoveMember,
  invitationExpiry,
  isInvitationActionable,
  normalizeBusinessId,
  ownerCount as countOwners,
} from "./rules";
import type { OrgRole } from "./types";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "./validation";

/**
 * Datová vrstva organizací (T009). Jediné místo, které sahá na `db.organization`,
 * `db.organizationMember` a `db.organizationInvitation`. Invarianty firmy
 * (min. 1 owner, jedinečnost členství, expirace pozvánky) se vynucují tady na
 * serveru — často v transakci, aby souběh nerozbil „poslední owner". Oprávnění
 * (kdo smí akci provést) řeší `actions.ts` přes permission vrstvu.
 */

const detailInclude = {
  members: {
    include: { user: { select: { id: true, email: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  },
  invitations: {
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.OrganizationInclude;

export type OrganizationDetail = Prisma.OrganizationGetPayload<{
  include: typeof detailInclude;
}>;

/** Položka výpisu firem uživatele: firma, role uživatele a počet členů. */
export type OrganizationListItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  status: "active" | "archived";
  role: OrgRole;
  memberCount: number;
};

// --- Čtení ------------------------------------------------------------------

/** Firma podle ID (bez členů). */
export function getOrganizationById(orgId: string) {
  return db.organization.findUnique({ where: { id: orgId } });
}

/** Firma se členy a pozvánkami, nebo `null`. */
export function getOrganizationDetail(
  orgId: string,
): Promise<OrganizationDetail | null> {
  return db.organization.findUnique({
    where: { id: orgId },
    include: detailInclude,
  });
}

/** Role uživatele ve firmě, nebo `null` (není člen). */
export async function getMembershipRole(
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  const member = await db.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

/** Firmy, jichž je uživatel členem, s jeho rolí a počtem členů. */
export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationListItem[]> {
  const memberships = await db.organizationMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      org: {
        include: { _count: { select: { members: true } } },
      },
    },
  });
  return memberships.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    logoUrl: m.org.logoUrl,
    status: m.org.status,
    role: m.role,
    memberCount: m.org._count.members,
  }));
}

// --- Založení a editace -----------------------------------------------------

export type CreateResult = {
  org: { id: string; name: string };
  /** Existuje jiná firma se stejným IČO? (warning, ne blok — T009 § Edge cases). */
  duplicateBusinessId: boolean;
};

/**
 * Založí firmu a zakladatele nastaví jako ownera (atomicky). Vrátí i příznak
 * duplicitního IČO — zakládání ale neblokuje (jen warning).
 */
export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
): Promise<CreateResult> {
  const businessId = input.businessId ?? null;
  const duplicateBusinessId = await hasDuplicateBusinessId(businessId, null);

  const org = await db.organization.create({
    data: {
      name: input.name,
      businessId,
      members: { create: { userId, role: "owner" } },
    },
    select: { id: true, name: true },
  });

  return { org, duplicateBusinessId };
}

/** Existuje jiná (než `exceptOrgId`) firma se stejným normalizovaným IČO? */
async function hasDuplicateBusinessId(
  businessId: string | null,
  exceptOrgId: string | null,
): Promise<boolean> {
  const normalized = normalizeBusinessId(businessId);
  if (!normalized) return false;
  const candidates = await db.organization.findMany({
    where: {
      businessId: { not: null },
      ...(exceptOrgId ? { id: { not: exceptOrgId } } : {}),
    },
    select: { businessId: true },
  });
  return candidates.some(
    (c) => normalizeBusinessId(c.businessId) === normalized,
  );
}

/** Uloží firemní profil. Vrátí příznak duplicitního IČO (warning). */
export async function updateOrganizationProfile(
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<{ duplicateBusinessId: boolean }> {
  const businessId = input.businessId ?? null;
  const duplicateBusinessId = await hasDuplicateBusinessId(businessId, orgId);

  await db.organization.update({
    where: { id: orgId },
    data: {
      name: input.name,
      logoUrl: input.logoUrl ?? null,
      description: input.description ?? null,
      businessId,
      location: input.location ?? null,
      serviceAreas: input.serviceAreas,
      specializations: input.specializations,
    },
  });
  return { duplicateBusinessId };
}

/** Nastaví stav firmy (active/archived). */
export async function setOrganizationStatus(
  orgId: string,
  status: "active" | "archived",
): Promise<void> {
  await db.organization.update({ where: { id: orgId }, data: { status } });
}

// --- Členové ----------------------------------------------------------------

export type MemberChangeResult =
  { ok: true } | { ok: false; error: "last_owner" | "not_member" };

/**
 * Změní roli člena. Chrání invariant „min. 1 owner" (degradaci posledního
 * ownera odmítne) v transakci, aby souběh dvou změn nezrušil posledního ownera.
 */
export async function changeMemberRole(
  orgId: string,
  userId: string,
  newRole: OrgRole,
): Promise<MemberChangeResult> {
  return db.$transaction(async (tx) => {
    const members = await tx.organizationMember.findMany({
      where: { orgId },
      select: { userId: true, role: true },
    });
    const target = members.find((m) => m.userId === userId);
    if (!target) return { ok: false, error: "not_member" as const };
    if (target.role === newRole) return { ok: true as const };

    if (
      !canChangeRole({
        currentRole: target.role,
        newRole,
        ownerCount: countOwners(members.map((m) => m.role)),
      })
    ) {
      return { ok: false, error: "last_owner" as const };
    }

    await tx.organizationMember.update({
      where: { orgId_userId: { orgId, userId } },
      data: { role: newRole },
    });
    return { ok: true as const };
  });
}

/**
 * Odebere člena. Chrání invariant „min. 1 owner" (posledního ownera nelze
 * odebrat) v transakci. Používá se i pro odchod člena (self-removal).
 */
export async function removeMember(
  orgId: string,
  userId: string,
): Promise<MemberChangeResult> {
  return db.$transaction(async (tx) => {
    const members = await tx.organizationMember.findMany({
      where: { orgId },
      select: { userId: true, role: true },
    });
    const target = members.find((m) => m.userId === userId);
    if (!target) return { ok: false, error: "not_member" as const };

    if (
      !canRemoveMember({
        targetRole: target.role,
        ownerCount: countOwners(members.map((m) => m.role)),
      })
    ) {
      return { ok: false, error: "last_owner" as const };
    }

    await tx.organizationMember.delete({
      where: { orgId_userId: { orgId, userId } },
    });
    return { ok: true as const };
  });
}

// --- Pozvánky ---------------------------------------------------------------

export type InviteResult =
  { ok: true } | { ok: false; error: "already_member" };

/**
 * Vytvoří pozvánku (uloží jen hash tokenu). Pokud je e-mail už členem, vrátí
 * chybu. Případné dřívější `pending` pozvánky na stejný e-mail zneplatní
 * (nahradí novou), ať neexistuje víc platných tokenů najednou.
 */
export async function inviteMember(
  orgId: string,
  email: string,
  role: OrgRole,
  tokenHash: string,
  invitedByUserId: string,
): Promise<InviteResult> {
  const normalized = normalizeEmail(email);

  // Je vlastník e-mailu už členem? (pozvánka je na e-mail, členství na userId).
  const existingUser = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existingUser) {
    const membership = await db.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: existingUser.id } },
      select: { orgId: true },
    });
    if (membership) return { ok: false, error: "already_member" };
  }

  await db.$transaction(async (tx) => {
    await tx.organizationInvitation.updateMany({
      where: { orgId, email: normalized, status: "pending" },
      data: { status: "expired" },
    });
    await tx.organizationInvitation.create({
      data: {
        orgId,
        email: normalized,
        role,
        tokenHash,
        invitedByUserId,
        expiresAt: invitationExpiry(),
      },
    });
  });
  return { ok: true };
}

/** Pozvánka podle tokenu (i s firmou), nebo `null`. */
export function getInvitationByTokenHash(tokenHash: string) {
  return db.organizationInvitation.findUnique({
    where: { tokenHash },
    include: { org: { select: { id: true, name: true, status: true } } },
  });
}

export type AcceptResult =
  | { ok: true; orgId: string; alreadyMember: boolean }
  | { ok: false; error: "not_found" | "not_actionable" | "email_mismatch" };

/**
 * Přijme pozvánku: ověří, že je aktivní (pending, nevypršelá) a že e-mail
 * odpovídá přihlášenému účtu, pak založí členství s rolí z pozvánky. Idempotentní
 * vůči opakování — už existující členství nepřepíše (nedegraduje roli).
 */
export async function acceptInvitation(
  tokenHash: string,
  userId: string,
  userEmail: string,
): Promise<AcceptResult> {
  const invitation = await getInvitationByTokenHash(tokenHash);
  if (!invitation) return { ok: false, error: "not_found" };
  if (!isInvitationActionable(invitation)) {
    return { ok: false, error: "not_actionable" };
  }
  if (normalizeEmail(invitation.email) !== normalizeEmail(userEmail)) {
    return { ok: false, error: "email_mismatch" };
  }

  const alreadyMember =
    (await db.organizationMember.findUnique({
      where: { orgId_userId: { orgId: invitation.orgId, userId } },
      select: { orgId: true },
    })) !== null;

  await db.$transaction(async (tx) => {
    if (!alreadyMember) {
      await tx.organizationMember.create({
        data: { orgId: invitation.orgId, userId, role: invitation.role },
      });
    }
    await tx.organizationInvitation.update({
      where: { tokenHash },
      data: { status: "accepted", respondedAt: new Date() },
    });
  });

  return { ok: true, orgId: invitation.orgId, alreadyMember };
}

export type DeclineResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "not_actionable" | "email_mismatch" };

/** Odmítne pozvánku (pending → declined). Ověří shodu e-mailu s účtem. */
export async function declineInvitation(
  tokenHash: string,
  userEmail: string,
): Promise<DeclineResult> {
  const invitation = await getInvitationByTokenHash(tokenHash);
  if (!invitation) return { ok: false, error: "not_found" };
  if (!isInvitationActionable(invitation)) {
    return { ok: false, error: "not_actionable" };
  }
  if (normalizeEmail(invitation.email) !== normalizeEmail(userEmail)) {
    return { ok: false, error: "email_mismatch" };
  }

  await db.organizationInvitation.update({
    where: { tokenHash },
    data: { status: "declined", respondedAt: new Date() },
  });
  return { ok: true };
}
