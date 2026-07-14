/**
 * Oprávnění domény poptávky (T024). Registrují se přes `definePermission` při
 * načtení modulu (side-effect import v actions/service). Čistá vrstva (bez DB) —
 * rozhoduje jen nad `Actor` a předaným předmětem.
 *
 * Pravidla (T024 § Permissions; zadani/05 — „Publikovat B2C/B2B poptávku"):
 *  - VYTVOŘIT/číst/PSÁT poptávku smí JEN vlastník (admin má override — může
 *    cokoliv). Vytvoření je navázané na brief, takže audience = kdo umí brief.
 *  - PUBLIKOVAT dle matice: návštěvník NIKDY; účet POUZE s rolí moderátor NIKDY.
 *    Jinak vlastník publikovat smí (obě persony — B2C i B2B klient — mají pro
 *    svůj typ buď „Y", nebo „C"; v MVP „C" povolujeme). Admin cokoliv.
 *  - Přechody stavů (pause/resume/award/close/cancel): jen vlastník nebo admin.
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
import type { RequestType } from "./types";

/** Předmět oprávnění nad konkrétní poptávkou. */
export interface RequestSubject {
  ownerUserId: string;
}

/** Předmět publikace (navíc typ — řídí matici B2C/B2B). */
export interface RequestPublishSubject extends RequestSubject {
  type: RequestType;
}

export const P_REQUEST_CREATE = "requests.create";
export const P_REQUEST_READ = "requests.read";
export const P_REQUEST_WRITE = "requests.write";
export const P_REQUEST_PUBLISH = "requests.publish";

/** Je actor „pouze moderátor" (bez klient/profík/admin role)? Ten poptávku netvoří. */
function isModeratorOnly(actor: Actor): boolean {
  return (
    hasRole(actor, "moderator") &&
    !hasAnyRole(actor, "client", "professional", "admin")
  );
}

/** Vlastník daného předmětu, nebo admin (plošný override CRUD). */
function isOwnerOrAdmin(actor: Actor, subject: RequestSubject): boolean {
  if (!isUser(actor)) return false;
  return actor.userId === subject.ownerUserId || hasRole(actor, "admin");
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_REQUEST_CREATE)) {
  // Vytvořit poptávku (z briefu) smí každý přihlášený kromě účtu POUZE moderátor
  // (stejná audience jako „Vytvořit brief").
  definePermission(P_REQUEST_CREATE, (actor: Actor) => {
    if (!isUser(actor)) return false;
    return !isModeratorOnly(actor);
  });
}

if (!isPermissionDefined(P_REQUEST_READ)) {
  definePermission<RequestSubject>(P_REQUEST_READ, isOwnerOrAdmin);
}

if (!isPermissionDefined(P_REQUEST_WRITE)) {
  definePermission<RequestSubject>(P_REQUEST_WRITE, isOwnerOrAdmin);
}

if (!isPermissionDefined(P_REQUEST_PUBLISH)) {
  definePermission<RequestPublishSubject>(
    P_REQUEST_PUBLISH,
    (actor, subject) => {
      if (!isUser(actor)) return false; // návštěvník NIKDY
      // Admin může publikovat cokoliv.
      if (hasRole(actor, "admin")) return true;
      // Jinak jen vlastník…
      if (actor.userId !== subject.ownerUserId) return false;
      // …a ne účet POUZE s rolí moderátor (matice „N" napříč typy).
      return !isModeratorOnly(actor);
    },
  );
}

/** Smí actor vytvořit poptávku? (Návštěvníka akce pošle na registraci/login.) */
export function canCreateRequest(actor: Actor): boolean {
  return can(actor, P_REQUEST_CREATE);
}

/** Smí actor číst poptávku daného vlastníka? */
export function canReadRequest(actor: Actor, subject: RequestSubject): boolean {
  return can(actor, P_REQUEST_READ, subject);
}

/** Smí actor upravit poptávku / provést stavový přechod (mimo publikaci)? */
export function canWriteRequest(
  actor: Actor,
  subject: RequestSubject,
): boolean {
  return can(actor, P_REQUEST_WRITE, subject);
}

/** Smí actor publikovat poptávku daného typu? */
export function canPublishRequest(
  actor: Actor,
  subject: RequestPublishSubject,
): boolean {
  return can(actor, P_REQUEST_PUBLISH, subject);
}
