/**
 * Sdílené typy a číselníky matching enginu (T028).
 *
 * Hodnoty enumu `MatchRecommendationStatus` zrcadlí `prisma/schema.prisma` —
 * jediný zdroj pravdy pro stavový automat (`status.ts`) i UI popisky. Modul je
 * čistý (bez DB / `next/*`), aby ho šlo použít i v klientských komponentách
 * (budoucí T029) a plně pokrýt unit testy.
 */

export const MATCH_RECOMMENDATION_STATUSES = [
  "new",
  "shown",
  "shortlisted",
  "dismissed",
] as const;
export type MatchRecommendationStatus =
  (typeof MATCH_RECOMMENDATION_STATUSES)[number];

/**
 * Typ strukturovaného důvodu doporučení (§ Main flow). `profession_match`,
 * `region` a `similar_projects` jsou doslova z tasku; `specialization` a
 * `limited_availability` doplňují stejný tvar pro kritéria, která task žádá
 * samostatně skórovat/vysvětlit (§ Main flow bod 2, § Edge cases — omezená
 * dostupnost se MUSÍ v důvodu objevit, i když doporučení nevylučuje).
 */
export const MATCH_REASON_TYPES = [
  "profession_match",
  "specialization",
  "region",
  "similar_projects",
  "limited_availability",
] as const;
export type MatchReasonType = (typeof MATCH_REASON_TYPES)[number];

/** Jeden strukturovaný, strojově čitelný důvod doporučení. */
export interface MatchReason {
  type: MatchReasonType;
  /** Lidsky čitelný detail (UI z něj skládá větu, § Main flow bod 3). */
  detail: string;
}

/** Kompletní náhled doporučení (řádek `MatchRecommendation`). */
export interface MatchRecommendationView {
  id: string;
  requestId: string;
  candidateUserId: string;
  /** Interní pořadové skóre — NIKDY nevystavovat jako procento (zadani/16 §5). */
  score: number;
  reasons: MatchReason[];
  status: MatchRecommendationStatus;
  sponsored: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Kód prázdného výsledku (§ Alternative flows — prázdný výsledek MUSÍ nést
 * explicitní důvod, nikdy jen `[]`). Lidský text si z kódu skládá UI (T029),
 * stejně jako `RequestActionResult` v `features/requests`.
 */
export const EMPTY_MATCH_REASONS = ["no_eligible_professionals"] as const;
export type EmptyMatchReason = (typeof EMPTY_MATCH_REASONS)[number];
