/**
 * Oprávnění domény poptávky (T024, T025). Registrují se přes `definePermission`
 * při načtení modulu (side-effect import v actions/service). Čistá vrstva (bez
 * DB) — rozhoduje jen nad `Actor` a předaným předmětem.
 *
 * Pravidla (T024 § Permissions; zadani/05 — „Publikovat B2C/B2B poptávku"):
 *  - VYTVOŘIT/číst/PSÁT poptávku (PLNOU verzi) smí JEN vlastník (admin má
 *    override — může cokoliv). Vytvoření je navázané na brief, takže audience =
 *    kdo umí brief.
 *  - PUBLIKOVAT dle matice: návštěvník NIKDY; účet POUZE s rolí moderátor NIKDY.
 *    Jinak vlastník publikovat smí (obě persony — B2C i B2B klient — mají pro
 *    svůj typ buď „Y", nebo „C"; v MVP „C" povolujeme). Admin cokoliv.
 *  - Přechody stavů (pause/resume/award/close/cancel): jen vlastník nebo admin.
 *  - ČÍST ANONYMIZOVANOU projekci (T025, §20.2–20.3): vlastník/admin vždy (i
 *    draft — slouží jako náhled před publikací); jinak nikdy draft, `public`/
 *    `shared_link` kdokoli, `private` jen pozvaný (`RequestInvite`).
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
import type { RequestStatus, RequestType, RequestVisibility } from "./types";

/** Předmět oprávnění nad konkrétní poptávkou. */
export interface RequestSubject {
  ownerUserId: string;
}

/** Předmět publikace (navíc typ — řídí matici B2C/B2B). */
export interface RequestPublishSubject extends RequestSubject {
  type: RequestType;
}

/**
 * Předmět čtení ANONYMIZOVANÉ projekce (T025). `isInvited` zjišťuje volající
 * přes `isUserInvitedToRequest` (DB dotaz — permission vrstva je čistá, proto
 * je výsledek předaný, ne dopočítaný tady).
 */
export interface RequestPublicReadSubject extends RequestSubject {
  visibility: RequestVisibility;
  status: RequestStatus;
  isInvited: boolean;
}

export const P_REQUEST_CREATE = "requests.create";
export const P_REQUEST_READ = "requests.read";
export const P_REQUEST_WRITE = "requests.write";
export const P_REQUEST_PUBLISH = "requests.publish";
export const P_REQUEST_READ_PUBLIC = "requests.read_public";

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

if (!isPermissionDefined(P_REQUEST_READ_PUBLIC)) {
  definePermission<RequestPublicReadSubject>(
    P_REQUEST_READ_PUBLIC,
    (actor, subject) => {
      // Vlastník/admin vidí anonymizovanou projekci i v draftu — slouží jako
      // náhled „takhle to uvidí profesionál" před publikací (main flow bod 6).
      if (isOwnerOrAdmin(actor, subject)) return true;
      // Nepublikovaná poptávka cizímu nikdy (draft = ještě nerozhodnuto).
      if (subject.status === "draft") return false;
      if (subject.visibility === "private") return subject.isInvited;
      return true; // `public`/`shared_link` — kdokoli.
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

/** Smí actor vidět ANONYMIZOVANOU projekci poptávky (T025 §20.2–20.3)? */
export function canReadRequestPublicView(
  actor: Actor,
  subject: RequestPublicReadSubject,
): boolean {
  return can(actor, P_REQUEST_READ_PUBLIC, subject);
}
