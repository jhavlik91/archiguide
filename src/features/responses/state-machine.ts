/**
 * Stavový automat reakce na poptávku (T027, zadani/08 §4). Čistá vrstva (bez
 * DB) — jediný zdroj pravdy o povolených přechodech. Datová vrstva
 * (`service.ts`) sem chodí ověřit každý přechod; neplatný přechod se NIKDY
 * neprovede (§ States — „neplatné přechody server odmítne").
 *
 * Diagram:
 *   draft → sent → viewed → shortlisted → accepted
 *   sent → withdrawn
 *   viewed → rejected
 *   shortlisted → rejected | withdrawn
 *
 * Terminální stavy (`accepted`, `rejected`, `withdrawn`) už žádný přechod nemají.
 */

import type { ResponseStatus } from "./types";

/**
 * Pojmenované přechody. `mark_viewed` je systémový (nastaví se automaticky při
 * prvním zobrazení vlastníkem, main flow bod 3) — actor u něj je vždy `null`.
 */
export const RESPONSE_ACTIONS = [
  "send",
  "mark_viewed",
  "shortlist",
  "accept",
  "reject",
  "withdraw",
] as const;
export type ResponseAction = (typeof RESPONSE_ACTIONS)[number];

interface TransitionDef {
  /** Zdrojové stavy, ze kterých je přechod povolen. */
  readonly from: readonly ResponseStatus[];
  /** Cílový stav. */
  readonly to: ResponseStatus;
  /** Významný přechod → auditní záznam (§ States — „auditní záznam accept/reject"). */
  readonly audit: boolean;
}

/** Definice všech přechodů. Klíč = akce, hodnota = pravidlo. */
export const RESPONSE_TRANSITIONS: Record<ResponseAction, TransitionDef> = {
  send: { from: ["draft"], to: "sent", audit: false },
  mark_viewed: { from: ["sent"], to: "viewed", audit: false },
  shortlist: { from: ["viewed"], to: "shortlisted", audit: true },
  accept: { from: ["shortlisted"], to: "accepted", audit: true },
  reject: { from: ["viewed", "shortlisted"], to: "rejected", audit: true },
  withdraw: { from: ["sent", "shortlisted"], to: "withdrawn", audit: true },
} as const;

/** Terminální stavy — žádný další přechod. */
export const TERMINAL_RESPONSE_STATUSES: readonly ResponseStatus[] = [
  "accepted",
  "rejected",
  "withdrawn",
] as const;

/** Je stav terminální (reakce dál nepokračuje)? */
export function isTerminalResponseStatus(status: ResponseStatus): boolean {
  return TERMINAL_RESPONSE_STATUSES.includes(status);
}

/** Lze z daného stavu provést akci? */
export function canTransitionResponse(
  from: ResponseStatus,
  action: ResponseAction,
): boolean {
  return RESPONSE_TRANSITIONS[action].from.includes(from);
}

/**
 * Cílový stav akce z daného stavu, nebo `null` je-li přechod neplatný. Volající
 * (`service.ts`) na `null` reaguje odmítnutím.
 */
export function nextResponseStatus(
  from: ResponseStatus,
  action: ResponseAction,
): ResponseStatus | null {
  return canTransitionResponse(from, action)
    ? RESPONSE_TRANSITIONS[action].to
    : null;
}

/** Audituje se tento přechod? */
export function isAuditedResponseAction(action: ResponseAction): boolean {
  return RESPONSE_TRANSITIONS[action].audit;
}

/** Akce dostupné z daného stavu (bez ohledu na to, kdo je smí spustit). */
export function availableResponseActions(
  status: ResponseStatus,
): ResponseAction[] {
  return RESPONSE_ACTIONS.filter((action) =>
    canTransitionResponse(status, action),
  );
}

/**
 * Akce, které v UI iniciuje AUTOR reakce (profesionál/firma) — jen stažení.
 * `send` proběhne při odeslání formuláře (bez samostatného tlačítka na detailu).
 */
export function authorActions(status: ResponseStatus): ResponseAction[] {
  return availableResponseActions(status).filter((a) => a === "withdraw");
}

/**
 * Akce, které v UI iniciuje VLASTNÍK poptávky — shortlist/přijetí/odmítnutí.
 * `send`/`mark_viewed` jsou systémové; `withdraw` smí jen autor (`authorActions`).
 */
export function ownerResponseActions(status: ResponseStatus): ResponseAction[] {
  const notOwnerInitiated: ResponseAction[] = ["send", "mark_viewed", "withdraw"];
  return availableResponseActions(status).filter(
    (a) => !notOwnerInitiated.includes(a),
  );
}
