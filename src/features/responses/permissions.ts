/**
 * Oprávnění domény reakce na poptávku (T027). Registrují se přes
 * `definePermission` při načtení modulu (side-effect import v actions/service).
 * Čistá vrstva (bez DB) — rozhoduje jen nad `Actor` a předaným předmětem.
 *
 * Pravidla (zadani/05 — „Reagovat na poptávku": N | C | C | Y | Y | C | N | Y):
 *  - VYTVOŘIT reakci smí přihlášený profesionál (individuální účet) nebo
 *    org editor+ (firma) — NE moderátor bez další role. Jen na `active`
 *    poptávku (veřejnou, nebo neveřejnou s pozvánkou — T027 § Preconditions).
 *  - ČÍST reakci smí autor (uživatel, nebo člen autorské organizace) A
 *    vlastník poptávky. Admin cokoliv.
 *  - STÁHNOUT (withdraw) reakci smí jen autor (uživatel/org editor+).
 *  - SPRAVOVAT (shortlist/přijmout/odmítnout) smí jen vlastník poptávky.
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
import type { RequestStatus, RequestVisibility } from "@/features/requests";
import type { ResponseAuthorRef } from "./types";

/** Je actor „pouze moderátor" (bez klient/profík/admin role)? Ten nereaguje. */
function isModeratorOnly(actor: Actor): boolean {
  return (
    hasRole(actor, "moderator") &&
    !hasAnyRole(actor, "client", "professional", "admin")
  );
}

/** Je actor autorem reakce (vlastník-uživatel, nebo org editor+ u firmy)? */
function isAuthor(
  actor: Actor,
  author: ResponseAuthorRef,
  isOrgEditor?: boolean,
): boolean {
  if (author.type === "user") {
    return isUser(actor) && actor.userId === author.userId;
  }
  return isOrgEditor === true;
}

/** Předmět založení reakce: zamýšlený autor + stav/viditelnost cílové poptávky. */
export interface ResponseCreateSubject {
  author: ResponseAuthorRef;
  /** Role actora ve firemním autorovi (jen u organization — datová vrstva). */
  isOrgEditor?: boolean;
  requestStatus: RequestStatus;
  requestVisibility: RequestVisibility;
  /** Je actor pozvaný k neveřejné poptávce (T025)? Nerelevantní u `public`. */
  isInvited: boolean;
}

/** Předmět čtení reakce: kdo je autor a kdo vlastní poptávku. */
export interface ResponseReadSubject {
  author: ResponseAuthorRef;
  requestOwnerUserId: string;
  /** Je actor členem autorské organizace? (čtení reakce podané firmou). */
  isOrgMember?: boolean;
}

/** Předmět akcí vázaných na autora (editace, dokud `sent`; withdraw). */
export interface ResponseAuthorSubject {
  author: ResponseAuthorRef;
  isOrgEditor?: boolean;
}

/** Předmět akcí vázaných na vlastníka poptávky (shortlist/přijmout/odmítnout). */
export interface ResponseOwnerSubject {
  requestOwnerUserId: string;
}

export const P_RESPONSE_CREATE = "responses.create";
export const P_RESPONSE_READ = "responses.read";
/** Editace (dokud `sent`) i stažení — obojí smí jen autor (nebo admin). */
export const P_RESPONSE_WRITE = "responses.write";
export const P_RESPONSE_MANAGE = "responses.manage";

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_RESPONSE_CREATE)) {
  definePermission<ResponseCreateSubject>(P_RESPONSE_CREATE, (actor, subject) => {
    if (!isUser(actor)) return false; // návštěvník NIKDY
    if (hasRole(actor, "admin")) return true;

    // Poptávka musí přijímat reakce: `active`, a u neveřejné navíc pozvánka
    // (T027 § Preconditions; T026 § Alternative flows — mimo `active` nikdy).
    const requestOpen =
      subject.requestStatus === "active" &&
      (subject.requestVisibility !== "private" || subject.isInvited);
    if (!requestOpen) return false;

    if (subject.author.type === "user") {
      return (
        actor.userId === subject.author.userId &&
        hasRole(actor, "professional") &&
        !isModeratorOnly(actor)
      );
    }
    // Firemní reakce: org editor+ (zadani/05 — „Firma admin" Y, „Firma editor" C).
    return subject.isOrgEditor === true;
  });
}

if (!isPermissionDefined(P_RESPONSE_READ)) {
  definePermission<ResponseReadSubject>(P_RESPONSE_READ, (actor, subject) => {
    if (!isUser(actor)) return false;
    if (hasRole(actor, "admin")) return true;
    if (actor.userId === subject.requestOwnerUserId) return true;
    if (subject.author.type === "user") {
      return actor.userId === subject.author.userId;
    }
    return subject.isOrgMember === true;
  });
}

if (!isPermissionDefined(P_RESPONSE_WRITE)) {
  definePermission<ResponseAuthorSubject>(P_RESPONSE_WRITE, (actor, subject) => {
    if (hasRole(actor, "admin")) return true;
    return isAuthor(actor, subject.author, subject.isOrgEditor);
  });
}

if (!isPermissionDefined(P_RESPONSE_MANAGE)) {
  definePermission<ResponseOwnerSubject>(P_RESPONSE_MANAGE, (actor, subject) => {
    if (!isUser(actor)) return false;
    return actor.userId === subject.requestOwnerUserId || hasRole(actor, "admin");
  });
}

/** Smí actor založit reakci za daného autora na danou poptávku? */
export function canCreateResponse(
  actor: Actor,
  subject: ResponseCreateSubject,
): boolean {
  return can(actor, P_RESPONSE_CREATE, subject);
}

/** Smí actor číst tuto reakci? */
export function canReadResponse(
  actor: Actor,
  subject: ResponseReadSubject,
): boolean {
  return can(actor, P_RESPONSE_READ, subject);
}

/** Smí actor reakci upravit (dokud `sent`) nebo stáhnout? */
export function canWriteResponse(
  actor: Actor,
  subject: ResponseAuthorSubject,
): boolean {
  return can(actor, P_RESPONSE_WRITE, subject);
}

/** Smí actor reakci spravovat (shortlist/přijmout/odmítnout)? */
export function canManageResponse(
  actor: Actor,
  subject: ResponseOwnerSubject,
): boolean {
  return can(actor, P_RESPONSE_MANAGE, subject);
}
