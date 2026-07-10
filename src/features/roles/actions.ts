"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { type ActiveContext, type Role, hasRole } from "@/lib/permissions";
import { grantRole, revokeRole } from "./service";
import { writeActiveContext } from "./active-context";
import { claimRoleSchema, contextSchema, roleSchema } from "./validation";

export type RoleActionResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "forbidden" | "validation" };

/**
 * Přepne aktivní kontext (klient↔profesionál). Povolí jen kontext, ke kterému
 * uživatel reálně má roli — jinak by šlo přepnout do role, kterou nemá.
 * Uloží se do session cookie (viz `active-context.ts`); role se necachují.
 */
export async function switchContext(
  input: ActiveContext,
): Promise<RoleActionResult> {
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, error: "unauthenticated" };
  if (!hasRole(actor, parsed.data)) return { ok: false, error: "forbidden" };

  await writeActiveContext(parsed.data);
  trackEvent("role.context_switched", {
    userId: actor.userId,
    context: parsed.data,
  });
  // Layout i stránky se překreslí s novým kontextem.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Self-service přidělení role při onboardingu — jen `client`/`professional`
 * a jen sobě (T004 § Validation). Ostatní role přiděluje admin.
 */
export async function claimRole(input: Role): Promise<RoleActionResult> {
  const parsed = claimRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, error: "unauthenticated" };

  await grantRole(actor.userId, parsed.data as Role, null);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin přidělí libovolnou roli libovolnému uživateli (T004 § Validation). */
export async function assignRole(
  userId: string,
  role: Role,
): Promise<RoleActionResult> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "validation" };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, error: "unauthenticated" };
  if (!hasRole(actor, "admin")) return { ok: false, error: "forbidden" };

  await grantRole(userId, parsed.data as Role, actor.userId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin odebere roli uživateli. */
export async function revokeUserRole(
  userId: string,
  role: Role,
): Promise<RoleActionResult> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "validation" };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, error: "unauthenticated" };
  if (!hasRole(actor, "admin")) return { ok: false, error: "forbidden" };

  await revokeRole(userId, parsed.data as Role);
  revalidatePath("/", "layout");
  return { ok: true };
}
