"use client";

import { ArrowRight, CircleHelp, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GuideSafetyWarning } from "./guide-safety-warning";
import { GuideSummary } from "./guide-summary";
import type {
  GuideResult,
  GuideResultOutcome,
  GuideStepDefinition,
  GuideAnswers,
} from "../types";

/**
 * Závěrečný souhrn guide (T020): lidsky čitelné shrnutí odpovědí, doporučené
 * profese S VYSVĚTLENÍM proč (`nextStep`), identifikovaná rizika (rozpory,
 * chybějící podklady), bezpečnostní upozornění (§15) a doporučený další krok.
 *
 * Žádná logika navíc ani vymyšlené závěry (zadani/16 §4) — vše rozhodl engine,
 * tady se jen prezentuje. Při „málo informací" (`lowConfidence`) se doporučí
 * konzultace a tón se zjemní.
 */
export function GuideResultView({
  result,
  steps,
  answers,
  onEditStep,
}: {
  result: GuideResult;
  steps: GuideStepDefinition[];
  answers: GuideAnswers;
  onEditStep: (stepKey: string) => void;
}) {
  // Bezpečnostní výstupy renderuje výhradně banner nahoře — v kartách doporučení
  // by tentýž text (`nextStep`) běžel podruhé. Karta vždy zbude: záchranný
  // fallback (bez `when`) platí u každého scénáře.
  const [primary, ...secondary] = result.outcomes.filter(
    (o) => !o.safetyWarning,
  );
  const hasRisks =
    result.conflicts.length > 0 ||
    result.missing.length > 0 ||
    result.lowConfidence;

  return (
    <div className="space-y-6">
      {/* Bezpečnost má přednost — nahoře a výrazně (§15). */}
      <GuideSafetyWarning outcomes={result.safetyOutcomes} />

      {result.lowConfidence ? (
        <Card className="border-muted-foreground/30">
          <CardContent className="text-muted-foreground flex gap-3 p-4 text-sm sm:p-5">
            <CircleHelp className="mt-0.5 size-5 shrink-0" />
            <p>
              Zůstalo hodně nejasného, takže konkrétní doporučení zatím
              nedáváme. Nejlepší další krok je nezávazná konzultace — společně
              ujasníte, co přesně potřebujete. Odpovědi můžete kdykoli upřesnit
              níže.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Doporučení — primární zvýrazněné, další jako doplněk. */}
      {primary ? (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Co doporučujeme</h2>
          <OutcomeCard outcome={primary} emphasized />
          {secondary.map((outcome) => (
            <OutcomeCard key={outcome.key} outcome={outcome} />
          ))}
        </div>
      ) : null}

      {/* Rizika a nejasnosti — jemná, NEBLOKUJÍCÍ (§8). */}
      {hasRisks ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Na co dát pozor</h2>

          {result.conflicts.map((conflict) => (
            <div
              key={conflict.key}
              className="border-warning/40 bg-warning/10 text-foreground flex gap-2 rounded-md border p-3 text-sm"
            >
              <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
              <span>{conflict.message}</span>
            </div>
          ))}

          {result.missing.length > 0 ? (
            <div className="bg-muted/50 flex gap-2 rounded-md border p-3 text-sm">
              <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Chybějící podklady</p>
                <p className="text-muted-foreground mt-0.5">
                  Tyto informace zatím nemáme — doplnit je můžete níže. Bez nich
                  bude poptávka méně přesná, ale pokračovat lze i tak.
                </p>
                <ul className="text-muted-foreground mt-1.5 list-disc space-y-0.5 pl-4">
                  {result.missing.map((item) => (
                    <li key={item.key}>{item.prompt}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Rekapitulace odpovědí s možností úpravy (skok na krok → zpět). */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">Vaše odpovědi</h2>
          <GuideSummary steps={steps} answers={answers} onEdit={onEditStep} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Jedna karta doporučení: vysvětlení („proč"), profese a podklady k přípravě. */
function OutcomeCard({
  outcome,
  emphasized = false,
}: {
  outcome: GuideResultOutcome;
  emphasized?: boolean;
}) {
  return (
    <Card className={emphasized ? "border-primary/40" : undefined}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex gap-3">
          <ArrowRight className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-foreground text-sm leading-relaxed">
              {outcome.nextStep}
            </p>
            {outcome.note ? (
              <p className="text-muted-foreground text-sm">{outcome.note}</p>
            ) : null}
          </div>
        </div>

        {outcome.professions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">
              Doporučené profese
            </p>
            <ul className="flex flex-wrap gap-2">
              {outcome.professions.map((profession) => (
                <li key={profession.slug}>
                  <Badge variant={emphasized ? "default" : "secondary"}>
                    {profession.name}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {outcome.prepare.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">
              Připravte si
            </p>
            <ul className="text-foreground list-disc space-y-0.5 pl-5 text-sm">
              {outcome.prepare.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
