import { notFound } from "next/navigation";
import type { Actor } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getRequestById, listRequestAudit } from "@/features/requests/service";
import { canReadRequest } from "@/features/requests/permissions";
import { getBriefById } from "@/features/brief/service";
import { canReadBrief } from "@/features/brief/permissions";
import { getProfessionsBySlugs } from "@/features/taxonomy/queries";
import { RequestDetail } from "@/features/requests/components/request-detail";
import type { ProfessionOption } from "@/features/requests/components/request-detail";

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

  return (
    <div className="mx-auto max-w-3xl">
      <RequestDetail
        request={view}
        professionOptions={professionOptions}
        audit={audit}
      />
    </div>
  );
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
