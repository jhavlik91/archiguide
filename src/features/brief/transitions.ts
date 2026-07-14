/**
 * Stavový automat briefu (T022) — jediný zdroj pravdy o povolených přechodech
 * (zadani/08 §2). Čistý modul (bez DB / `next/*`), plně pokrytý unit testy;
 * service ho volá před každou změnou stavu a neplatný přechod odmítne.
 *
 * Graf (zadani/08 §2):
 *   draft → ready
 *   draft → archived
 *   ready → shared
 *   shared → revised
 *   revised → shared
 *
 * „Sdílení" a „editace" nejsou samostatné hrany, ale mapují se na tento graf:
 *  - SDÍLENÍ vede vždy do `shared`. Z `draft` projde přes `ready` (dvoukrokově),
 *    z `ready` a `revised` napřímo → viz `shareableFrom`.
 *  - EDITACE sdíleného briefu ho posune `shared → revised` (živý obsah se
 *    rozešel se sdíleným snapshotem); v ostatních stavech stav nemění.
 */

import type { BriefStatus } from "./types";

/** Povolené cílové stavy z daného stavu (zadani/08 §2). */
const TRANSITIONS: Record<BriefStatus, readonly BriefStatus[]> = {
  draft: ["ready", "archived"],
  ready: ["shared"],
  shared: ["revised"],
  revised: ["shared"],
  archived: [],
};

/** Je přechod `from → to` povolený? (Identita `from === to` je no-op = povoleno.) */
export function canTransition(from: BriefStatus, to: BriefStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Stavy, ze kterých lze brief (znovu) sdílet. `draft` a `ready` = první sdílení,
 * `revised` = opětovné sdílení po úpravě (revidovaný snapshot se zmrazí znovu).
 * `shared` už sdílený je (re-share bez úpravy je no-op), `archived` nikoli.
 */
const SHAREABLE_FROM: readonly BriefStatus[] = ["draft", "ready", "revised"];

export function isShareableFrom(status: BriefStatus): boolean {
  return SHAREABLE_FROM.includes(status);
}

/**
 * Cílový stav po EDITACI obsahu. Sdílený brief se posune do `revised` (živý obsah
 * se rozešel se snapshotem, který mají příjemci); jinak stav zůstává.
 */
export function statusAfterEdit(current: BriefStatus): BriefStatus {
  return current === "shared" ? "revised" : current;
}

/** Lze brief archivovat? (Jen `draft → archived` dle zadani/08 §2.) */
export function isArchivableFrom(status: BriefStatus): boolean {
  return canTransition(status, "archived");
}
