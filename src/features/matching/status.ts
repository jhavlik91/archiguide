/**
 * Stavový automat doporučení (T028 § States, rozšířeno T029 § Main flow bod 4
 * — „dismiss je vratný"). Čistá vrstva (bez DB) — jediný zdroj pravdy o
 * povolených přechodech. Datová vrstva (`service.ts`) sem chodí ověřit každý
 * přechod; neplatný přechod se NIKDY neprovede.
 *
 * Diagram: `new → shown → shortlisted | dismissed`, `dismissed → shown`
 * (obnovení skrytého — jediný zpětný přechod v MVP). `shortlisted` zůstává
 * terminální — shortlist se v tasku nikdy neruší, jen dismiss.
 */

import type { MatchRecommendationStatus } from "./types";

/** Definice povolených přechodů. Klíč = zdrojový stav, hodnota = cílové stavy. */
export const MATCH_STATUS_TRANSITIONS: Record<
  MatchRecommendationStatus,
  readonly MatchRecommendationStatus[]
> = {
  new: ["shown"],
  shown: ["shortlisted", "dismissed"],
  shortlisted: [],
  dismissed: ["shown"],
};

/** Terminální stavy — žádný další přechod. */
export const TERMINAL_MATCH_STATUSES: readonly MatchRecommendationStatus[] = [
  "shortlisted",
];

/** Je stav terminální? */
export function isTerminalMatchStatus(
  status: MatchRecommendationStatus,
): boolean {
  return TERMINAL_MATCH_STATUSES.includes(status);
}

/** Lze z daného stavu přejít do cílového? */
export function canTransitionMatchStatus(
  from: MatchRecommendationStatus,
  to: MatchRecommendationStatus,
): boolean {
  return MATCH_STATUS_TRANSITIONS[from].includes(to);
}
