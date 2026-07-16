import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Pencil, Send } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
import {
  getPublicRequestView,
  getRequestVisibilityMeta,
  isUserInvitedToRequest,
} from "@/features/requests/service";
import {
  canReadRequest,
  canReadRequestPublicView,
} from "@/features/requests/permissions";
import { hasRole } from "@/lib/permissions";
import { getProfessionsBySlugs } from "@/features/taxonomy/queries";
import { BriefContentView } from "@/features/brief/components/brief-content-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/features/requests/types";
import { ResponseForm } from "@/features/responses/components/response-form";
import {
  getResponseForAuthor,
  listOwnPublishedPortfolioItems,
} from "@/features/responses/service";

/**
 * Veřejná anonymizovaná projekce poptávky (`/poptavka/[requestId]`, T025
 * §20.2–20.3, T026 § Main flow #4–5). Přístup: vlastník/admin vždy (i draft —
 * náhled před publikací, T025 main flow bod 6); jinak `public`/`shared_link`
 * kdokoli, `private` jen pozvaný (`RequestInvite`) — cizí/neexistující/
 * nepublikovaná poptávka je 404 (neprozrazuje existenci). Indexovatelný jen
 * pro `public` mimo draft (`generateMetadata`) — draft/`private`/`shared_link`
 * zůstávají `noindex` (`shared_link` je neveřejný odkaz, indexace by ho
 * zveřejnila).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ requestId: string }>;
}): Promise<Metadata> {
  const { requestId } = await params;
  const meta = await getRequestVisibilityMeta(requestId);
  const indexable =
    meta !== null && meta.status !== "draft" && meta.visibility === "public";

  return {
    title: "Poptávka — ArchiGuide",
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

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

  const isManager = canReadRequest(actor, { ownerUserId: meta.ownerUserId });

  trackEvent("request_viewed", {
    requestId,
    status: view.status,
    isManager,
  });

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

      {isManager ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span>Toto je náhled toho, co vidí ostatní.</span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/requests/${requestId}`}>
              <Pencil />
              Spravovat poptávku
            </Link>
          </Button>
        </div>
      ) : null}

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

      {!isManager ? (
        view.status === "active" && actor.kind === "user" ? (
          hasRole(actor, "professional") ? (
            <ResponseSection requestId={requestId} userId={actor.userId} />
          ) : (
            <ProfessionalOnlyNotice />
          )
        ) : (
          <ResponseCta requestId={requestId} status={view.status} />
        )
      ) : null}

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        Vytvořeno v ArchiGuide.
      </footer>
    </div>
  );
}

/**
 * Reakce (T027) pro přihlášeného na `active` poptávku — vlastní formulář, nebo
 * stav existující reakce (`ResponseForm` rozhoduje dle stavu). Portfolio k
 * přiložení nabízí jen VLASTNÍ `published` projekty (§ Validation).
 */
async function ResponseSection({
  requestId,
  userId,
}: {
  requestId: string;
  userId: string;
}) {
  const author = { type: "user" as const, userId };
  const [existing, portfolioOptions] = await Promise.all([
    getResponseForAuthor(requestId, author),
    listOwnPublishedPortfolioItems(author),
  ]);

  return (
    <ResponseForm
      requestId={requestId}
      existing={existing}
      portfolioOptions={portfolioOptions}
    />
  );
}

/**
 * Přihlášený BEZ role profesionála (T027 — permission matice: reagovat smí jen
 * profesionál/firma). Formulář by mu k ničemu nebyl — odeslání by server vždy
 * odmítl; místo něj dostane vysvětlení rovnou.
 */
function ProfessionalOnlyNotice() {
  return (
    <div className="space-y-2">
      <Button disabled>
        <Send />
        Reagovat na poptávku
      </Button>
      <p className="text-muted-foreground text-sm">
        Na poptávky mohou reagovat jen profesionálové. Pokud služby nabízíte,
        dokončete si nejdřív profesní profil.
      </p>
    </div>
  );
}

/**
 * CTA „Reagovat" pro nepřihlášeného nebo poptávku mimo `active` (T026 § Main
 * flow #4). Nepřihlášený vede na přihlášení (nikdy na chybu, § Acceptance
 * criteria); mimo `active` je CTA vždy deaktivované s vysvětlením, bez ohledu
 * na přihlášení (Alternative flows — reakce mimo `active` nejde vůbec).
 */
function ResponseCta({
  requestId,
  status,
}: {
  requestId: string;
  status: keyof typeof REQUEST_STATUS_LABELS;
}) {
  if (status !== "active") {
    return (
      <div className="space-y-2">
        <Button disabled>
          <Send />
          Reagovat na poptávku
        </Button>
        <p className="text-muted-foreground text-sm">
          Poptávka je {REQUEST_STATUS_LABELS[status].toLowerCase()} — reagovat
          nelze.
        </p>
      </div>
    );
  }

  return (
    <Button asChild>
      <Link href={`/login?next=${encodeURIComponent(`/poptavka/${requestId}`)}`}>
        <Send />
        Reagovat na poptávku
      </Link>
    </Button>
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
