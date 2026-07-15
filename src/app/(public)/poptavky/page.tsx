import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import {
  parseListingParams,
  toListingParams,
  type RawListingParams,
} from "@/features/requests/listing-params";
import {
  hasActiveRequestFilters,
  type RequestListingState,
} from "@/features/requests/listing-types";
import { publicRequestListPath } from "@/features/requests/paths";
import {
  collectRequestProfessionSlugs,
  getRequestProfessionGroups,
  listPublicRequests,
} from "@/features/requests/listing-queries";
import { RequestFilters } from "@/features/requests/components/request-filters";
import { RequestListingCard } from "@/features/requests/components/request-listing-card";
import { RequestListEmpty } from "@/features/requests/components/request-list-empty";

/**
 * T026 — veřejný výpis aktivních poptávek (`/poptavky`). Jen `active` +
 * `visibility: public` (vstupní bod pro profesionály, main flow #1); filtry
 * jsou URL-persistované a stránka je serverově renderovaná ze stavu v URL
 * (sdílitelné, indexovatelné — § Edge cases, na rozdíl od detailu jednotlivé
 * poptávky, který zůstává `noindex`, T025).
 */

type SearchParams = Promise<RawListingParams>;

/** Kanonická URL bez kurzoru (stránkování neindexujeme jako duplicity). */
function canonicalQuery(state: RequestListingState): string {
  const qs = toListingParams(state, { resetCursor: true }).toString();
  return qs ? `${publicRequestListPath()}?${qs}` : publicRequestListPath();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const state = parseListingParams(await searchParams);
  const title = state.region
    ? `Poptávky — ${state.region}`
    : "Poptávky — ArchiGuide";
  const description =
    "Aktivní veřejné poptávky na architekty, projektanty a řemeslníky — filtrujte podle profese, regionu a rozpočtu.";

  return {
    title,
    description,
    alternates: { canonical: canonicalQuery(state) },
    openGraph: { title, description, url: canonicalQuery(state) },
    robots: { index: true, follow: true },
  };
}

export default async function RequestListingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const groups = await getRequestProfessionGroups();

  // Neznámý slug profese zahodíme (§ Validation) — filtr nikdy nezmrazí výpis.
  const parsed = parseListingParams(raw);
  const knownSlugs = collectRequestProfessionSlugs(groups);
  const state: RequestListingState = {
    ...parsed,
    profession:
      parsed.profession && knownSlugs.has(parsed.profession)
        ? parsed.profession
        : null,
  };

  const result = await listPublicRequests(state);

  if (hasActiveRequestFilters(state)) {
    trackEvent("request_list_filtered", {
      hasProfession: Boolean(state.profession),
      hasRegion: Boolean(state.region),
      hasType: Boolean(state.type),
      hasBudgetBand: Boolean(state.budgetBand),
      resultCount: result.cards.length,
    });
  }

  const loadMoreHref = result.nextCursor
    ? `${publicRequestListPath()}?${toListingParams({ ...state, cursor: result.nextCursor }).toString()}`
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Poptávky</h1>
        <p className="text-muted-foreground mt-1">
          Aktivní veřejné poptávky od klientů hledajících architekty,
          projektanty a řemeslníky.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <RequestFilters state={state} groups={groups} />
        </aside>

        <section aria-label="Výsledky výpisu poptávek">
          {result.cards.length === 0 ? (
            <RequestListEmpty state={state} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.cards.map((card) => (
                <li key={card.id}>
                  <RequestListingCard card={card} />
                </li>
              ))}
            </ul>
          )}

          {/* I u prázdné stránky: bounded scan rozpočtového pásma mohl skončit
              dřív, než prohledal všechno (`resumeCursor`) — pokračování nesmí
              zmizet, jinak výpis mlčky tvrdí, že dál nic není. */}
          {loadMoreHref && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" asChild>
                <Link href={loadMoreHref}>Načíst další</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
