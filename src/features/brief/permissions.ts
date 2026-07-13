/**
 * Oprávnění domény briefu (T021). Registrují se přes `definePermission` při
 * načtení modulu (import v actions/service), takže jdou evaluovat přes `can()`.
 * Modul je čistý (bez DB) — rozhoduje jen nad `Actor` a předaným předmětem.
 *
 * Pravidla (zadani/05-permission-matrix.md — „Vytvořit brief"; T021 § Permissions):
 *  - VYTVOŘIT brief smí každý přihlášený uživatel jednající jako klient — tj.
 *    i čerstvě zaregistrovaný účet BEZ explicitní role (registrace roli neuděluje,
 *    default persona je B2C klient). Jediná výjimka je ÚČET POUZE s rolí moderátor
 *    (matice „N"). Návštěvník má „C" (podmíněně) — podmínkou je registrace;
 *    nepřihlášeného proto akční vrstva pošle na registraci (ne 403).
 *  - ČÍST/PSÁT brief smí JEN jeho vlastník (žádný admin override — brief je
 *    soukromá osobní data).
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

/** Předmět oprávnění nad konkrétním briefem. */
export interface BriefSubject {
  ownerUserId: string;
}

export const P_BRIEF_CREATE = "brief.create";
export const P_BRIEF_READ = "brief.read";
export const P_BRIEF_WRITE = "brief.write";

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_BRIEF_CREATE)) {
  definePermission(P_BRIEF_CREATE, (actor: Actor) => {
    if (!isUser(actor)) return false;
    // Účet POUZE s rolí moderátor brief nezakládá (matice „N"). Kdokoli jiný
    // (klient/profík/admin i bezrolý default-klient) smí.
    const moderatorOnly =
      hasRole(actor, "moderator") &&
      !hasAnyRole(actor, "client", "professional", "admin");
    return !moderatorOnly;
  });
}

if (!isPermissionDefined(P_BRIEF_READ)) {
  definePermission<BriefSubject>(
    P_BRIEF_READ,
    (actor, subject) => isUser(actor) && actor.userId === subject.ownerUserId,
  );
}

if (!isPermissionDefined(P_BRIEF_WRITE)) {
  definePermission<BriefSubject>(
    P_BRIEF_WRITE,
    (actor, subject) => isUser(actor) && actor.userId === subject.ownerUserId,
  );
}

/** Smí actor vytvořit brief? (Návštěvníka akce pošle na registraci.) */
export function canCreateBrief(actor: Actor): boolean {
  return can(actor, P_BRIEF_CREATE);
}

/** Smí actor číst brief daného vlastníka? */
export function canReadBrief(actor: Actor, subject: BriefSubject): boolean {
  return can(actor, P_BRIEF_READ, subject);
}

/** Smí actor upravit brief daného vlastníka? */
export function canWriteBrief(actor: Actor, subject: BriefSubject): boolean {
  return can(actor, P_BRIEF_WRITE, subject);
}
