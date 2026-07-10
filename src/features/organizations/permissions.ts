/**
 * Oprávnění domény organizací (T009). Registrují se přes `definePermission` při
 * načtení modulu (import v actions/queries), takže jdou evaluovat přes `can()`.
 * Modul je čistý — žádná DB, jen rozhodovací logika nad `Actor` a členstvím.
 *
 * Firemní role (owner/admin/editor/member) stojí NAD systémovými rolemi z T004.
 * Konkrétní roli člena ve firmě zjistí datová vrstva a předá ji jako `subject`
 * (stejný vzor jako `ProfileSubject` u T007) — engine sám do DB nesahá.
 *
 * Matice (viz zadani/05-permission-matrix.md):
 *  - Vytvořit firmu: klient (B2B) i profesionál, i systémový admin.
 *  - Editovat firemní profil: owner/admin/editor + systémový admin.
 *  - Spravovat členy firmy: owner/admin + systémový admin.
 */

import {
  type Actor,
  can,
  definePermission,
  hasRole,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";
import { roleAtLeast } from "./rules";
import type { OrgRole } from "./types";

/** Předmět pro oprávnění vázaná na konkrétní firmu: role actora v ní (nebo nečlen). */
export type OrgMembershipSubject = { orgRole: OrgRole | null };

/**
 * Smí actor založit firmu? Jakýkoli přihlášený uživatel (jedná jako B2B klient
 * / profesionál — viz T009 § Preconditions). Návštěvníka odřízne už auth; role
 * `client` se v appce nepřiděluje automaticky (čerstvý účet je bez role, ale
 * kontextově klient), proto gate na „přihlášený", ne na konkrétní systémovou roli.
 */
export const P_ORG_CREATE = "organizations.create";
/** Smí actor vidět interní data firmy? (být její člen). */
export const P_ORG_VIEW_INTERNAL = "organizations.view_internal";
/** Smí actor editovat firemní profil? (owner/admin/editor). */
export const P_ORG_EDIT = "organizations.edit_profile";
/** Smí actor spravovat členy firmy? (owner/admin). */
export const P_ORG_MANAGE_MEMBERS = "organizations.manage_members";
/** Smí actor archivovat firmu / předat vlastnictví? (jen owner). */
export const P_ORG_ADMINISTER = "organizations.administer";

/** Systémový admin má nad firmami dozor (matice: Editovat/Spravovat = Y). */
function isSystemAdmin(actor: Actor): boolean {
  return hasRole(actor, "admin");
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_ORG_CREATE)) {
  definePermission(P_ORG_CREATE, (actor: Actor) => isUser(actor));
}
if (!isPermissionDefined(P_ORG_VIEW_INTERNAL)) {
  definePermission<OrgMembershipSubject>(
    P_ORG_VIEW_INTERNAL,
    (actor, subject) => isSystemAdmin(actor) || subject.orgRole !== null,
  );
}
if (!isPermissionDefined(P_ORG_EDIT)) {
  definePermission<OrgMembershipSubject>(
    P_ORG_EDIT,
    (actor, subject) =>
      isSystemAdmin(actor) || roleAtLeast(subject.orgRole, "editor"),
  );
}
if (!isPermissionDefined(P_ORG_MANAGE_MEMBERS)) {
  definePermission<OrgMembershipSubject>(
    P_ORG_MANAGE_MEMBERS,
    (actor, subject) =>
      isSystemAdmin(actor) || roleAtLeast(subject.orgRole, "admin"),
  );
}
if (!isPermissionDefined(P_ORG_ADMINISTER)) {
  definePermission<OrgMembershipSubject>(
    P_ORG_ADMINISTER,
    (actor, subject) => isSystemAdmin(actor) || subject.orgRole === "owner",
  );
}

/** Typovaný helper: smí actor vidět interní data firmy s danou rolí členství? */
export function canViewInternal(
  actor: Actor,
  subject: OrgMembershipSubject,
): boolean {
  return can(actor, P_ORG_VIEW_INTERNAL, subject);
}

/** Typovaný helper: smí actor editovat firemní profil? */
export function canEditOrg(
  actor: Actor,
  subject: OrgMembershipSubject,
): boolean {
  return can(actor, P_ORG_EDIT, subject);
}

/** Typovaný helper: smí actor spravovat členy firmy? */
export function canManageMembers(
  actor: Actor,
  subject: OrgMembershipSubject,
): boolean {
  return can(actor, P_ORG_MANAGE_MEMBERS, subject);
}
