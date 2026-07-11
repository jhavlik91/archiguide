/**
 * Čistá doménová pravidla portfolia (T012). Bez DB a bez `next/*`, aby se dala
 * pokrýt unit testy a sdílet mezi service vrstvou, akcemi i UI.
 *
 * Pokrývá: podmínky publikace (draft → published), životní cyklus spoluautora
 * (kdo se veřejně zobrazí, na co lze reagovat) a rozsah roku realizace.
 * Oprávnění vázaná na `Actor` (systémová / firemní role) žijí v `permissions.ts`.
 */

import {
  YEAR_MIN,
  YEAR_MAX_OFFSET,
  type PortfolioCoauthorStatus,
  type PortfolioStatus,
} from "./types";

/** Horní hranice roku realizace (aktuální rok + rezerva na plánovaná díla). */
export function yearMax(now: Date = new Date()): number {
  return now.getFullYear() + YEAR_MAX_OFFSET;
}

/** Je rok v rozumném rozsahu? `null`/`undefined` je validní (pole je volitelné). */
export function isYearInRange(
  year: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (year === null || year === undefined) return true;
  return Number.isInteger(year) && year >= YEAR_MIN && year <= yearMax(now);
}

/** Má dílo titul? Prázdný/whitespace titul se nepočítá. */
export function hasTitle(title: string | null | undefined): boolean {
  return typeof title === "string" && title.trim().length > 0;
}

/**
 * Lze projekt publikovat? Vyžaduje titul a alespoň jeden blok obsahu
 * (T012 § Validation; počet bloků dodá T013 API). `hasContent` je vstupem, aby
 * pravidlo zůstalo čisté — počítání bloků řeší service vrstva přes seam na T013.
 */
export function canPublish(input: {
  title: string | null | undefined;
  hasContent: boolean;
}): boolean {
  return hasTitle(input.title) && input.hasContent;
}

/**
 * Je stav projektu terminální pro editaci? `archived` projekt (měkce zrušený
 * životní cyklus) se needituje ani nepublikuje — nejdřív se musí obnovit.
 */
export function isEditableStatus(status: PortfolioStatus): boolean {
  return status === "draft" || status === "published";
}

// --- Spoluautoři ------------------------------------------------------------

/**
 * Zobrazí se spoluautor na veřejné verzi? Jen po potvrzení. Nepotvrzený
 * (`invited`) ani odmítnutý (`declined`) se neukáže (zadani/16 §7).
 */
export function isCoauthorPubliclyVisible(
  status: PortfolioCoauthorStatus,
): boolean {
  return status === "confirmed";
}

/**
 * Může pozvaný na pozvánku reagovat (potvrdit/odmítnout)? Reagovat lze z
 * jakéhokoli stavu (potvrzení lze i odvolat = přepnout confirmed → declined a
 * zpět), takže vždy `true`. Ponecháno jako pravidlo pro čitelnost a budoucí
 * omezení (např. po smazání projektu).
 */
export function canRespondToCoauthorInvite(): boolean {
  return true;
}

/**
 * Cílový stav odpovědi spoluautora. `accept` → confirmed, `decline` → declined.
 * Odvolání souhlasu je `decline` nad již potvrzeným řádkem.
 */
export function coauthorResponseStatus(
  response: "accept" | "decline",
): PortfolioCoauthorStatus {
  return response === "accept" ? "confirmed" : "declined";
}
