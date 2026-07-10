/**
 * Oprávnění domény profilů (T007). Registrují se přes `definePermission` při
 * načtení modulu (import v actions/queries), takže jdou evaluovat přes `can()`.
 * Modul je čistý — žádná DB, jen rozhodovací logika nad `Actor`.
 *
 * Pravidlo (T007 § Permissions): editovat smí jen vlastník s rolí professional;
 * číst lze publikovaný profil kdokoli, draft jen vlastník.
 */

import {
  type Actor,
  can,
  definePermission,
  hasRole,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";

/** Předmět pro čtení profilu: stav + vlastník. */
export type ProfileSubject = {
  status: "draft" | "published";
  ownerId: string;
};

/** Smí actor spravovat vlastní profil? (mít roli professional). */
export const P_PROFILE_EDIT = "profiles.edit_own";
/** Smí actor zobrazit daný profil? (published veřejně, draft jen vlastník). */
export const P_PROFILE_VIEW = "profiles.view";

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_PROFILE_EDIT)) {
  definePermission(P_PROFILE_EDIT, (actor: Actor) =>
    hasRole(actor, "professional"),
  );
}
if (!isPermissionDefined(P_PROFILE_VIEW)) {
  definePermission<ProfileSubject>(P_PROFILE_VIEW, (actor, subject) => {
    if (subject.status === "published") return true;
    return isUser(actor) && actor.userId === subject.ownerId;
  });
}

/**
 * Typovaný helper pro čtecí vrstvu. Draft vidí jen vlastník; publikovaný profil
 * je veřejný. (Veřejná route přijde v T008, tady jen vynucujeme viditelnost.)
 */
export function canViewProfile(actor: Actor, subject: ProfileSubject): boolean {
  return can(actor, P_PROFILE_VIEW, subject);
}
