import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import {
  parseSearchParams,
  toSearchParams,
  type RawSearchParams,
  type SearchState,
} from "@/features/search";
import {
  collectProfessionSlugs,
  getProfessionGroups,
} from "@/features/search/queries";
import {
  relatedProfessions,
  searchProfessionals,
} from "@/features/search/service";
import { SearchFilters } from "@/features/search/components/search-filters";
import { ProfessionalCard } from "@/features/search/components/professional-card";
import { EmptyResults } from "@/features/search/components/empty-results";

/**
 * T034 — veřejné vyhledávání a katalog profesionálů (`/profesionalove`).
 *
 * Fulltext + filtry (profese, region, specializace, ověření) nad publikovanými
 * profily; výsledky se renderují serverově z URL (sdílitelné, SEO indexovatelné).
 * Draft/neaktivní profil se sem nikdy nedostane (řeší service vrstva).
 */

type SearchParams = Promise<RawSearchParams>;

/** Kanonická URL bez kurzoru (stránkování neindexujeme jako duplicity). */
function canonicalQuery(state: SearchState): string {
  const qs = toSearchParams(state, { resetCursor: true }).toString();
  return qs ? `/profesionalove?${qs}` : "/profesionalove";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const state = parseSearchParams(await searchParams);
  const parts = [state.profession, state.region].filter(Boolean);
  const title = parts.length
    ? `Profesionálové — ${parts.join(", ")}`
    : "Katalog profesionálů";
  const description =
    "Najděte ověřené architekty, projektanty a řemeslníky podle profese, " +
    "lokality a specializace.";

  return {
    title,
    description,
    alternates: { canonical: canonicalQuery(state) },
    openGraph: { title, description, url: canonicalQuery(state) },
  };
}

export default async function ProfessionalsSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const groups = await getProfessionGroups();

  // Neznámý slug profese zahodíme (§ Validation), ať filtr nikdy nezmrazí výsledky.
  const parsed = parseSearchParams(raw);
  const knownSlugs = collectProfessionSlugs(groups);
  const state: SearchState = {
    ...parsed,
    profession:
      parsed.profession && knownSlugs.has(parsed.profession)
        ? parsed.profession
        : null,
  };

  const result = await searchProfessionals(state);

  // Analytika bez PII: jen délka dotazu a počet výsledků (§ Analytics).
  trackEvent("search_performed", {
    hasQuery: state.query.trim().length > 0,
    queryLength: state.query.trim().length,
    hasFilters: Boolean(
      state.profession ||
      state.region ||
      state.specialization ||
      state.verifiedOnly,
    ),
    resultCount: result.total,
  });
  if (result.total === 0) {
    trackEvent("search_empty", { hasQuery: state.query.trim().length > 0 });
  }

  const related =
    result.total === 0 ? await relatedProfessions(state.query) : [];

  const loadMoreHref = result.nextCursor
    ? `/profesionalove?${toSearchParams({ ...state, cursor: result.nextCursor }).toString()}`
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Katalog profesionálů</h1>
        <p className="text-muted-foreground mt-1">
          Architekti, projektanti a řemeslníci pro vaši stavbu či rekonstrukci.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SearchFilters state={state} groups={groups} />
        </aside>

        <section aria-label="Výsledky vyhledávání">
          <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
            {result.total === 0
              ? "Žádné výsledky"
              : `${result.total} ${plural(result.total)}`}
          </p>

          {result.cards.length === 0 ? (
            <EmptyResults state={state} related={related} />
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.cards.map((card) => (
                  <li key={card.slug}>
                    <ProfessionalCard card={card} />
                  </li>
                ))}
              </ul>

              {loadMoreHref && (
                <div className="mt-8 flex justify-center">
                  <Button variant="outline" asChild>
                    <Link href={loadMoreHref}>Načíst další</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/** Česká pluralizace „profesionál/profesionálové/profesionálů". */
function plural(n: number): string {
  if (n === 1) return "profesionál";
  if (n >= 2 && n <= 4) return "profesionálové";
  return "profesionálů";
}
