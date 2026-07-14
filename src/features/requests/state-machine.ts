/**
 * Stavový automat poptávky (T024, zadani/08 §3). Čistá vrstva (bez DB) — jediný
 * zdroj pravdy o povolených přechodech. Datová vrstva (`service.ts`) sem chodí
 * ověřit každý přechod; neplatný přechod se NIKDY neprovede (§ Stavová pravidla).
 *
 * Diagram:
 *   draft → active → in_discussion → awarded → closed
 *   active → paused → active
 *   active → cancelled | expired
 *   in_discussion → cancelled
 *   paused → cancelled   (zrušení pozastavené / smazání účtu — zadani/09)
 *
 * Terminální stavy (`closed`, `cancelled`, `expired`) už žádný přechod nemají.
 */

import type { RequestStatus } from "./types";

/** Pojmenované přechody. `start_discussion` spouští příchod reakce (T027). */
export const REQUEST_ACTIONS = [
  "publish",
  "start_discussion",
  "pause",
  "resume",
  "award",
  "close",
  "cancel",
  "expire",
] as const;
export type RequestAction = (typeof REQUEST_ACTIONS)[number];

interface TransitionDef {
  /** Zdrojové stavy, ze kterých je přechod povolen. */
  readonly from: readonly RequestStatus[];
  /** Cílový stav. */
  readonly to: RequestStatus;
  /**
   * Významný přechod → auditní záznam (zadani/08 § Stavová pravidla). Všechny
   * stavové přechody poptávky auditujeme (append-only historie).
   */
  readonly audit: boolean;
}

/** Definice všech přechodů. Klíč = akce, hodnota = pravidlo. */
export const REQUEST_TRANSITIONS: Record<RequestAction, TransitionDef> = {
  publish: { from: ["draft"], to: "active", audit: true },
  start_discussion: { from: ["active"], to: "in_discussion", audit: true },
  pause: { from: ["active"], to: "paused", audit: true },
  resume: { from: ["paused"], to: "active", audit: true },
  award: { from: ["in_discussion"], to: "awarded", audit: true },
  close: { from: ["awarded"], to: "closed", audit: true },
  cancel: {
    from: ["active", "in_discussion", "paused"],
    to: "cancelled",
    audit: true,
  },
  expire: { from: ["active"], to: "expired", audit: true },
} as const;

/** Terminální stavy — žádný další přechod. */
export const TERMINAL_STATUSES: readonly RequestStatus[] = [
  "closed",
  "cancelled",
  "expired",
] as const;

/** Je stav terminální (poptávka dál nepokračuje)? */
export function isTerminalStatus(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Lze z daného stavu provést akci? */
export function canTransition(
  from: RequestStatus,
  action: RequestAction,
): boolean {
  return REQUEST_TRANSITIONS[action].from.includes(from);
}

/**
 * Cílový stav akce z daného stavu, nebo `null` je-li přechod neplatný. Volající
 * (`service.ts`) na `null` reaguje odmítnutím — server nikdy neplatný přechod
 * neprovede.
 */
export function nextStatus(
  from: RequestStatus,
  action: RequestAction,
): RequestStatus | null {
  return canTransition(from, action) ? REQUEST_TRANSITIONS[action].to : null;
}

/** Audituje se tento přechod? */
export function isAuditedAction(action: RequestAction): boolean {
  return REQUEST_TRANSITIONS[action].audit;
}

/**
 * Akce dostupné z daného stavu. `start_discussion`/`expire` jsou systémové
 * (spouští je reakce / job), proto je z nabídky pro vlastníka vyloučíme.
 */
export function availableActions(status: RequestStatus): RequestAction[] {
  return REQUEST_ACTIONS.filter((action) => canTransition(status, action));
}

/** Akce, které v UI iniciuje vlastník (bez systémových `start_discussion`/`expire`). */
export function ownerActions(status: RequestStatus): RequestAction[] {
  const systemOnly: RequestAction[] = ["start_discussion", "expire"];
  return availableActions(status).filter((a) => !systemOnly.includes(a));
}
