/**
 * Centrální permission vrstva (T004).
 *
 * Jediné povolené místo pro rozhodování o oprávněních. UI ani doménová logika
 * nesmí kontrolovat role ad-hoc (viz TECHNICKE-ZADANI.md §3.4 a
 * zadani/05-permission-matrix.md) — vše jde přes `can()`, `hasRole()` a
 * doménové akce registrované `definePermission()`.
 *
 * Tento modul je čistý (bez DB a bez `next/*` importů), aby šel použít i v
 * klientských komponentách. Server-side vynucení (`requireRole`,
 * `requirePermission`, `getActor`) žije v `lib/session.ts`.
 */

/** Systémové role. Musí odpovídat enum `Role` v prisma/schema.prisma. */
export type Role = "client" | "professional" | "moderator" | "admin";

export const ROLES: readonly Role[] = [
  "client",
  "professional",
  "moderator",
  "admin",
] as const;

/**
 * Aktivní kontext účtu s víc rolemi. Přepíná se v hlavičce a je uložen v
 * session (JWT). Ovlivňuje jen chování akcí vázaných na kontext klient↔profík;
 * neomezuje role, které actor reálně má.
 */
export type ActiveContext = "client" | "professional";

export const DEFAULT_CONTEXT: ActiveContext = "client";

/** Přihlášený uživatel se svými rolemi a aktivním kontextem. */
export type UserActor = {
  kind: "user";
  userId: string;
  roles: readonly Role[];
  activeContext: ActiveContext;
};

/** Nepřihlášený návštěvník. */
export type Visitor = { kind: "visitor" };

export type Actor = UserActor | Visitor;

/** Sdílená instance návštěvníka (bez identity). */
export const VISITOR: Visitor = { kind: "visitor" };

/** Zúží actor na přihlášeného uživatele. */
export function isUser(actor: Actor): actor is UserActor {
  return actor.kind === "user";
}

/** Má actor danou roli? Návštěvník nemá žádnou. */
export function hasRole(actor: Actor, role: Role): boolean {
  return actor.kind === "user" && actor.roles.includes(role);
}

/** Má actor alespoň jednu z rolí? */
export function hasAnyRole(actor: Actor, ...roles: Role[]): boolean {
  return roles.some((role) => hasRole(actor, role));
}

/** Jedná actor právě v daném kontextu? Návštěvník nikdy. */
export function inContext(actor: Actor, context: ActiveContext): boolean {
  return actor.kind === "user" && actor.activeContext === context;
}

// ---------------------------------------------------------------------------
// Registr oprávnění
//
// Každá doména si registruje své akce přes `definePermission("<doména>.<akce>",
// check)`. `check(actor, subject)` vrací boolean. Duplicitní registrace je
// chyba (odhalí kolizi názvů mezi tasky). `can()` je jediný způsob evaluace.
// ---------------------------------------------------------------------------

/** Rozhodovací funkce akce. `subject` je volitelný předmět (např. entita). */
export type PermissionCheck<S = unknown> = (
  actor: Actor,
  subject: S,
) => boolean;

const registry = new Map<string, PermissionCheck<never>>();

/**
 * Zaregistruje oprávnění pod názvem `doména.akce`. Volá se při načtení modulu
 * dané domény (side-effect import). Opětovná registrace stejného názvu je chyba.
 */
export function definePermission<S = void>(
  action: string,
  check: PermissionCheck<S>,
): void {
  if (registry.has(action)) {
    throw new Error(`Oprávnění "${action}" už je registrováno.`);
  }
  registry.set(action, check as PermissionCheck<never>);
}

/** Je akce registrovaná? (užitečné v testech a při ladění). */
export function isPermissionDefined(action: string): boolean {
  return registry.has(action);
}

/**
 * Smí actor provést akci nad předmětem? Neznámá akce je chyba (fail-closed by
 * default by šlo, ale skrytá překlepová akce je nebezpečnější než hlasitý pád).
 * Admin nemá plošný override — matice má i pro admina podmíněné buňky, takže
 * rozhodnutí náleží konkrétní `check`.
 */
export function can<S = void>(
  actor: Actor,
  action: string,
  subject?: S,
): boolean {
  const check = registry.get(action);
  if (!check) {
    throw new Error(`Neznámé oprávnění "${action}".`);
  }
  return (check as PermissionCheck<S>)(actor, subject as S);
}

/** Jen pro testy: vyprázdní registr (obchází jednorázovost registrace). */
export function __resetRegistryForTests(): void {
  registry.clear();
}

// ---------------------------------------------------------------------------
// Foundation oprávnění (T004)
//
// Role-level akce, které nepatří žádné doméně: přístup do administrace a správa
// platformy. Registrují se přímo zde (v modulu engine), takže jsou HMR-safe a
// nezávisí na pořadí importů. Doménová oprávnění (portfolio.*, requests.*, …)
// si registrují jednotlivé domény ve svých modulech přes `definePermission`.
// ---------------------------------------------------------------------------

/** Přístup do route group `(admin)` — administrace i moderace. */
export const P_ACCESS_ADMIN_AREA = "platform.access_admin_area";
/** Správa platformy (nastavení, monetizace) — jen admin. */
export const P_MANAGE_PLATFORM = "platform.manage_platform";

definePermission(P_ACCESS_ADMIN_AREA, (actor) =>
  hasAnyRole(actor, "admin", "moderator"),
);
definePermission(P_MANAGE_PLATFORM, (actor) => hasRole(actor, "admin"));
