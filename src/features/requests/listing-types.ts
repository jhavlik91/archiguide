/**
 * Sdílené typy veřejného výpisu poptávek (T026). Čistý modul (bez DB/`next/*`),
 * použitelný jak v service, tak v klientských komponentách filtrů.
 */

import type { BudgetBand } from "./budget-band";
import type { RequestType } from "./types";

/** Kolik karet na stránku (cursor stránkování, stejně jako katalog profesionálů T034). */
export const REQUEST_LISTING_PAGE_SIZE = 12;

/**
 * Normalizovaný stav filtrů odvozený z URL (sdílitelný, SEO — §Main flow 2).
 * Neznámé/prázdné hodnoty jsou `null` už při parsování (§ Validation).
 */
export interface RequestListingState {
  profession: string | null;
  region: string | null;
  type: RequestType | null;
  budgetBand: BudgetBand | null;
  /** Neprůhledný kurzor pro další stránku, nebo `null` (první stránka). */
  cursor: string | null;
}

/** Anonymizovaná karta ve výpisu — jen povolená pole (T025 §20.2), profese už rozřešené na názvy. */
export interface RequestListingCard {
  id: string;
  type: RequestType;
  title: string;
  professionNames: string[];
  region: string;
  budget: string | null;
  timeline: string | null;
  deadline: string | null;
  publishedAt: string;
}

export interface RequestListingResult {
  cards: RequestListingCard[];
  /** Kurzor další stránky, nebo `null`, když už žádná další není. */
  nextCursor: string | null;
}

/** Je nastavený jakýkoli filtr? (řídí `request_list_filtered` analytiku a empty-state nabídky.) */
export function hasActiveRequestFilters(state: RequestListingState): boolean {
  return Boolean(
    state.profession || state.region || state.type || state.budgetBand,
  );
}
