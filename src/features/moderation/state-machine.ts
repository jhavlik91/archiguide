/**
 * Stavový automat reportu (T036, zadani/12 §5). Čistá vrstva (bez DB) — jediný
 * zdroj pravdy o povolených přechodech. Datová vrstva (`service.ts`) sem chodí
 * ověřit každý přechod; neplatný přechod se NIKDY neprovede.
 *
 * Diagram (T036 § Main flow bod 3):
 *   open → triaged → under_review → actioned | dismissed
 *   actioned → appealed → closed
 *   dismissed → closed
 *
 * `actioned` nemá jiný odchozí přechod než přes `appeal` (odvolání) — plné
 * appeals UI je mimo MVP scope (T036 § Out of scope), stav a přechod ale
 * existují a jsou pokryté testy.
 */

import type { ReportState } from "./types";

export const REPORT_ACTIONS = [
  "triage",
  "start_review",
  "dismiss",
  "resolve",
  "appeal",
  "close",
] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

interface TransitionDef {
  readonly from: readonly ReportState[];
  readonly to: ReportState;
}

export const REPORT_TRANSITIONS: Record<ReportAction, TransitionDef> = {
  triage: { from: ["open"], to: "triaged" },
  start_review: { from: ["open", "triaged"], to: "under_review" },
  dismiss: { from: ["open", "triaged", "under_review"], to: "dismissed" },
  resolve: { from: ["open", "triaged", "under_review"], to: "actioned" },
  appeal: { from: ["actioned"], to: "appealed" },
  close: { from: ["dismissed", "appealed"], to: "closed" },
} as const;

/** Terminální stavy — žádný další přechod (§5: `closed` je konečný). */
export const TERMINAL_STATES: readonly ReportState[] = ["closed"];

export function isTerminalState(state: ReportState): boolean {
  return TERMINAL_STATES.includes(state);
}

/** Lze z daného stavu provést akci? */
export function canTransition(
  from: ReportState,
  action: ReportAction,
): boolean {
  return REPORT_TRANSITIONS[action].from.includes(from);
}

/** Cílový stav akce z daného stavu, nebo `null` je-li přechod neplatný. */
export function nextReportState(
  from: ReportState,
  action: ReportAction,
): ReportState | null {
  return canTransition(from, action) ? REPORT_TRANSITIONS[action].to : null;
}

/**
 * Je stav "nevyřešený" — nový report na stejný cíl se do něj PŘIPOJÍ místo
 * založení nového (T036 § Alternative flows a § Edge cases).
 */
export function isUnresolvedState(state: ReportState): boolean {
  return state === "open" || state === "triaged" || state === "under_review";
}
