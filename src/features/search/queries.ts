import "server-only";

import { getCategoryTree } from "@/features/taxonomy";
import type { ProfessionGroup } from "./components/search-filters";

/**
 * Čtecí pomůcky vyhledávání pro stránku (T034). Profese pro filtr bere z
 * taxonomie (T005) — jediný zdroj pravdy, žádný hardcode profesí (zadani/16 §11).
 */

/** Profese seskupené po kategoriích pro select filtru (jen aktivní). */
export async function getProfessionGroups(): Promise<ProfessionGroup[]> {
  const tree = await getCategoryTree();
  return tree
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      professions: category.professions.map((p) => ({
        slug: p.slug,
        name: p.name,
      })),
    }))
    .filter((group) => group.professions.length > 0);
}

/** Množina platných slugů profesí — pro zahození neznámého filtru (§ Validation). */
export function collectProfessionSlugs(groups: ProfessionGroup[]): Set<string> {
  return new Set(groups.flatMap((g) => g.professions.map((p) => p.slug)));
}
