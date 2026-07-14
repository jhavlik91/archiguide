"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Lock,
  Pencil,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { markBriefReadyAction, regenerateBriefAction } from "../actions";
import { createRequestFromBriefAction } from "@/features/requests/actions";
import { BRIEF_STATUS_LABELS, type BriefView } from "../types";

/**
 * Náhled vygenerovaného briefu (T021, main flow §5). Zobrazí všechny povinné
 * sekce §18 a nabídne CTA sloty: uložit (draft → ready), upravit (T022 — slot),
 * vytvořit poptávku (T024 — slot), přegenerovat z odpovědí.
 *
 * Data jen prezentuje — brief složil generátor ze session (žádná logika navíc).
 * Přesná adresa se zobrazuje výhradně jako SOUKROMÉ pole (zadani/09 — Brief).
 */
export function BriefPreview({ brief }: { brief: BriefView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { content } = brief;
  const isDraft = brief.status === "draft";

  function saveBrief() {
    startTransition(async () => {
      const res = await markBriefReadyAction(brief.id);
      if (res.ok) {
        toast.success("Brief uložen.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function createRequest() {
    // Akce založí draft poptávku a přesměruje na její detail (redirect uvnitř).
    startTransition(async () => {
      await createRequestFromBriefAction(brief.id);
    });
  }

  function regenerate() {
    startTransition(async () => {
      const res = await regenerateBriefAction(brief.id);
      if (res.ok) {
        toast.success("Brief přegenerován z odpovědí.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hlavička: název (automaticky navržený, editovatelný v T022) + stav. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isDraft ? "secondary" : "default"}>
            {BRIEF_STATUS_LABELS[brief.status]}
          </Badge>
          <Badge variant="outline">
            <Lock className="mr-1 size-3" />
            Soukromý
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{brief.title}</h1>
        <p className="text-muted-foreground text-sm">
          Automaticky navržený název — před odesláním jej budete moci upravit.
        </p>
      </div>

      {/* Shrnutí (§18) — lidský popis. */}
      <Section title="Shrnutí">
        <p className="text-sm leading-relaxed">{content.summary}</p>
      </Section>

      {/* Fakta — cíl, typ, stav, lokalita, rozsah, rozpočet, čas. */}
      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 sm:p-6">
          <Fact label="Cíl" value={content.goal} />
          <Fact label="Typ projektu" value={content.projectType} />
          <Fact label="Aktuální stav" value={content.currentState} />
          <Fact
            label="Lokalita"
            value={content.location?.display ?? null}
            hint={
              content.location?.address
                ? `Přesná adresa uložena soukromě: ${content.location.address}`
                : undefined
            }
          />
          <Fact label="Rozsah" value={content.scope} />
          <Fact
            label="Rozpočet"
            value={content.budget.display}
            muted={!content.budget.known}
            hint={content.budget.scope}
          />
          <Fact label="Časový horizont" value={content.timing} />
          <Fact
            label="Dostupné podklady"
            value={
              content.inputs.count > 0
                ? `${content.inputs.count} ${podkladySuffix(content.inputs.count)}`
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Chybějící podklady (§18). */}
      {content.missingInputs.length > 0 ? (
        <Section title="Chybějící podklady">
          <div className="bg-muted/50 flex gap-2 rounded-md border p-3 text-sm">
            <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-muted-foreground">
                Tyto informace zatím nemáme — bez nich bude poptávka méně
                přesná, doplnit je můžete později.
              </p>
              <ul className="text-muted-foreground mt-1.5 list-disc space-y-0.5 pl-4">
                {content.missingInputs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      ) : null}

      {/* Preference a doplňkové odpovědi. */}
      {content.preferences.length > 0 ? (
        <Section title="Preference">
          <dl className="space-y-3">
            {content.preferences.map((pref) => (
              <div key={pref.key} className="space-y-0.5">
                <dt className="text-muted-foreground text-xs">{pref.label}</dt>
                <dd className="text-sm font-medium">{pref.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {/* Rizika a nejasnosti (§18). */}
      {content.risks.length > 0 ? (
        <Section title="Rizika a nejasnosti">
          <ul className="space-y-2">
            {content.risks.map((risk) => (
              <li
                key={risk}
                className="border-warning/40 bg-warning/10 text-foreground flex gap-2 rounded-md border p-3 text-sm"
              >
                <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Doporučené profese S DŮVODEM (§18). */}
      {content.recommendedProfessions.length > 0 ? (
        <Section title="Doporučené profese">
          <ul className="space-y-3">
            {content.recommendedProfessions.map((prof) => (
              <li key={prof.slug} className="space-y-1">
                <Badge>{prof.name}</Badge>
                {prof.reason ? (
                  <p className="text-muted-foreground text-sm">{prof.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Doporučený další krok (§18). */}
      {content.nextStep ? (
        <Card className="border-primary/40">
          <CardContent className="flex gap-3 p-5 sm:p-6">
            <ArrowRight className="text-primary mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Doporučený další krok</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {content.nextStep}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* CTA sloty (§5). */}
      <Card>
        <CardContent className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <Button onClick={saveBrief} disabled={pending}>
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Uložit brief
              </Button>
            ) : (
              <span className="text-success flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="size-4" />
                Brief je uložený
              </span>
            )}

            {/* Slot T022 — manuální editace. */}
            <Button variant="outline" disabled>
              <Pencil />
              Upravit brief (brzy)
            </Button>
            {/* Vytvoření poptávky z briefu (T024). */}
            <Button
              variant="outline"
              onClick={createRequest}
              disabled={pending}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              Vytvořit poptávku
            </Button>

            {brief.guideSessionId ? (
              <Button variant="ghost" onClick={regenerate} disabled={pending}>
                <FileText />
                Přegenerovat z odpovědí
              </Button>
            ) : null}
          </div>

          <p className="text-muted-foreground text-sm">
            Brief je uložený ve vašem účtu — můžete se k němu kdykoli vrátit.{" "}
            <Link
              href="/dashboard"
              className="text-primary font-medium hover:underline"
            >
              Zpět na přehled
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string | null;
  hint?: string;
  muted?: boolean;
}) {
  const empty = value === null || value.trim().length === 0;
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          empty || muted
            ? "text-muted-foreground text-sm italic"
            : "text-sm font-medium"
        }
      >
        {empty ? "Neuvedeno" : value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function podkladySuffix(count: number): string {
  if (count === 1) return "podklad";
  if (count >= 2 && count <= 4) return "podklady";
  return "podkladů";
}
