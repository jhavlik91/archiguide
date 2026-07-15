import "server-only";

import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import {
  countUsersWithRole,
  grantRole,
  revokeRole,
  userHasRole,
} from "@/features/roles/service";
import { writeAuditLog } from "../audit";
import { canRevokeAdminRole, canSuspend } from "./rules";

/**
 * Mutace admin akcí nad uživatelem (T035 § Main flow 3, § Edge cases). Server
 * actions (`actions.ts`) ověří oprávnění a validují vstup (Zod); tahle vrstva
 * vynucuje doménová pravidla (`rules.ts`) a zapisuje audit.
 */

export type AdminUserActionResult =
  | { ok: true }
  | { ok: false; error: "self" | "last_admin" | "not_found" };

/** Zablokuje uživatele (T035 § Main flow 3). Admin nemůže zablokovat sám sebe. */
export async function suspendUser(
  actorUserId: string,
  targetUserId: string,
  reason: string,
): Promise<AdminUserActionResult> {
  if (!canSuspend(actorUserId, targetUserId)) return { ok: false, error: "self" };

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { ok: false, error: "not_found" };

  await db.user.update({
    where: { id: targetUserId },
    data: { status: "suspended" },
  });
  await writeAuditLog({
    actorUserId,
    action: "user_suspended",
    targetType: "user",
    targetId: targetUserId,
    reason,
  });
  trackEvent("admin_user_suspended", { actorUserId, targetUserId });
  return { ok: true };
}

/** Odblokuje uživatele — vrátí účet do stavu `active`. */
export async function unsuspendUser(
  actorUserId: string,
  targetUserId: string,
  reason: string,
): Promise<AdminUserActionResult> {
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { ok: false, error: "not_found" };

  await db.user.update({
    where: { id: targetUserId },
    data: { status: "active" },
  });
  await writeAuditLog({
    actorUserId,
    action: "user_unsuspended",
    targetType: "user",
    targetId: targetUserId,
    reason,
  });
  trackEvent("admin_user_suspended", {
    actorUserId,
    targetUserId,
    reversed: true,
  });
  return { ok: true };
}

/**
 * Přidělí/odebere roli uživateli (T035 § Main flow 3). Odebrání role `admin`
 * je zakázané, pokud by v systému nezůstal žádný admin (T035 § Edge cases).
 */
export async function changeUserRole(
  actorUserId: string,
  targetUserId: string,
  role: Role,
  action: "grant" | "revoke",
  reason: string,
): Promise<AdminUserActionResult> {
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { ok: false, error: "not_found" };

  if (action === "revoke" && role === "admin") {
    const [admins, targetIsAdmin] = await Promise.all([
      countUsersWithRole("admin"),
      userHasRole(targetUserId, "admin"),
    ]);
    if (!canRevokeAdminRole(targetIsAdmin, admins)) {
      return { ok: false, error: "last_admin" };
    }
  }

  if (action === "grant") {
    await grantRole(targetUserId, role, actorUserId);
  } else {
    await revokeRole(targetUserId, role);
  }

  await writeAuditLog({
    actorUserId,
    action: action === "grant" ? "user_role_granted" : "user_role_revoked",
    targetType: "user",
    targetId: targetUserId,
    reason,
    metadata: { role },
  });
  trackEvent("admin_role_changed", { actorUserId, targetUserId, role, action });
  return { ok: true };
}
