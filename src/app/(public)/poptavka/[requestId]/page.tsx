import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getActor } from "@/lib/session";
import {
  getPublicRequestView,
  getRequestVisibilityMeta,
  isUserInvitedToRequest,
} from "@/features/requests/service";
import { canReadRequestPublicView } from "@/features/requests/permissions";
import { getProfessionsBySlugs } from "@/features/taxonomy/queries";
import { BriefContentView } from "@/features/brief/components/brief-content-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/features/requests/types";

/**
 * Veřejná anonymizovaná projekce poptávky (`/poptavka/[requestId]`, T025
 * §20.2–20.3). Přístup: vlastník/admin vždy (i draft — náhled před publikací,
 * main flow bod 6); jinak `public`/`shared_link` kdokoli, `private` jen
 * pozvaný (`RequestInvite`) — cizí/neexistující/nepublikovaná poptávka je 404
 * (neprozrazuje existenci). Definitivní indexovatelný výpis/detail s filtry
 * staví T026 — tahle stránka je seam pro anonymizovanou projekci z T025 a
 * NIKDY se neindexuje.
 */
export const metadata: Metadata = {
  title: "Poptávka — ArchiGuide",
  robots: { index: false, follow: false },
};

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const actor = await getActor();

  const meta = await getRequestVisibilityMeta(requestId);
  if (!meta) notFound();

  const isInvited =
    actor.kind === "user"
      ? await isUserInvitedToRequest(requestId, actor.userId)
      : false;

  const allowed = canReadRequestPublicView(actor, {
    ownerUserId: meta.ownerUserId,
    visibility: meta.visibility,
    status: meta.status,
    isInvited,
  });
  if (!allowed) notFound();

  const result = await getPublicRequestView(requestId);
  if (!result.ok) notFound();
  const view = result.view;

  const professionsBySlug = await getProfessionsBySlugs(
    view.targetProfessionSlugs,
  );
  const professionNames = view.targetProfessionSlugs.map(
    (slug) => professionsBySlug.get(slug)?.name ?? slug,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md border p-3 text-sm">
        <Eye className="size-4 shrink-0" />
        Anonymizovaný náhled poptávky — bez přesné adresy, telefonu, e-mailu a
        identity zadavatele.
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{REQUEST_STATUS_LABELS[view.status]}</Badge>
          <Badge variant="outline">{REQUEST_TYPE_LABELS[view.type]}</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
      </header>

      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 sm:p-6">
          <Fact
            label="Cílové profese"
            value={
              professionNames.length > 0 ? professionNames.join(", ") : null
            }
          />
          <Fact label="Region" value={view.region} />
          <Fact label="Rozpočet" value={view.budget} />
          <Fact label="Časový horizont" value={view.timeline} />
          <Fact
            label="Termín"
            value={
              view.deadline
                ? new Date(view.deadline).toLocaleDateString("cs-CZ")
                : null
            }
          />
        </CardContent>
      </Card>

      {view.briefPreview ? (
        <BriefContentView content={view.briefPreview} />
      ) : null}

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        Vytvořeno v ArchiGuide.
      </footer>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  const empty = value === null || value.trim().length === 0;
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          empty ? "text-muted-foreground text-sm italic" : "text-sm font-medium"
        }
      >
        {empty ? "Neuvedeno" : value}
      </p>
    </div>
  );
}
