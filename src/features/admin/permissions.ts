/**
 * Oprávnění domény administrace (T035). Registrují se přes `definePermission`
 * při načtení modulu (import v actions/queries), stejný vzor jako
 * `features/organizations/permissions.ts`. Čistá vrstva — bez DB.
 *
 * Matice (zadani/05-permission-matrix.md, T035 § Permissions):
 *  - Přístup do administrace vůbec: admin i moderátor (`P_ACCESS_ADMIN_AREA`,
 *    registrováno v `lib/permissions.ts` u T004).
 *  - Výpis uživatelů (read-only): admin i moderátor.
 *  - Správa uživatelů (blokace, změna role): jen admin.
 *  - Správa taxonomie (kategorie/profese): jen admin.
 */

import {
  type Actor,
  can,
  definePermission,
  hasAnyRole,
  hasRole,
  isPermissionDefined,
} from "@/lib/permissions";

/** Vidět výpis a detail uživatelů (read-only pro moderátora). */
export const P_ADMIN_VIEW_USERS = "admin.view_users";
/** Blokovat/odblokovat uživatele a měnit jeho role. */
export const P_ADMIN_MANAGE_USERS = "admin.manage_users";
/** CRUD kategorií a profesí taxonomie. */
export const P_ADMIN_MANAGE_TAXONOMY = "admin.manage_taxonomy";

if (!isPermissionDefined(P_ADMIN_VIEW_USERS)) {
  definePermission(P_ADMIN_VIEW_USERS, (actor: Actor) =>
    hasAnyRole(actor, "admin", "moderator"),
  );
}
if (!isPermissionDefined(P_ADMIN_MANAGE_USERS)) {
  definePermission(P_ADMIN_MANAGE_USERS, (actor: Actor) =>
    hasRole(actor, "admin"),
  );
}
if (!isPermissionDefined(P_ADMIN_MANAGE_TAXONOMY)) {
  definePermission(P_ADMIN_MANAGE_TAXONOMY, (actor: Actor) =>
    hasRole(actor, "admin"),
  );
}

/** Typovaný helper: smí actor spravovat uživatele (blokace, role)? */
export function canManageUsers(actor: Actor): boolean {
  return can(actor, P_ADMIN_MANAGE_USERS);
}

/** Typovaný helper: smí actor spravovat taxonomii? */
export function canManageTaxonomy(actor: Actor): boolean {
  return can(actor, P_ADMIN_MANAGE_TAXONOMY);
}
