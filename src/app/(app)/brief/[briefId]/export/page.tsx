import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { getBriefById } from "@/features/brief/service";
import { canWriteBrief } from "@/features/brief/permissions";
import { redactBriefPrivate } from "@/features/brief/content";
import { BRIEF_STATUS_LABELS } from "@/features/brief/types";
import { BriefContentView } from "@/features/brief/components/brief-content-view";
import { BriefExportToolbar } from "@/features/brief/components/brief-export-toolbar";

/**
 * Tisknutelný export briefu (`/brief/[briefId]/export`, T022 § Main flow 5).
 * Vlastník-only (cizí/neexistující → 404). Výchozí export NEOBSAHUJE soukromá
 * pole (přesná adresa) — zahrnou se jen s explicitním `?soukrome=1`. Layout je
 * čistý; tisk (→ PDF) izoluje `.print-area` od zbytku appky (viz globals.css).
 */
export default async function BriefExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ briefId: string }>;
  searchParams: Promise<{ soukrome?: string }>;
}) {
  const actor = await requireUser();
  const { briefId } = await params;
  const { soukrome } = await searchParams;

  const result = await getBriefById(briefId);
  if (!result.ok) notFound();
  if (!canWriteBrief(actor, { ownerUserId: result.view.ownerUserId })) {
    notFound();
  }

  const brief = result.view;
  const includePrivate = soukrome === "1";
  const hasPrivateData = Boolean(brief.content.location?.address);
  const content = includePrivate
    ? brief.content
    : redactBriefPrivate(brief.content);

  trackEvent("brief.exported", { briefId, includePrivate });

  return (
    <div className="mx-auto max-w-3xl">
      <BriefExportToolbar
        briefId={briefId}
        includePrivate={includePrivate}
        hasPrivateData={hasPrivateData}
      />

      <div className="print-area space-y-6">
        <header className="space-y-1 border-b pb-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Projektový brief · {BRIEF_STATUS_LABELS[brief.status]}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {brief.title}
          </h1>
        </header>

        <BriefContentView content={content} />

        <footer className="text-muted-foreground border-t pt-4 text-xs print:pt-2">
          Vytvořeno v ArchiGuide.
          {!includePrivate && hasPrivateData
            ? " Soukromá pole (přesná adresa) nejsou v tomto exportu zahrnuta."
            : null}
        </footer>
      </div>
    </div>
  );
}
