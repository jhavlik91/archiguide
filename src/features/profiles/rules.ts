/**
 * Čistá doménová pravidla profilu (T007). Bez DB a bez `next/*`, aby se dala
 * pokrýt unit testy a sdílet mezi service vrstvou, akcemi i UI.
 */

import type { ProfessionLink } from "./types";

/**
 * Znormalizuje výběr profesí tak, aby měl právě jednu hlavní profesi:
 * - deduplikuje podle `professionId` (zachová první výskyt),
 * - pokud je označeno víc hlavních, ponechá první a ostatní zvedne na vedlejší,
 * - pokud není označená žádná a seznam je neprázdný, hlavní se stane první.
 *
 * Prázdný vstup vrací prázdný výstup (profil zatím bez profese je validní draft).
 */
export function normalizeProfessionLinks(
  links: readonly ProfessionLink[],
): ProfessionLink[] {
  const seen = new Set<string>();
  const deduped: ProfessionLink[] = [];
  for (const link of links) {
    if (seen.has(link.professionId)) continue;
    seen.add(link.professionId);
    deduped.push({ ...link });
  }
  if (deduped.length === 0) return deduped;

  const firstPrimaryIndex = deduped.findIndex((l) => l.isPrimary);
  const primaryIndex = firstPrimaryIndex === -1 ? 0 : firstPrimaryIndex;
  return deduped.map((link, index) => ({
    ...link,
    isPrimary: index === primaryIndex,
  }));
}

/** Hlavní profese z výběru, nebo `null`. */
export function resolvePrimary(
  links: readonly ProfessionLink[],
): ProfessionLink | null {
  return links.find((l) => l.isPrimary) ?? null;
}

/**
 * Smí profil aktivovat „přijímám poptávky"? Podmínka: alespoň jedna profese
 * (viz T007 § Validation a Acceptance criteria). Nezávislé na stavu publikace.
 */
export function canAcceptRequests(professionCount: number): boolean {
  return professionCount >= 1;
}

/** Chybí profilu něco k publikaci? Vrací seznam důvodů (prázdný = lze publikovat). */
export function publishBlockers(input: {
  headline: string | null | undefined;
  professionCount: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.headline || input.headline.trim().length === 0) {
    blockers.push("Doplňte titulek profilu.");
  }
  if (input.professionCount < 1) {
    blockers.push("Vyberte alespoň jednu profesi.");
  }
  return blockers;
}

/** Lze profil publikovat? (žádné blokery) */
export function canPublish(input: {
  headline: string | null | undefined;
  professionCount: number;
}): boolean {
  return publishBlockers(input).length === 0;
}
