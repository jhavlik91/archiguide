"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAnswer } from "../format";
import type {
  GuideConflict,
  GuideStepDefinition,
  GuideAnswers,
} from "../types";

/**
 * Průběžné shrnutí dosavadních odpovědí (T018) — postranní panel na desktopu,
 * rozbalovací na mobilu, i finální rekapitulace na obrazovce dokončení. Vychází
 * z viditelných kroků a efektivních odpovědí (bez stale větví). „nevím"/
 * „přeskočit" se zobrazují jako plnohodnotná (tlumená) odpověď.
 */
export function GuideSummary({
  steps,
  answers,
  conflicts,
  emptyHint,
  className,
}: {
  steps: GuideStepDefinition[];
  answers: GuideAnswers;
  conflicts?: GuideConflict[];
  emptyHint?: string;
  className?: string;
}) {
  const answered = steps.filter((step) => answers[step.key]);

  return (
    <div className={cn("space-y-4", className)}>
      {answered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {emptyHint ?? "Zatím žádné odpovědi."}
        </p>
      ) : (
        <dl className="space-y-3">
          {answered.map((step) => {
            const answer = answers[step.key];
            const muted = answer.status !== "answered";
            return (
              <div key={step.key} className="space-y-0.5">
                <dt className="text-muted-foreground text-xs">{step.prompt}</dt>
                <dd
                  className={cn(
                    "text-sm",
                    muted ? "text-muted-foreground italic" : "font-medium",
                  )}
                >
                  {formatAnswer(step, answer)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {conflicts && conflicts.length > 0 ? (
        <ul className="space-y-2">
          {conflicts.map((conflict) => (
            <li
              key={conflict.key}
              className="border-warning/40 bg-warning/10 text-foreground flex gap-2 rounded-md border p-3 text-sm"
            >
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <span>{conflict.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
