/**
 * Překlad mezi URL query stringem a normalizovaným `SearchState` (T034). Filtry
 * jsou URL-persistované (sdílitelné, SEO indexovatelné), proto je parsování
 * jediným zdrojem pravdy pro to, co je platný stav. Neznámé/prázdné hodnoty se
 * zahazují (§ Validation). Čistý modul (bez DB, bez `next/*`).
 */

import { SORT_OPTIONS, type SearchState, type SortOption } from "./types";

/** Surové query params z Next routy (hodnota může být pole při duplicitě klíče). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Ořízne a znormalizuje jednu textovou hodnotu; prázdné → `null`. */
function firstString(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = (raw ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSort(value: string | string[] | undefined): SortOption {
  const raw = firstString(value);
  return SORT_OPTIONS.includes(raw as SortOption)
    ? (raw as SortOption)
    : "relevance";
}

/**
 * Z URL query params sestaví normalizovaný stav vyhledávání. Slug profese se tu
 * jen syntakticky očistí; jeho existenci v taxonomii ověří service vrstva
 * (neznámý slug → ignorovat, ne chyba).
 */
export function parseSearchParams(params: RawSearchParams): SearchState {
  return {
    query: firstString(params.q) ?? "",
    profession: firstString(params.profese),
    region: firstString(params.region),
    specialization: firstString(params.specializace),
    verifiedOnly: firstString(params.overeny) === "1",
    sort: parseSort(params.sort),
    cursor: firstString(params.cursor),
  };
}

/**
 * Serializuje stav zpět do URLSearchParams (bez prázdných klíčů — čistá URL).
 * `resetCursor` použij při změně dotazu/filtrů, aby se stránkování začalo znovu.
 */
export function toSearchParams(
  state: Partial<SearchState>,
  options: { resetCursor?: boolean } = {},
): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.query?.trim()) sp.set("q", state.query.trim());
  if (state.profession) sp.set("profese", state.profession);
  if (state.region) sp.set("region", state.region);
  if (state.specialization) sp.set("specializace", state.specialization);
  if (state.verifiedOnly) sp.set("overeny", "1");
  if (state.sort && state.sort !== "relevance") sp.set("sort", state.sort);
  if (!options.resetCursor && state.cursor) sp.set("cursor", state.cursor);
  return sp;
}

/** Jsou nastavené jakékoli filtry nebo dotaz? (prázdný katalog vs. bez shody) */
export function hasActiveCriteria(state: SearchState): boolean {
  return Boolean(
    state.query.trim() ||
    state.profession ||
    state.region ||
    state.specialization ||
    state.verifiedOnly,
  );
}

/**
 * Neprůhledný kurzor pro keyset stránkování. Nese seřazovací klíč posledního
 * vráceného řádku: `publishedAt` + `id` (stabilní tie-break) a u řazení dle
 * relevance i `rank`. Kódováno base64url(JSON) — obsah je interní, klient ho jen
 * přenáší v URL.
 */
export type Cursor = {
  /** `ts_rank` posledního řádku (jen u řazení dle relevance). */
  rank?: number;
  /** ISO `publishedAt` posledního řádku. */
  publishedAt: string;
  /** `id` posledního řádku (tie-break, aby stránkování nikdy nevynechalo). */
  id: string;
};

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** Dekóduje kurzor; poškozený/cizí kurzor → `null` (chová se jako první stránka). */
export function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cursor).publishedAt === "string" &&
      typeof (parsed as Cursor).id === "string"
    ) {
      const c = parsed as Cursor;
      return {
        publishedAt: c.publishedAt,
        id: c.id,
        ...(typeof c.rank === "number" ? { rank: c.rank } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}
