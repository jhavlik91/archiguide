import { OctagonAlert, Phone } from "lucide-react";
import type { GuideResultOutcome } from "../types";

/**
 * Výrazné bezpečnostní upozornění (T020, legacy-master-spec §15). Zobrazí se
 * OKAMŽITĚ během průchodu (jakmile odpověď spustí rizikový výstup) a znovu v
 * souhrnu. Nese explicitní sdělení, že ArchiGuide NENÍ havarijní služba — text
 * upozornění (`nextStep`) přichází z dat scénáře (T019), tady je jen render.
 *
 * Barevně i ikonou se odlišuje od jemných rozporů (`warning`) — jde o
 * `destructive`, protože může jít o ohrožení zdraví/majetku.
 */
export function GuideSafetyWarning({
  outcomes,
  className,
}: {
  outcomes: GuideResultOutcome[];
  className?: string;
}) {
  if (outcomes.length === 0) return null;

  return (
    <section
      role="alert"
      aria-labelledby="guide-safety-title"
      className={`border-destructive/60 bg-destructive/10 rounded-lg border-2 p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <OctagonAlert className="text-destructive mt-0.5 size-6 shrink-0" />
        <div className="space-y-2">
          <h2
            id="guide-safety-title"
            className="text-destructive text-base font-semibold"
          >
            Bezpečnostní upozornění
          </h2>
          <ul className="text-foreground space-y-2 text-sm">
            {outcomes.map((outcome) => (
              <li key={outcome.key}>{outcome.nextStep}</li>
            ))}
          </ul>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
            <Phone className="size-4 shrink-0" />
            ArchiGuide není havarijní ani pohotovostní služba. Při
            bezprostředním ohrožení volejte 112.
          </p>
        </div>
      </div>
    </section>
  );
}
