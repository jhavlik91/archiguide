/**
 * Překlad mezi URL query stringem a `RequestListingState` (T026, mirror
 * `features/search/params.ts` z T034). Filtry jsou URL-persistované (sdílitelný
 * odfiltrovaný výpis, main flow #2). Neznámé/prázdné hodnoty se zahazují
 * (§ Validation) — neplatný filtr nikdy nezmrazí výpis chybou.
 */

import { BUDGET_BANDS, type BudgetBand } from "./budget-band";
import { REQUEST_TYPES, type RequestType } from "./types";
import type { RequestListingState } from "./listing-types";

/** Surové query params z Next routy (hodnota může být pole při duplicitě klíče). */
export type RawListingParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = (raw ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseType(value: string | string[] | undefined): RequestType | null {
  const raw = firstString(value);
  return REQUEST_TYPES.includes(raw as RequestType) ? (raw as RequestType) : null;
}

function parseBudgetBand(
  value: string | string[] | undefined,
): BudgetBand | null {
  const raw = firstString(value);
  return BUDGET_BANDS.includes(raw as BudgetBand) ? (raw as BudgetBand) : null;
}

/**
 * Z URL query params sestaví normalizovaný stav. Slug profese se tu jen
 * syntakticky očistí; existenci v taxonomii ověří volající stránka (neznámý
 * slug → ignorovat, ne chyba — stejný princip jako u T034).
 */
export function parseListingParams(
  params: RawListingParams,
): RequestListingState {
  return {
    profession: firstString(params.profese),
    region: firstString(params.region),
    type: parseType(params.typ),
    budgetBand: parseBudgetBand(params.rozpocet),
    cursor: firstString(params.cursor),
  };
}

/**
 * Serializuje stav zpět do URLSearchParams (bez prázdných klíčů). `resetCursor`
 * použij při změně filtru, aby stránkování začalo znovu.
 */
export function toListingParams(
  state: Partial<RequestListingState>,
  options: { resetCursor?: boolean } = {},
): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.profession) sp.set("profese", state.profession);
  if (state.region) sp.set("region", state.region);
  if (state.type) sp.set("typ", state.type);
  if (state.budgetBand) sp.set("rozpocet", state.budgetBand);
  if (!options.resetCursor && state.cursor) sp.set("cursor", state.cursor);
  return sp;
}

/** Neprůhledný keyset kurzor: `publishedAt` + `id` posledního vráceného řádku. */
export type ListingCursor = {
  publishedAt: string;
  id: string;
};

export function encodeListingCursor(cursor: ListingCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** Dekóduje kurzor; poškozený/cizí kurzor → `null` (chová se jako první stránka). */
export function decodeListingCursor(value: string | null): ListingCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ListingCursor).publishedAt === "string" &&
      typeof (parsed as ListingCursor).id === "string"
    ) {
      const c = parsed as ListingCursor;
      return { publishedAt: c.publishedAt, id: c.id };
    }
    return null;
  } catch {
    return null;
  }
}
