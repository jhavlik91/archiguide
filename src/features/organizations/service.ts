import "server-only";

import { randomBytes } from "node:crypto";
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
import { slugify, withSuffix } from "./slug";
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

/**
 * Tvar pro veřejnou stránku firmy (T010): firma + jen členové s opt-inem
 * (`publicVisible`), a u nich jen minimum k odkazu na jejich veřejný profil
 * (T008). Kontaktní údaje členů (e-mail) se sem záměrně nenačítají — veřejně se
 * nikdy nezobrazují (T010 § Permissions), takže je route ani nemůže vykreslit.
 */
const publicOrgInclude = {
  members: {
    where: { publicVisible: true },
    select: {
      role: true,
      createdAt: true,
      user: {
        select: {
          professionalProfile: {
            select: {
              slug: true,
              headline: true,
              photoUrl: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.OrganizationInclude;

export type PublicOrganization = Prisma.OrganizationGetPayload<{
  include: typeof publicOrgInclude;
}>;

/** Firma podle veřejného slugu (bez ohledu na stav — viditelnost řeší route). */
export function getPublicOrganizationBySlug(
  slug: string,
): Promise<PublicOrganization | null> {
  return db.organization.findUnique({
    where: { slug },
    include: publicOrgInclude,
  });
}

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
  // Firma je po založení rovnou `active`, tedy veřejná — slug musí existovat hned
  // (T010). Vzniká z názvu a dál se nemění.
  const slug = await reserveUniqueSlug(input.name);

  const org = await db.organization.create({
    data: {
      name: input.name,
      slug,
      businessId,
      members: { create: { userId, role: "owner" } },
    },
    select: { id: true, name: true },
  });

  return { org, duplicateBusinessId };
}

/**
 * Doplní firmě veřejný slug, pokud ho ještě nemá (firmy založené v T009 před
 * migrací). Slug je stabilní — jednou vygenerovaný se nemění. Souběh řeší DB
 * unikát: prohrávající zápis (P2002) se tiše ignoruje (příště se doplní jinak).
 */
async function ensureOrgSlug(orgId: string): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { slug: true, name: true },
  });
  if (!org || org.slug) return;

  const slug = await reserveUniqueSlug(org.name);
  try {
    // updateMany s podmínkou `slug: null` je atomické — neošlape existující slug,
    // když ho mezitím obsadil souběžný zápis (vrátí count 0, nic se nestane).
    await db.organization.updateMany({
      where: { id: orgId, slug: null },
      data: { slug },
    });
  } catch (error) {
    if (!(
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )) {
      throw error;
    }
  }
}

/**
 * Najde volný slug: nejdřív zkusí čistý root z názvu, při kolizi přidává krátký
 * náhodný sufix. Uniqueness se přesto vynucuje DB indexem — souběžné založení
 * dvou stejných názvů skončí P2002 a lze ho bezpečně zopakovat.
 */
async function reserveUniqueSlug(source: string): Promise<string> {
  const root = slugify(source);
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = attempt === 0 ? "" : randomBytes(3).toString("hex");
    const candidate = withSuffix(root, suffix);
    const taken = await db.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  // Krajně nepravděpodobné (8 kolizí) — sáhni po delším náhodném sufixu.
  return withSuffix(root, randomBytes(6).toString("hex"));
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
      publicEmail: input.publicEmail ?? null,
      publicPhone: input.publicPhone ?? null,
      publicWebsite: input.publicWebsite ?? null,
    },
  });
  // Pojistka pro firmy z T009 bez slugu — po první editaci budou veřejně dosažitelné.
  await ensureOrgSlug(orgId);
  return { duplicateBusinessId };
}

/**
 * Nastaví, zda je členství uživatele viditelné ve veřejném týmu firmy (T010).
 * Opt-in řídí sám člen; oprávnění (je členem) ověřuje akční vrstva.
 */
export async function setMemberPublicVisibility(
  orgId: string,
  userId: string,
  visible: boolean,
): Promise<void> {
  await db.organizationMember.update({
    where: { orgId_userId: { orgId, userId } },
    data: { publicVisible: visible },
  });
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
