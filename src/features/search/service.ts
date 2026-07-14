import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { findProfessions } from "@/features/taxonomy";
import { listPublicPortfolioForUser } from "@/features/portfolio/queries";
import { buildTsQuery } from "./query";
import { decodeCursor, encodeCursor, type Cursor } from "./params";
import type { RelatedProfession } from "./suggestions";
import {
  PAGE_SIZE,
  type CardBadge,
  type ProfessionalCard,
  type SearchResult,
  type SearchState,
} from "./types";

/**
 * Datová vrstva vyhledávání profesionálů (T034). Fulltext běží nad Postgres
 * `tsvector`, který se skládá ZA BĚHU z živého publikovaného stavu (headline,
 * bio, specializace, názvy profesí a publikovaných portfolio projektů) — nikde
 * není materializovaný index, takže odpublikovaný profil nebo staženo dílo
 * zmizí z výsledků okamžitě, bez přeindexování (§ Edge cases). Diakritiku
 * sjednocuje `unaccent` na obou stranách (dokument i dotaz). Do výsledků se
 * nikdy nedostane draft/neaktivní profil ani privátní pole (§ Permissions).
 *
 * Škálování: až dataset povyroste, dokument se materializuje do `tsvector`
 * sloupce s GIN indexem a triggerem (příprava viz migrace); tvar dotazu i API
 * této vrstvy se tím nezmění.
 */

/** SQL fragment dokumentu profilu (vše, v čem fulltext hledá). Diakritika pryč. */
const DOCUMENT_SQL = Prisma.sql`
  to_tsvector('simple', unaccent(
    coalesce(p.headline, '') || ' ' ||
    coalesce(p.bio, '') || ' ' ||
    coalesce(array_to_string(p.specializations, ' '), '') || ' ' ||
    coalesce(p.location, '') || ' ' ||
    coalesce(array_to_string(p."serviceAreas", ' '), '') || ' ' ||
    coalesce((
      SELECT string_agg(pr.name, ' ')
      FROM profile_professions pp
      JOIN professions pr ON pr.id = pp."professionId"
      WHERE pp."profileId" = p.id
    ), '') || ' ' ||
    coalesce((
      SELECT string_agg(coalesce(pj."publishedSnapshot" ->> 'title', pj.title), ' ')
      FROM portfolio_projects pj
      WHERE pj."ownerUserId" = p."userId"
        AND pj.status = 'published'
        AND pj."deletedAt" IS NULL
    ), '')
  ))`;

/** Podmínky viditelnosti — jen publikovaný profil aktivního uživatele. */
const VISIBLE_SQL = Prisma.sql`
  p.status = 'published'
  AND p."publishedAt" IS NOT NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = p."userId" AND u.status = 'active')`;

/** Řádek vrácený z SQL — jen klíče pro řazení/kurzor a hydrataci. */
type MatchRow = { id: string; published_at: Date; rank: number };

/**
 * Sestaví WHERE podmínky z filtrů (profese, region, specializace, ověření) a
 * z fulltextu/synonym. `synonymProfessionIds` doplní service z taxonomie —
 * dotaz „projektant" tak najde i profil s profesí „projektant pozemních staveb",
 * i když ji nemá doslovně v textu.
 */
function buildConditions(
  state: SearchState,
  tsQuery: string | null,
  synonymProfessionIds: string[],
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [VISIBLE_SQL];

  // Fulltext + synonyma profesí (OR): shoda v dokumentu NEBO odpovídající profese.
  if (tsQuery) {
    const ftClauses: Prisma.Sql[] = [
      Prisma.sql`${DOCUMENT_SQL} @@ to_tsquery('simple', unaccent(${tsQuery}))`,
    ];
    if (synonymProfessionIds.length > 0) {
      ftClauses.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM profile_professions pp
          WHERE pp."profileId" = p.id
            AND pp."professionId" IN (${Prisma.join(synonymProfessionIds)})
        )`,
      );
    }
    conditions.push(Prisma.sql`(${Prisma.join(ftClauses, " OR ")})`);
  }

  // Filtr profese (slug z taxonomie). Neznámý slug service zahodí ještě dřív.
  if (state.profession) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM profile_professions pp
      JOIN professions pr ON pr.id = pp."professionId"
      WHERE pp."profileId" = p.id AND pr.slug = ${state.profession}
    )`);
  }

  // Region: shoda proti lokalitě NEBO regionům působnosti (bez diakritiky).
  if (state.region) {
    const like = `%${state.region}%`;
    conditions.push(Prisma.sql`(
      unaccent(coalesce(p.location, '')) ILIKE unaccent(${like})
      OR EXISTS (
        SELECT 1 FROM unnest(p."serviceAreas") AS area
        WHERE unaccent(area) ILIKE unaccent(${like})
      )
    )`);
  }

  // Specializace: shoda proti poli specializací (bez diakritiky).
  if (state.specialization) {
    const like = `%${state.specialization}%`;
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM unnest(p.specializations) AS spec
      WHERE unaccent(spec) ILIKE unaccent(${like})
    )`);
  }

  // Jen ověřené účty — telefon ověřený (badge z T011). Přesná formulace badge
  // je věcí karty; filtr bere ověřený telefon jako signál důvěry.
  if (state.verifiedOnly) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM verifications v
      WHERE v."userId" = p."userId" AND v.status = 'verified' AND v.type = 'phone'
    )`);
  }

  return conditions;
}

/** Přeloží dotaz na ID profesí, které mu odpovídají přes synonyma (taxonomie). */
async function synonymProfessionIds(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const matches = await findProfessions(query);
  return matches.map((p) => p.id);
}

/**
 * Provede vyhledávání: vrátí stránku karet, celkový počet a kurzor další stránky.
 * Řazení: dle relevance (`ts_rank`) při zadaném dotazu, jinak dle novosti. Kurzor
 * je keyset (stabilní tie-break přes `id`), takže stránkování nikdy neduplikuje
 * ani nevynechá při souběžné publikaci.
 */
export async function searchProfessionals(
  state: SearchState,
): Promise<SearchResult> {
  const tsQuery = buildTsQuery(state.query);
  const useRelevance = state.sort === "relevance" && tsQuery !== null;
  const synonymIds = tsQuery ? await synonymProfessionIds(state.query) : [];

  const conditions = buildConditions(state, tsQuery, synonymIds);
  const whereSql = Prisma.join(conditions, " AND ");

  // rank: jen když se řadí dle relevance; jinak 0 (řazení dělá publishedAt).
  const rankSql = useRelevance
    ? Prisma.sql`ts_rank(${DOCUMENT_SQL}, to_tsquery('simple', unaccent(${tsQuery})))`
    : Prisma.sql`0`;

  const cursor = decodeCursor(state.cursor);
  const keysetSql = buildKeyset(useRelevance, cursor);

  const orderSql = useRelevance
    ? Prisma.sql`ORDER BY rank DESC, published_at DESC, id DESC`
    : Prisma.sql`ORDER BY published_at DESC, id DESC`;

  // O jeden řádek navíc → zjistíme, zda existuje další stránka.
  const rows = await db.$queryRaw<MatchRow[]>`
    SELECT id, published_at, rank FROM (
      SELECT
        p.id AS id,
        p."publishedAt" AS published_at,
        ${rankSql} AS rank
      FROM professional_profiles p
      WHERE ${whereSql}
    ) matches
    ${keysetSql}
    ${orderSql}
    LIMIT ${PAGE_SIZE + 1}
  `;

  const [countRow] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT count(*)::bigint AS total
    FROM professional_profiles p
    WHERE ${whereSql}
  `;
  const total = Number(countRow?.total ?? 0);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const cards = await hydrateCards(pageRows.map((r) => r.id));

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = pageRows[pageRows.length - 1];
    const payload: Cursor = {
      publishedAt: last.published_at.toISOString(),
      id: last.id,
      ...(useRelevance ? { rank: last.rank } : {}),
    };
    nextCursor = encodeCursor(payload);
  }

  return { cards, total, nextCursor };
}

/** Keyset podmínka pro další stránku (row-comparison, jednotné DESC). */
function buildKeyset(useRelevance: boolean, cursor: Cursor | null): Prisma.Sql {
  if (!cursor) return Prisma.empty;
  const publishedAt = new Date(cursor.publishedAt);
  if (useRelevance) {
    const rank = cursor.rank ?? 0;
    return Prisma.sql`WHERE (rank, published_at, id) < (${rank}, ${publishedAt}, ${cursor.id})`;
  }
  return Prisma.sql`WHERE (published_at, id) < (${publishedAt}, ${cursor.id})`;
}

/**
 * Z ID sestaví karty (v pořadí ze SQL). Načítá jen veřejná pole; kontaktní údaje
 * se ani nedotazují (private by default). Badge a portfolio náhled dopočítá přes
 * existující, otestované vrstvy — počet dotazů je omezený velikostí stránky.
 */
async function hydrateCards(ids: string[]): Promise<ProfessionalCard[]> {
  if (ids.length === 0) return [];

  const profiles = await db.professionalProfile.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      userId: true,
      slug: true,
      headline: true,
      bio: true,
      location: true,
      serviceAreas: true,
      professions: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          isPrimary: true,
          profession: { select: { slug: true, name: true } },
        },
      },
    },
  });

  const userIds = profiles.map((p) => p.userId);
  const verifiedBadges = await loadVerifiedBadges(userIds);

  const byId = new Map(profiles.map((p) => [p.id, p]));

  const cards = await Promise.all(
    ids.map(async (id): Promise<ProfessionalCard | null> => {
      const p = byId.get(id);
      if (!p || !p.slug) return null;
      const portfolio = await listPublicPortfolioForUser(p.userId);
      return {
        slug: p.slug,
        headline: p.headline?.trim() || "Profesionál",
        professions: p.professions.map((link) => ({
          slug: link.profession.slug,
          name: link.profession.name,
          isPrimary: link.isPrimary,
        })),
        location: p.location,
        region: p.serviceAreas[0] ?? null,
        bioSnippet: snippet(p.bio),
        portfolioCoverUrl: portfolio[0]?.coverImageUrl ?? null,
        publishedProjectCount: portfolio.length,
        badges: verifiedBadges.get(p.userId) ?? [],
      };
    }),
  );

  return cards.filter((c): c is ProfessionalCard => c !== null);
}

/** Ověřené badge (telefon/e-mail) pro dané uživatele jedním dotazem. */
async function loadVerifiedBadges(
  userIds: string[],
): Promise<Map<string, CardBadge[]>> {
  const rows = await db.verification.findMany({
    where: {
      userId: { in: userIds },
      status: "verified",
      type: { in: ["phone", "email"] },
    },
    select: { userId: true, type: true },
  });
  const map = new Map<string, CardBadge[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.type as CardBadge);
    map.set(row.userId, list);
  }
  return map;
}

/** Krátký úryvek bia pro kartu (bez zalomení, ~160 znaků). */
function snippet(bio: string | null): string | null {
  const text = bio?.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/**
 * Příbuzné profese pro prázdný výsledek: profese odpovídající dotazu přes
 * synonyma (taxonomie T005). Omezeno na pár položek, aby návrhy nezahltily.
 */
export async function relatedProfessions(
  query: string,
  limit = 3,
): Promise<RelatedProfession[]> {
  if (!query.trim()) return [];
  const matches = await findProfessions(query);
  return matches.slice(0, limit).map((p) => ({ slug: p.slug, name: p.name }));
}
