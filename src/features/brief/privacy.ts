/**
 * Detekce osobních údajů ve volném textu briefu (T022, zadani/12 §8). Čistá
 * heuristika (bez DB / `next/*`), plně pokrytá unit testy. Používá se při
 * PRVNÍM sdílení: pokud text obsahuje vzor přesné adresy / telefonu / e-mailu,
 * UI zobrazí explicitní varování — ale sdílení NEBLOKUJE (rozhodnutí je na
 * uživateli, zadani/12 §8).
 *
 * Cílem není dokonalý PII scanner (to je nemožné), ale zachytit typické případy,
 * kdy klient vepíše přesnou adresu/kontakt do textového pole, které se pak
 * rozešle. Falešně pozitivní nález je přijatelný (jen varuje), falešně negativní
 * je horší — heuristiky proto míří spíš na citlivost.
 */

/** Kategorie nalezeného osobního údaje. */
export type PrivacyWarningKind = "address" | "phone" | "email";

/** E-mail — běžný tvar `local@domain.tld`. */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/**
 * Telefon — 9 číslic (české číslo) volitelně s předvolbou `+420`/`00420` a
 * mezerami/pomlčkami mezi trojicemi. Vyžaduje hranici, aby se nechytalo uvnitř
 * delších čísel (např. částka „1200000").
 */
const PHONE_RE = /(?<!\d)(?:(?:\+|00)420[\s-]?)?(?:\d[\s-]?){8}\d(?!\d)/;

/** PSČ — `123 45` nebo `12345` (tři + dvě číslice). */
const POSTAL_RE = /(?<!\d)\d{3}\s?\d{2}(?!\d)/;

/**
 * Číslo popisné/orientační — `12/3`, `12b`, případně jen samostatné číslo domu
 * za názvem ulice. Bereme tvar „slovo … číslo" jen ve spojení s indikátorem
 * ulice/adresy, aby se nechytal každý „rozsah 120 m2".
 */
const HOUSE_NUMBER_RE = /(?<!\d)\d{1,4}\s?\/\s?\d{1,4}[a-z]?(?!\d)/i;

/**
 * Indikátory adresy — slova typicky uvozující ulici/adresu. Kombinace
 * indikátoru + čísla je silný signál přesné adresy.
 */
const STREET_HINT_RE =
  /(ulic\w*|ul\.|náměst\w*|nám\.|nábřež\w*|tříd\w*|tř\.|č\.\s?p\.|čp\.|č\.\s?or\.|sídlišt\w*)/i;

/** Obsahuje text vzor přesné adresy? (PSČ, číslo popisné, nebo ulice + číslo.) */
function looksLikeAddress(text: string): boolean {
  if (POSTAL_RE.test(text)) return true;
  if (HOUSE_NUMBER_RE.test(text)) return true;
  // Název ulice/indikátor následovaný číslem (např. „Dlouhá 5", „ulice Krátká 12").
  if (STREET_HINT_RE.test(text) && /\d/.test(text)) return true;
  return false;
}

/**
 * Projde zadané textové útržky a vrátí SET nalezených kategorií osobních údajů.
 * Prázdné pole = žádné varování. Pořadí výstupu je stabilní (address, phone,
 * email) kvůli deterministickým testům i UI.
 */
export function detectPrivacyWarnings(
  texts: readonly (string | null | undefined)[],
): PrivacyWarningKind[] {
  const joined = texts.filter((t): t is string => Boolean(t)).join("\n");
  const found: PrivacyWarningKind[] = [];
  if (looksLikeAddress(joined)) found.push("address");
  if (PHONE_RE.test(joined)) found.push("phone");
  if (EMAIL_RE.test(joined)) found.push("email");
  return found;
}

/** Lidsky čitelný popis varování (čeština) pro UI. */
export const PRIVACY_WARNING_LABELS: Record<PrivacyWarningKind, string> = {
  address: "přesná adresa",
  phone: "telefonní číslo",
  email: "e-mailová adresa",
};
