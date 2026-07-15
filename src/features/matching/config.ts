/**
 * Váhy skórovacích kritérií matching enginu (T028 § Main flow bod 2: „Váhy v
 * konfiguraci, ne hardcode"). Centralizováno na jednom místě, aby ladění
 * relevance nevyžadovalo zásah do `scoring.ts`. Hodnoty jsou v MVP staticky
 * dané konstanty (žádný admin UI pro ladění — mimo scope T028).
 */

export const MATCH_WEIGHTS = {
  /** Shoda na HLAVNÍ profesi kandidáta. */
  professionPrimary: 40,
  /** Shoda jen na vedlejší profesi kandidáta. */
  professionSecondary: 25,
  /** Specializace kandidáta odpovídá typu projektu poptávky. */
  specializationMatch: 15,
  /** Lokalita/region působnosti kandidáta odpovídá regionu poptávky. */
  regionMatch: 20,
  /** Kandidát má publikované portfolio odpovídající typu projektu poptávky. */
  similarProjectsMatch: 15,
  /** Bonus za jakékoliv publikované portfolio (i bez shody typu). */
  publishedPortfolioBonus: 5,
  /** Bonus za ověřený kontakt (telefon/e-mail, T011). */
  verifiedBonus: 5,
  /**
   * Omezená dostupnost — penalizuje, ale NEVYLUČUJE kandidáta (§ Edge cases:
   * „skvělé portfolio, nulová dostupnost → doporučit lze").
   */
  limitedAvailabilityPenalty: -10,
  /** Nulová dostupnost — silnější penalizace, stále NEVYLUČUJE. */
  unavailablePenalty: -20,
} as const;

/**
 * Deterministický tie-break dle kompletnosti profilu (§ Alternative flows:
 * „příliš mnoho rovnocenných → stabilní řazení dle kompletnosti, ne náhodně").
 * Kompletnost je celé číslo 0..9 bodů — násobek je záměrně o řády menší než
 * nejmenší reálná váha, aby tie-break NIKDY nepřevážil skutečnou shodu.
 */
export const COMPLETENESS_TIE_BREAK_EPSILON = 0.01;
