import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCategoryTree, getProfessionsBySlugs } from "@/features/taxonomy";
import { matchesBudgetBand, type BudgetBand } from "./budget-band";
import {
  decodeListingCursor,
  encodeListingCursor,
  type ListingCursor,
} from "./listing-params";
import {
  REQUEST_LISTING_PAGE_SIZE,
  type RequestListingCard,
  type RequestListingResult,
  type RequestListingState,
} from "./listing-types";
import type { RequestType } from "./types";

/**
 * Datová vrstva veřejného výpisu poptávek (T026 § Main flow). Jen `active` +
 * `visibility: public` (main flow #1) — `shared_link`/`private`/draft se sem
 * nikdy nedostanou, i kdyby volající zapomněl filtr (bázový `buildWhere` je
 * jediné místo, které sestavuje WHERE, takže se to nedá obejít z volajícího).
 * Karty jsou whitelist projekce (T025 princip) s profesemi už rozřešenými na
 * názvy (dotaz do taxonomie dávkově pro celou stránku, ne per karta).
 */

// --- Profese pro filtr (T005) ------------------------------------------------

export interface RequestProfessionGroup {
  slug: string;
  name: string;
  professions: { slug: string; name: string }[];
}

/** Profese seskupené po kategoriích pro select filtru (jen aktivní). */
export async function getRequestProfessionGroups(): Promise<
  RequestProfessionGroup[]
> {
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

/** Množina platných slugů — pro zahození neznámého filtru (§ Validation). */
export function collectRequestProfessionSlugs(
  groups: RequestProfessionGroup[],
): Set<string> {
  return new Set(groups.flatMap((g) => g.professions.map((p) => p.slug)));
}

// --- Výpis --------------------------------------------------------------

const SELECT_FIELDS = {
  id: true,
  type: true,
  title: true,
  targetProfessionSlugs: true,
  region: true,
  budget: true,
  timeline: true,
  deadline: true,
  publishedAt: true,
} as const;

type ListingRow = Prisma.RequestGetPayload<{ select: typeof SELECT_FIELDS }>;

/** Bázové WHERE: jen aktivní veřejná poptávka + explicitní filtry (main flow #1–2). */
function buildWhere(state: RequestListingState): Prisma.RequestWhereInput {
  return {
    status: "active",
    visibility: "public",
    ...(state.profession
      ? { targetProfessionSlugs: { has: state.profession } }
      : {}),
    ...(state.type ? { type: state.type } : {}),
    ...(state.region
      ? { region: { contains: state.region, mode: "insensitive" } }
      : {}),
  };
}

/** Keyset podmínka `(publishedAt, id) < kurzor` pro `ORDER BY publishedAt DESC, id DESC`. */
function buildKeysetWhere(
  cursor: ListingCursor | null,
): Prisma.RequestWhereInput {
  if (!cursor) return {};
  const publishedAt = new Date(cursor.publishedAt);
  return {
    OR: [
      { publishedAt: { lt: publishedAt } },
      { publishedAt, id: { lt: cursor.id } },
    ],
  };
}

/** `publishedAt` je vždy vyplněné u `active` řádku (nastaví ho publikace). */
function cursorFor(row: ListingRow): ListingCursor {
  return { publishedAt: row.publishedAt!.toISOString(), id: row.id };
}

/** Velikost jedné skenovací dávky a pojistka počtu dávek (viz `scanForBudgetBand`). */
const BAND_SCAN_BATCH = REQUEST_LISTING_PAGE_SIZE * 10;
const BAND_SCAN_MAX_BATCHES = 5;

/**
 * Rozpočtové pásmo je odhad z volného textu (`budget-band.ts`) — nejde vyjádřit
 * jako spolehlivý SQL rozsahový dotaz nad `Request.budget` (String). Místo toho
 * prohledáváme DB po dávkách (stejný keyset jako běžná stránka) a filtrujeme
 * v paměti, dokud nenasbíráme dost karet, nebo nedojdou řádky. `BAND_SCAN_MAX_BATCHES`
 * je pojistka proti neomezenému skenování při extrémně řídkém pásmu — po jejím
 * vyčerpání vrátíme, co máme, a nabídneme pokračování (`resumeCursor`), místo
 * abychom mlčky tvrdili, že další stránka není.
 */
async function scanForBudgetBand(
  where: Prisma.RequestWhereInput,
  band: BudgetBand,
  startCursor: ListingCursor | null,
): Promise<{ matched: ListingRow[]; resumeCursor: ListingCursor | null }> {
  const matched: ListingRow[] = [];
  let cursor = startCursor;
  let exhausted = false;

  for (let batch = 0; batch < BAND_SCAN_MAX_BATCHES; batch++) {
    const rows = await db.request.findMany({
      where: { AND: [where, buildKeysetWhere(cursor)] },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: SELECT_FIELDS,
      take: BAND_SCAN_BATCH,
    });
    if (rows.length === 0) {
      exhausted = true;
      break;
    }

    for (const row of rows) {
      if (matchesBudgetBand(row.budget, band)) matched.push(row);
    }
    cursor = cursorFor(rows[rows.length - 1]!);

    if (matched.length > REQUEST_LISTING_PAGE_SIZE) break;
    if (rows.length < BAND_SCAN_BATCH) {
      exhausted = true;
      break;
    }
  }

  return { matched, resumeCursor: exhausted ? null : cursor };
}

/**
 * Provede výpis: vrátí stránku karet a kurzor další stránky. Řazení vždy dle
 * data publikace (main flow #2 — jiné řazení není v scope). Bez rozpočtového
 * pásma jde o přímou DB stránkovanou stránku; s pásmem viz `scanForBudgetBand`.
 */
export async function listPublicRequests(
  state: RequestListingState,
): Promise<RequestListingResult> {
  const where = buildWhere(state);
  const cursor = decodeListingCursor(state.cursor);

  if (state.budgetBand) {
    const { matched, resumeCursor } = await scanForBudgetBand(
      where,
      state.budgetBand,
      cursor,
    );
    const hasMore = matched.length > REQUEST_LISTING_PAGE_SIZE;
    const page = matched.slice(0, REQUEST_LISTING_PAGE_SIZE);
    const nextCursor = hasMore
      ? encodeListingCursor(cursorFor(page[page.length - 1]!))
      : resumeCursor
        ? encodeListingCursor(resumeCursor)
        : null;
    return { cards: await hydrateCards(page), nextCursor };
  }

  const rows = await db.request.findMany({
    where: { AND: [where, buildKeysetWhere(cursor)] },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: SELECT_FIELDS,
    take: REQUEST_LISTING_PAGE_SIZE + 1,
  });
  const hasMore = rows.length > REQUEST_LISTING_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, REQUEST_LISTING_PAGE_SIZE) : rows;
  const nextCursor = hasMore
    ? encodeListingCursor(cursorFor(page[page.length - 1]!))
    : null;
  return { cards: await hydrateCards(page), nextCursor };
}

/** Rozřeší slugy profesí na názvy dávkově pro celou stránku (ne per karta). */
async function hydrateCards(rows: ListingRow[]): Promise<RequestListingCard[]> {
  if (rows.length === 0) return [];
  const bySlug = await getProfessionsBySlugs(
    rows.flatMap((r) => r.targetProfessionSlugs),
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.type as RequestType,
    title: row.title,
    professionNames: row.targetProfessionSlugs.map(
      (slug) => bySlug.get(slug)?.name ?? slug,
    ),
    region: row.region,
    budget: row.budget,
    timeline: row.timeline,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    publishedAt: row.publishedAt!.toISOString(),
  }));
}
