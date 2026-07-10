/**
 * Oprávnění verifikace (T011 § Permissions). Uživatel ověřuje jen sebe — akce
 * proto vždy pracují s `actor.userId` z session; toto oprávnění jen vyžaduje
 * přihlášení. Stav verifikace je veřejně čitelný jako badge (bez kontaktu), což
 * žádné oprávnění nevyžaduje (řeší čtecí vrstva).
 */

import {
  type Actor,
  definePermission,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";

/** Smí actor spravovat vlastní verifikace? (být přihlášen). */
export const P_VERIFY_OWN = "verification.manage_own";

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_VERIFY_OWN)) {
  definePermission(P_VERIFY_OWN, (actor: Actor) => isUser(actor));
}
