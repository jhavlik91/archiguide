/**
 * Oprávnění domény moderace (T036). Registrují se přes `definePermission` při
 * načtení modulu (side-effect import v actions/service). Čistá vrstva (bez DB) —
 * rozhoduje jen nad `Actor` a předaným předmětem.
 *
 * Pravidla (T036 § Permissions; zadani/05):
 *  - REPORT: „každý přihlášený" — libovolná role, návštěvník nikdy.
 *  - FRONTA a AKCE: moderátor + admin.
 *  - SUSPENZE účtu: jen admin (dle T035).
 */

import {
  type Actor,
  can,
  definePermission,
  hasAnyRole,
  hasRole,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";

export const P_REPORT_CREATE = "moderation.report_create";
export const P_REPORT_QUEUE = "moderation.queue_access";
export const P_REPORT_ACT = "moderation.act";
export const P_REPORT_SUSPEND = "moderation.suspend_account";

if (!isPermissionDefined(P_REPORT_CREATE)) {
  definePermission(P_REPORT_CREATE, (actor: Actor) => isUser(actor));
}

if (!isPermissionDefined(P_REPORT_QUEUE)) {
  definePermission(P_REPORT_QUEUE, (actor: Actor) =>
    hasAnyRole(actor, "moderator", "admin"),
  );
}

if (!isPermissionDefined(P_REPORT_ACT)) {
  definePermission(P_REPORT_ACT, (actor: Actor) =>
    hasAnyRole(actor, "moderator", "admin"),
  );
}

if (!isPermissionDefined(P_REPORT_SUSPEND)) {
  definePermission(P_REPORT_SUSPEND, (actor: Actor) => hasRole(actor, "admin"));
}

/** Smí actor nahlásit obsah? (Návštěvníka akce pošle na login.) */
export function canReportContent(actor: Actor): boolean {
  return can(actor, P_REPORT_CREATE);
}

/** Smí actor otevřít moderační frontu / detail reportu? */
export function canAccessModerationQueue(actor: Actor): boolean {
  return can(actor, P_REPORT_QUEUE);
}

/** Smí actor provést moderační akci (mimo suspenzi)? */
export function canActOnReport(actor: Actor): boolean {
  return can(actor, P_REPORT_ACT);
}

/** Smí actor suspendovat účet (dočasně/trvale)? Jen admin. */
export function canSuspendAccount(actor: Actor): boolean {
  return can(actor, P_REPORT_SUSPEND);
}
