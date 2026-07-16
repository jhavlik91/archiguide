import { notFound } from "next/navigation";
import type { Actor } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getRequestById, listRequestAudit } from "@/features/requests/service";
import { canReadRequest } from "@/features/requests/permissions";
import type { RequestView } from "@/features/requests/types";
import { getBriefById } from "@/features/brief/service";
import { canReadBrief } from "@/features/brief/permissions";
import { getProfessionsBySlugs } from "@/features/taxonomy/queries";
import { RequestDetail } from "@/features/requests/components/request-detail";
import type { ProfessionOption } from "@/features/requests/components/request-detail";
import {
  getRecommendations,
  hydrateMatchCandidates,
  markRecommendationsShown,
} from "@/features/matching/service";
import { canReadMatches } from "@/features/matching/permissions";
import type {
  EmptyMatchReason,
  MatchCandidateCard,
  MatchRecommendationView,
} from "@/features/matching/types";
import { listResponsesForRequest } from "@/features/responses/service";
import { ResponseList } from "@/features/responses/components/response-list";

/**
 * Detail poptávky pro vlastníka (`/requests/[requestId]`, T024). Vlastník/admin
 * only — cizí/neexistující poptávka vrací 404 (neprozradí existenci). Serveru
 * náleží čtení a autorizace; interakce (editace, přechody) běží v klientském
 * `RequestDetail` přes server akce.
 */
export default async function RequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const actor = await requireUser();
  const { requestId } = await params;

  const result = await getRequestById(requestId);
  if (!result.ok) notFound();
  const view = result.view;
  if (!canReadRequest(actor, { ownerUserId: view.ownerUserId })) {
    // Cizí poptávku tváříme jako neexistující (neprozradíme vlastnictví).
    notFound();
  }

  // Nabídka profesí pro editaci draftu: doporučení z briefu (potvrzení/úprava)
  // sjednocené s aktuálně vybranými slugy (aby už zvolené nezmizely).
  const professionOptions = await resolveProfessionOptions(
    view.briefId,
    actor,
    view.targetProfessionSlugs,
  );

  const audit = await listRequestAudit(requestId);
  const matches = await loadMatches(actor, view);
  // Vlastníkovo čtení nastaví `viewed` u dosud `sent` reakcí (T027 § Main flow #3).
  const responses = await listResponsesForRequest(requestId, actor.userId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <RequestDetail
        request={view}
        professionOptions={professionOptions}
        audit={audit}
        matches={matches}
      />
      <ResponseList responses={responses} />
    </div>
  );
}

/** Náhled matching sekce (T029) — jen mimo draft (doporučení vznikají publikací). */
async function loadMatches(
  actor: Actor,
  view: RequestView,
): Promise<{
  recommendations: MatchRecommendationView[];
  candidates: Record<string, MatchCandidateCard>;
  emptyReason: EmptyMatchReason | null;
} | null> {
  if (view.status === "draft") return null;
  if (!canReadMatches(actor, { ownerUserId: view.ownerUserId })) return null;

  const result = await getRecommendations(view.id);
  if (!result.ok) return null;

  // První zobrazení VLASTNÍKOVI = "shown" (§ States) — přesun se provede tady,
  // při čtení stránky, ne z klienta. `canReadMatches` pustí i admina (support/
  // moderace) — jeho čtení ale není „vlastník viděl doporučení", takže admin
  // přechod nespouští (jinak by admin prohlídka tiše posunula stav i analytiku
  // za vlastníka).
  const isOwner = actor.kind === "user" && actor.userId === view.ownerUserId;
  const recommendations = isOwner
    ? await markRecommendationsShown(view.id, result.recommendations)
    : result.recommendations;
  const candidateMap = await hydrateMatchCandidates(
    recommendations.map((r) => r.candidateUserId),
  );

  return {
    recommendations,
    candidates: Object.fromEntries(candidateMap),
    emptyReason: result.emptyReason,
  };
}

/** Sjednotí doporučené profese z briefu s aktuálně vybranými (slug → název). */
async function resolveProfessionOptions(
  briefId: string | null,
  actor: Actor,
  selected: string[],
): Promise<ProfessionOption[]> {
  const bySlug = new Map<string, ProfessionOption>();

  if (briefId) {
    const brief = await getBriefById(briefId);
    if (
      brief.ok &&
      canReadBrief(actor, { ownerUserId: brief.view.ownerUserId })
    ) {
      for (const p of brief.view.content.recommendedProfessions) {
        bySlug.set(p.slug, { slug: p.slug, name: p.name });
      }
    }
  }

  const missing = selected.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) {
    const names = await getProfessionsBySlugs(missing);
    for (const slug of missing) {
      bySlug.set(slug, { slug, name: names.get(slug)?.name ?? slug });
    }
  }

  return [...bySlug.values()];
}
