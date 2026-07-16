/**
 * Stavový automat recenze (T037, zadani/08 §6). Čistá vrstva (bez DB) —
 * jediný zdroj pravdy o povolených přechodech. Datová vrstva (`service.ts`)
 * sem chodí ověřit každý přechod; neplatný přechod se NIKDY neprovede.
 *
 * Diagram (§ Main flow bod 4):
 *   published → disputed (hodnocený podá spor)
 *   disputed → published (moderátor spor zamítne — recenze zůstává)
 *   published | disputed → hidden (moderátor skryje — ať šlo o spor, nebo
 *     obecné nahlášení, např. vydírání, § Edge cases)
 *   hidden → published (moderátor obnoví viditelnost)
 *
 * `eligible`/`submitted`/`moderation_pending` ze spec diagramu NEJSOU
 * perzistované DB stavy (viz `types.ts` — MVP nemá gating krok mezi odesláním
 * a zveřejněním; recenze vzniká rovnou jako `published`).
 */

import type { ReviewStatus } from "./types";

export const REVIEW_ACTIONS = [
  "dispute",
  "resolve_dismiss",
  "resolve_hide",
  "restore",
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

interface TransitionDef {
  readonly from: readonly ReviewStatus[];
  readonly to: ReviewStatus;
}

export const REVIEW_TRANSITIONS: Record<ReviewAction, TransitionDef> = {
  dispute: { from: ["published"], to: "disputed" },
  resolve_dismiss: { from: ["disputed"], to: "published" },
  resolve_hide: { from: ["published", "disputed"], to: "hidden" },
  restore: { from: ["hidden"], to: "published" },
} as const;

/** Lze z daného stavu provést akci? */
export function canTransitionReview(
  from: ReviewStatus,
  action: ReviewAction,
): boolean {
  return REVIEW_TRANSITIONS[action].from.includes(from);
}

/** Cílový stav akce z daného stavu, nebo `null` je-li přechod neplatný. */
export function nextReviewStatus(
  from: ReviewStatus,
  action: ReviewAction,
): ReviewStatus | null {
  return canTransitionReview(from, action)
    ? REVIEW_TRANSITIONS[action].to
    : null;
}

/**
 * Počítá se recenze do průměru a je veřejná? Jen `hidden` se vyřadí (§
 * acceptance criteria — „skrytá recenze se nepočítá do průměru a není
 * veřejná"); `disputed` zůstává veřejná s příznakem (main flow bod 6).
 */
export function isPubliclyVisible(status: ReviewStatus): boolean {
  return status !== "hidden";
}
