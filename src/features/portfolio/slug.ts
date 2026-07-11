/**
 * Generování veřejného slugu portfolio díla (T016). Čistá vrstva (bez DB) —
 * uniqueness proti databázi řeší service. Slug vzniká z titulku díla při první
 * publikaci a dál se nemění, aby veřejný odkaz `/projekt/[slug]` zůstal stabilní.
 */

/** Maximální délka slug rootu (bez případného sufixu pro unikátnost). */
export const SLUG_MAX_LENGTH = 60;

/** Fallback, když z titulku nezbude žádný použitelný znak (např. jen emoji). */
export const SLUG_FALLBACK = "projekt";

/**
 * Převede text na URL-safe slug: odstraní diakritiku (NFKD), zmenší písmena,
 * nealfanumerické znaky nahradí pomlčkou a ořízne na `SLUG_MAX_LENGTH`. Prázdný
 * výsledek → `SLUG_FALLBACK`, aby slug nikdy nebyl prázdný.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // pryč s diakritikou (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, ""); // ořez nemohl nechat pomlčku na konci
  return base.length > 0 ? base : SLUG_FALLBACK;
}

/**
 * Vrátí slug spojený z rootu a sufixu (pro odlišení duplicit). Sufix se přidává,
 * jen když je neprázdný, aby první (nejpěknější) varianta neměla zbytečně ocásek.
 */
export function withSuffix(root: string, suffix: string): string {
  return suffix.length > 0 ? `${root}-${suffix}` : root;
}
