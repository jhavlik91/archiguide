/**
 * Oprávnění domény matching (T028 § Permissions): „Doporučení k poptávce čte
 * jen vlastník poptávky + admin. Profesionál nevidí, že byl doporučen (to
 * řeší až notifikace `recommended_request` — slot)." Profesionál tedy v této
 * doméně nemá vůbec žádné čtecí oprávnění — jen vlastník poptávky a admin.
 *
 * Čistá vrstva (bez DB), stejný tvar jako `features/requests/permissions.ts`.
 */

import {
  type Actor,
  can,
  definePermission,
  hasRole,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";

/** Předmět oprávnění nad doporučeními jedné poptávky. */
export interface MatchSubject {
  ownerUserId: string;
}

export const P_MATCH_READ = "matching.read";
export const P_MATCH_UPDATE_STATUS = "matching.update_status";

/** Vlastník poptávky, nebo admin (plošný override čtení/zápisu doporučení). */
function isOwnerOrAdmin(actor: Actor, subject: MatchSubject): boolean {
  if (!isUser(actor)) return false;
  return actor.userId === subject.ownerUserId || hasRole(actor, "admin");
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_MATCH_READ)) {
  definePermission<MatchSubject>(P_MATCH_READ, isOwnerOrAdmin);
}

if (!isPermissionDefined(P_MATCH_UPDATE_STATUS)) {
  definePermission<MatchSubject>(P_MATCH_UPDATE_STATUS, isOwnerOrAdmin);
}

/** Smí actor číst doporučení k poptávce daného vlastníka? */
export function canReadMatches(actor: Actor, subject: MatchSubject): boolean {
  return can(actor, P_MATCH_READ, subject);
}

/** Smí actor měnit stav doporučení (shortlist/dismiss) u poptávky daného vlastníka? */
export function canUpdateMatchStatus(
  actor: Actor,
  subject: MatchSubject,
): boolean {
  return can(actor, P_MATCH_UPDATE_STATUS, subject);
}
