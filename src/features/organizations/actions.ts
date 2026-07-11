"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActor } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { type Actor, type UserActor, can } from "@/lib/permissions";
import { sendOrgInvitationEmail } from "@/features/auth/email";
// Import zároveň registruje oprávnění organizací (organizations.*).
import {
  P_ORG_CREATE,
  P_ORG_EDIT,
  P_ORG_MANAGE_MEMBERS,
  canManageMembers,
} from "./permissions";
import { canAssignRole, canModifyMember } from "./rules";
import {
  acceptInvitation,
  changeMemberRole,
  createOrganization,
  declineInvitation,
  getMembershipRole,
  inviteMember,
  removeMember,
  updateOrganizationProfile,
} from "./service";
import { createInvitationToken, hashInvitationToken } from "./tokens";
import type { OrgRole } from "./types";
import {
  changeRoleSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  memberTargetSchema,
  updateOrganizationSchema,
} from "./validation";

/**
 * Server akce organizací (T009). Každá mutace ověří oprávnění přes permission
 * vrstvu (systémová role + role člena ve firmě), pak validuje vstup (Zod) a
 * teprve pak sáhne do service vrstvy. Chyby se vrací jako výsledek (ne throw),
 * aby je formuláře zobrazily — nikdy se tiše nespolkne selhání zápisu.
 */

export type OrgActionResult<Extra = unknown> =
  | ({ ok: true } & Extra)
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation" | "rule";
      message: string;
    };

const UNAUTHENTICATED = {
  ok: false as const,
  error: "unauthenticated" as const,
  message: "Přihlaste se prosím.",
};
const FORBIDDEN = {
  ok: false as const,
  error: "forbidden" as const,
  message: "Na tuto akci nemáte oprávnění.",
};

function invalid(message = "Zkontrolujte zadané údaje.") {
  return { ok: false as const, error: "validation" as const, message };
}
function ruleError(message: string) {
  return { ok: false as const, error: "rule" as const, message };
}

async function requireUserActor(): Promise<
  { actor: UserActor } | { result: typeof UNAUTHENTICATED }
> {
  const actor = await getActor();
  if (actor.kind !== "user") return { result: UNAUTHENTICATED };
  return { actor };
}

/** Actor + jeho role ve firmě (pro subject permission checků). */
async function requireMembership(
  orgId: string,
): Promise<{ actor: Actor; role: OrgRole | null }> {
  const actor = await getActor();
  if (actor.kind !== "user") return { actor, role: null };
  const role = await getMembershipRole(orgId, actor.userId);
  return { actor, role };
}

async function getBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function currentUserEmail(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

// --- Založení ---------------------------------------------------------------

export async function createOrganizationAction(
  input: unknown,
): Promise<OrgActionResult<{ orgId: string; duplicateBusinessId: boolean }>> {
  const guard = await requireUserActor();
  if ("result" in guard) return guard.result;
  if (!can(guard.actor, P_ORG_CREATE)) return FORBIDDEN;

  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const { org, duplicateBusinessId } = await createOrganization(
    guard.actor.userId,
    parsed.data,
  );
  trackEvent("org.created", { userId: guard.actor.userId, orgId: org.id });
  revalidatePath("/organizations");
  return { ok: true, orgId: org.id, duplicateBusinessId };
}

// --- Editace profilu --------------------------------------------------------

export async function updateOrganizationAction(
  orgId: string,
  input: unknown,
): Promise<OrgActionResult<{ duplicateBusinessId: boolean }>> {
  const { actor, role } = await requireMembership(orgId);
  if (actor.kind !== "user") return UNAUTHENTICATED;
  if (!can(actor, P_ORG_EDIT, { orgRole: role })) return FORBIDDEN;

  const parsed = updateOrganizationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const { duplicateBusinessId } = await updateOrganizationProfile(
    orgId,
    parsed.data,
  );
  revalidatePath(`/organizations/${orgId}`);
  return { ok: true, duplicateBusinessId };
}

// --- Pozvání člena ----------------------------------------------------------

export async function inviteMemberAction(
  orgId: string,
  input: unknown,
): Promise<OrgActionResult> {
  const { actor, role } = await requireMembership(orgId);
  if (actor.kind !== "user") return UNAUTHENTICATED;
  if (!canManageMembers(actor, { orgRole: role })) return FORBIDDEN;

  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  // Systémový admin (nečlen) nemá firemní roli — smí přiřadit libovolnou
  // pozvatelnou roli; jinak rozhoduje role člena.
  if (role !== null && !canAssignRole(role, parsed.data.role)) {
    return ruleError("Tuto roli nemůžete přiřadit.");
  }

  const { token, tokenHash } = createInvitationToken();
  const result = await inviteMember(
    orgId,
    parsed.data.email,
    parsed.data.role,
    tokenHash,
    actor.userId,
  );
  if (!result.ok) {
    return ruleError("Tento e-mail už je členem firmy.");
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  const baseUrl = await getBaseUrl();
  await sendOrgInvitationEmail(
    parsed.data.email,
    `${baseUrl}/organizations/invitations/${token}`,
    org?.name ?? "firmy",
  );

  trackEvent("org.member_invited", {
    orgId,
    invitedBy: actor.userId,
    role: parsed.data.role,
  });
  revalidatePath(`/organizations/${orgId}`);
  return { ok: true };
}

// --- Změna role a odebrání --------------------------------------------------

export async function changeMemberRoleAction(
  orgId: string,
  input: unknown,
): Promise<OrgActionResult> {
  const { actor, role } = await requireMembership(orgId);
  if (actor.kind !== "user") return UNAUTHENTICATED;
  if (!can(actor, P_ORG_MANAGE_MEMBERS, { orgRole: role })) return FORBIDDEN;

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const targetRole = await getMembershipRole(orgId, parsed.data.userId);
  if (targetRole === null) return ruleError("Uživatel není členem firmy.");

  // Firemní kompetence: kdo koho smí měnit a jakou roli smí přiřadit.
  if (role !== null) {
    if (!canModifyMember(role, targetRole)) {
      return ruleError("Tohoto člena nemůžete upravovat.");
    }
    if (!canAssignRole(role, parsed.data.role)) {
      return ruleError("Tuto roli nemůžete přiřadit.");
    }
  }

  const result = await changeMemberRole(
    orgId,
    parsed.data.userId,
    parsed.data.role,
  );
  if (!result.ok) {
    return ruleError(
      result.error === "last_owner"
        ? "Firma musí mít alespoň jednoho vlastníka."
        : "Uživatel není členem firmy.",
    );
  }
  revalidatePath(`/organizations/${orgId}`);
  return { ok: true };
}

export async function removeMemberAction(
  orgId: string,
  input: unknown,
): Promise<OrgActionResult> {
  const { actor, role } = await requireMembership(orgId);
  if (actor.kind !== "user") return UNAUTHENTICATED;
  if (!can(actor, P_ORG_MANAGE_MEMBERS, { orgRole: role })) return FORBIDDEN;

  const parsed = memberTargetSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const targetRole = await getMembershipRole(orgId, parsed.data.userId);
  if (targetRole === null) return ruleError("Uživatel není členem firmy.");
  if (role !== null && !canModifyMember(role, targetRole)) {
    return ruleError("Tohoto člena nemůžete odebrat.");
  }

  const result = await removeMember(orgId, parsed.data.userId);
  if (!result.ok) {
    return ruleError(
      result.error === "last_owner"
        ? "Posledního vlastníka nelze odebrat. Nejdřív předejte vlastnictví."
        : "Uživatel není členem firmy.",
    );
  }
  revalidatePath(`/organizations/${orgId}`);
  return { ok: true };
}

/** Odchod člena z firmy (self-removal). Poslední owner musí nejdřív předat vlastnictví. */
export async function leaveOrganizationAction(
  orgId: string,
): Promise<OrgActionResult> {
  const guard = await requireUserActor();
  if ("result" in guard) return guard.result;

  const result = await removeMember(orgId, guard.actor.userId);
  if (!result.ok) {
    return ruleError(
      result.error === "last_owner"
        ? "Jste poslední vlastník. Nejdřív předejte vlastnictví jinému členovi."
        : "Nejste členem této firmy.",
    );
  }
  revalidatePath("/organizations");
  return { ok: true };
}

// --- Reakce na pozvánku -----------------------------------------------------

export async function acceptInvitationAction(
  token: string,
): Promise<OrgActionResult<{ orgId: string }>> {
  const guard = await requireUserActor();
  if ("result" in guard) return guard.result;

  const email = await currentUserEmail(guard.actor.userId);
  if (!email) return UNAUTHENTICATED;

  const result = await acceptInvitation(
    hashInvitationToken(token),
    guard.actor.userId,
    email,
  );
  if (!result.ok) {
    if (result.error === "email_mismatch") {
      return ruleError(
        "Pozvánka je pro jiný e-mail. Přihlaste se účtem, na který dorazila.",
      );
    }
    if (result.error === "not_actionable") {
      return ruleError(
        "Pozvánka už není platná (vypršela nebo byla vyřízena).",
      );
    }
    return ruleError("Pozvánka nebyla nalezena.");
  }

  if (!result.alreadyMember) {
    trackEvent("org.member_joined", {
      orgId: result.orgId,
      userId: guard.actor.userId,
    });
  }
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${result.orgId}`);
  return { ok: true, orgId: result.orgId };
}

export async function declineInvitationAction(
  token: string,
): Promise<OrgActionResult> {
  const guard = await requireUserActor();
  if ("result" in guard) return guard.result;

  const email = await currentUserEmail(guard.actor.userId);
  if (!email) return UNAUTHENTICATED;

  const result = await declineInvitation(hashInvitationToken(token), email);
  if (!result.ok) {
    if (result.error === "email_mismatch") {
      return ruleError("Pozvánka je pro jiný e-mail.");
    }
    if (result.error === "not_actionable") {
      return ruleError("Pozvánka už není platná.");
    }
    return ruleError("Pozvánka nebyla nalezena.");
  }
  return { ok: true };
}
