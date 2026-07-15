"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import type { Role, UserActor } from "@/lib/permissions";
// Import zároveň registruje oprávnění administrace (admin.*).
import { canManageUsers } from "../permissions";
import { changeUserRole, suspendUser, unsuspendUser } from "./service";
import {
  roleChangeSchema,
  suspendUserSchema,
  unsuspendUserSchema,
} from "./validation";

/**
 * Server akce správy uživatelů (T035 § Main flow 3). Každá mutace ověří
 * oprávnění (jen admin — moderátor má výpis read-only), validuje vstup (Zod,
 * důvod povinný) a teprve pak sáhne do service vrstvy, která zapisuje audit.
 */

export type AdminUserActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "forbidden"
        | "validation"
        | "self"
        | "last_admin"
        | "not_found";
      message: string;
    };

const UNAUTHENTICATED: AdminUserActionResult = {
  ok: false,
  error: "unauthenticated",
  message: "Přihlaste se prosím.",
};
const FORBIDDEN: AdminUserActionResult = {
  ok: false,
  error: "forbidden",
  message: "Na tuto akci nemáte oprávnění.",
};

function invalid(message = "Zkontrolujte zadané údaje."): AdminUserActionResult {
  return { ok: false, error: "validation", message };
}

async function requireManager(): Promise<
  { actor: UserActor } | { result: AdminUserActionResult }
> {
  const actor = await getActor();
  if (actor.kind !== "user") return { result: UNAUTHENTICATED };
  if (!canManageUsers(actor)) return { result: FORBIDDEN };
  return { actor };
}

export async function suspendUserAction(
  targetUserId: string,
  input: unknown,
): Promise<AdminUserActionResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = suspendUserSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const result = await suspendUser(
    guard.actor.userId,
    targetUserId,
    parsed.data.reason,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message:
        result.error === "self"
          ? "Nemůžete zablokovat sám sebe."
          : "Uživatel nenalezen.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
  return { ok: true };
}

export async function unsuspendUserAction(
  targetUserId: string,
  input: unknown,
): Promise<AdminUserActionResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = unsuspendUserSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const result = await unsuspendUser(
    guard.actor.userId,
    targetUserId,
    parsed.data.reason,
  );
  if (!result.ok) {
    return { ok: false, error: result.error, message: "Uživatel nenalezen." };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
  return { ok: true };
}

export async function changeUserRoleAction(
  targetUserId: string,
  input: unknown,
): Promise<AdminUserActionResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = roleChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const result = await changeUserRole(
    guard.actor.userId,
    targetUserId,
    parsed.data.role as Role,
    parsed.data.action,
    parsed.data.reason,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message:
        result.error === "last_admin"
          ? "Systém musí mít alespoň jednoho admina."
          : "Uživatel nenalezen.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
