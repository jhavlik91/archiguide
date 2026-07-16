/**
 * Oprávnění domény hodnocení (T037). Registrují se přes `definePermission` při
 * načtení modulu (side-effect import v actions/service). Čistá vrstva (bez
 * DB) — rozhoduje jen nad `Actor` a předaným předmětem; eligibilitu (accepted
 * interakce, duplicita) ověřuje až datová vrstva (`service.ts`), sem chodí
 * jen jako předpočítaný boolean.
 *
 * Pravidla (zadani/05 — „Vytvořit recenzi": N | C | C | C | C | C | N | Y):
 *  - VYTVOŘIT recenzi smí jen vlastník poptávky s ověřenou interakcí
 *    (eligibilita), bez ohledu na to, kterou roli zrovna má — NE moderátor
 *    bez další role. Admin vždy.
 *  - ODPOVĚDĚT a ROZPOROVAT smí jen hodnocený (cíl recenze — profesionál sám,
 *    nebo org editor+ u firmy). Zadani/05 — „Moderovat recenzi" je oddělené
 *    oprávnění (T036, moderátor/admin), sem nepatří.
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
import type { ReviewTargetRef } from "./types";

/** Je actor „pouze moderátor" (bez klient/profík/admin role)? Ten nehodnotí. */
function isModeratorOnly(actor: Actor): boolean {
  return (
    hasRole(actor, "moderator") &&
    !hasAnyRole(actor, "client", "professional", "admin")
  );
}

/** Je actor cílem recenze (hodnocený profesionál, nebo org editor+ u firmy)? */
function isTarget(
  actor: Actor,
  target: ReviewTargetRef,
  isOrgEditor?: boolean,
): boolean {
  if (target.type === "professional") {
    return isUser(actor) && actor.userId === target.userId;
  }
  return isOrgEditor === true;
}

/** Předmět založení recenze: kdo je vlastník poptávky + předpočítaná eligibilita. */
export interface ReviewCreateSubject {
  requestOwnerUserId: string;
  /** Accepted interakce existuje a dosud nemá recenzi (service ověřil). */
  isEligible: boolean;
}

/** Předmět akcí vázaných na cíl recenze (odpověď, spor). */
export interface ReviewTargetSubject {
  target: ReviewTargetRef;
  isOrgEditor?: boolean;
}

export const P_REVIEW_CREATE = "reviews.create";
export const P_REVIEW_REPLY = "reviews.reply";
export const P_REVIEW_DISPUTE = "reviews.dispute";

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_REVIEW_CREATE)) {
  definePermission<ReviewCreateSubject>(P_REVIEW_CREATE, (actor, subject) => {
    if (!isUser(actor)) return false; // návštěvník NIKDY
    if (hasRole(actor, "admin")) return true;
    if (isModeratorOnly(actor)) return false;
    return actor.userId === subject.requestOwnerUserId && subject.isEligible;
  });
}

if (!isPermissionDefined(P_REVIEW_REPLY)) {
  definePermission<ReviewTargetSubject>(P_REVIEW_REPLY, (actor, subject) => {
    if (hasRole(actor, "admin")) return true;
    return isTarget(actor, subject.target, subject.isOrgEditor);
  });
}

if (!isPermissionDefined(P_REVIEW_DISPUTE)) {
  definePermission<ReviewTargetSubject>(P_REVIEW_DISPUTE, (actor, subject) => {
    if (hasRole(actor, "admin")) return true;
    return isTarget(actor, subject.target, subject.isOrgEditor);
  });
}

/** Smí actor založit recenzi za daných podmínek? */
export function canCreateReview(
  actor: Actor,
  subject: ReviewCreateSubject,
): boolean {
  return can(actor, P_REVIEW_CREATE, subject);
}

/** Smí actor na recenzi odpovědět (§36.3 — právo na reakci)? */
export function canReplyToReview(
  actor: Actor,
  subject: ReviewTargetSubject,
): boolean {
  return can(actor, P_REVIEW_REPLY, subject);
}

/** Smí actor recenzi rozporovat (main flow bod 6)? */
export function canDisputeReview(
  actor: Actor,
  subject: ReviewTargetSubject,
): boolean {
  return can(actor, P_REVIEW_DISPUTE, subject);
}
