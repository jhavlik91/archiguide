/**
 * Rozpočtové pásmo pro filtr výpisu poptávek (T026 § Main flow 2). `Request.budget`
 * je volný text ("neuvedeno" je validní hodnota, §Validation napříč doménou) —
 * pásmo je proto vždy jen ORIENTAČNÍ odhad z prvního čísla v textu, ne přesný
 * dotaz nad strukturovanou částkou. Poptávka bez rozpoznatelného čísla do žádného
 * pásma nespadá (filtr ji vynechá, nespadne na chybu — stejný princip jako
 * ignorování neznámé hodnoty filtru profese).
 */

export const BUDGET_BANDS = [
  "under_200k",
  "200k_1m",
  "1m_5m",
  "over_5m",
] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const BUDGET_BAND_LABELS: Record<BudgetBand, string> = {
  under_200k: "do 200 000 Kč",
  "200k_1m": "200 000 – 1 000 000 Kč",
  "1m_5m": "1 000 000 – 5 000 000 Kč",
  over_5m: "nad 5 000 000 Kč",
};

/** Rozsah pásma v Kč. `max: null` = bez horní hranice. Dolní mez inkluzivní, horní ne. */
const BUDGET_BAND_RANGES: Record<BudgetBand, { min: number; max: number | null }> = {
  under_200k: { min: 0, max: 200_000 },
  "200k_1m": { min: 200_000, max: 1_000_000 },
  "1m_5m": { min: 1_000_000, max: 5_000_000 },
  over_5m: { min: 5_000_000, max: null },
};

/**
 * Vytáhne první číselnou hodnotu z volného textu rozpočtu (mezery/tečky jako
 * tisícové oddělovače, např. "cca 1 500 000 Kč" → 1500000). Text bez čísla
 * (včetně `null` = "neuvedeno") → `null` (do žádného pásma).
 */
export function extractBudgetAmount(budget: string | null): number | null {
  if (!budget) return null;
  const match = budget.match(/\d[\d\s.]*\d|\d/);
  if (!match) return null;
  const digits = match[0].replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** Spadá rozpočet (volný text) do daného pásma? Nerozpoznatelný text nikdy nespadá. */
export function matchesBudgetBand(
  budget: string | null,
  band: BudgetBand,
): boolean {
  const amount = extractBudgetAmount(budget);
  if (amount === null) return false;
  const range = BUDGET_BAND_RANGES[band];
  if (amount < range.min) return false;
  if (range.max !== null && amount >= range.max) return false;
  return true;
}
