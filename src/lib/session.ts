import "server-only";

import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import { listRoles } from "@/features/roles/service";
import { readActiveContext } from "@/features/roles/active-context";
import {
  type ActiveContext,
  type Actor,
  type Role,
  type UserActor,
  VISITOR,
  can,
  hasRole,
} from "@/lib/permissions";

/**
 * Server-side most mezi Auth.js session a permission vrstvou (T004).
 *
 * Role se čtou z DB per-request (ne z JWT), takže ztráta role se projeví
 * okamžitě bez odhlášení (viz zadani/16 §3 a T004 § Alternative flows). `cache`
 * z Reactu zajistí, že se v rámci jednoho requestu DB dotáže nejvýš jednou.
 */

/**
 * Vybere platný aktivní kontext: preferovaný z session, pokud k němu actor má
 * roli; jinak spadne na roli, kterou reálně má. Tím `inContext()` nikdy netvrdí
 * kontext, ke kterému uživatel nemá roli (např. po odebrání profi role).
 */
function resolveContext(
  preferred: ActiveContext | undefined,
  roles: readonly Role[],
): ActiveContext {
  if (preferred && roles.includes(preferred)) return preferred;
  if (roles.includes("client")) return "client";
  if (roles.includes("professional")) return "professional";
  return preferred ?? "client";
}

/**
 * Aktuální actor pro tento request. Návštěvník bez session → `VISITOR`.
 * Memoizováno per-request přes `cache`.
 */
export const getActor = cache(async (): Promise<Actor> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return VISITOR;

  const [roles, preferred] = await Promise.all([
    listRoles(userId),
    readActiveContext(),
  ]);

  return {
    kind: "user",
    userId,
    roles,
    activeContext: resolveContext(preferred, roles),
  };
});

/**
 * Vyžádá přihlášeného uživatele; návštěvníka pošle na login. Použij v layoutu
 * chráněné sekce nebo na začátku server action.
 */
export async function requireUser(): Promise<UserActor> {
  const actor = await getActor();
  if (actor.kind !== "user") redirect("/login");
  return actor;
}

/**
 * Vyžádá konkrétní roli. Nepřihlášený → login; přihlášený bez role → 403.
 */
export async function requireRole(role: Role): Promise<UserActor> {
  const actor = await requireUser();
  if (!hasRole(actor, role)) forbidden();
  return actor;
}

/**
 * Vyžádá oprávnění (registrovanou akci) nad volitelným předmětem. Nepřihlášený,
 * kterému akce nestačí → login; přihlášený bez oprávnění → 403.
 */
export async function requirePermission<S = void>(
  action: string,
  subject?: S,
): Promise<Actor> {
  const actor = await getActor();
  if (can(actor, action, subject as S)) return actor;
  if (actor.kind !== "user") redirect("/login");
  forbidden();
}
