/**
 * Návrhy dalších kroků pro prázdný výsledek (T034 § Main flow #6, `zadani/07`).
 * Čistá logika — z aktuálního stavu a příbuzných profesí poskládá konkrétní
 * akce (odebrat filtr, rozšířit region, zkusit příbuznou profesi), aby uživatel
 * nikdy neskončil ve slepé uličce. UI je jen vykreslí jako odkazy.
 */

import { hasActiveCriteria } from "./params";
import type { SearchState } from "./types";

export type EmptySuggestion =
  /** Odebere jeden filtr (ponechá zbytek dotazu/filtrů). */
  | {
      kind: "remove_filter";
      filter: "region" | "specialization" | "verified" | "profession";
      label: string;
    }
  /** Zkusí příbuznou profesi (nahradí filtr profese). */
  | { kind: "related_profession"; slug: string; name: string; label: string }
  /** Zahodí vše a zobrazí celý katalog. */
  | { kind: "browse_all"; label: string };

/** Příbuzná profese nabídnutá při prázdném výsledku (z taxonomie T005). */
export type RelatedProfession = { slug: string; name: string };

/**
 * Sestaví konkrétní návrhy pro prázdný výsledek. `relatedProfessions` dodá
 * service vrstva z taxonomie (shoda dotazu na synonyma / sourozenci vybrané
 * profese). Pořadí = od nejmenšího zásahu (odebrat 1 filtr) po „zobrazit vše".
 */
export function buildEmptySuggestions(
  state: SearchState,
  relatedProfessions: RelatedProfession[] = [],
): EmptySuggestion[] {
  const out: EmptySuggestion[] = [];

  if (state.verifiedOnly) {
    out.push({
      kind: "remove_filter",
      filter: "verified",
      label: "Zahrnout i neověřené účty",
    });
  }
  if (state.region) {
    out.push({
      kind: "remove_filter",
      filter: "region",
      label: `Hledat ve všech regionech (bez „${state.region}")`,
    });
  }
  if (state.specialization) {
    out.push({
      kind: "remove_filter",
      filter: "specialization",
      label: `Odebrat specializaci „${state.specialization}"`,
    });
  }

  for (const p of relatedProfessions) {
    out.push({
      kind: "related_profession",
      slug: p.slug,
      name: p.name,
      label: `Zkusit příbuznou profesi: ${p.name}`,
    });
  }

  if (state.profession) {
    out.push({
      kind: "remove_filter",
      filter: "profession",
      label: "Zrušit filtr profese",
    });
  }

  // Poslední záchrana: zobrazit celý katalog (jen když nějaká kritéria byla).
  if (hasActiveCriteria(state)) {
    out.push({ kind: "browse_all", label: "Zobrazit všechny profesionály" });
  }
  return out;
}
