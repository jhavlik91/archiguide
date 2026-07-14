import { ArrowRight, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BriefContent } from "../types";

/**
 * Read-only render obsahu briefu §18 (T022). Sdílená prezentace pro náhled
 * vlastníka (T021), sdílenou stránku příjemce a tisknutelný export — data jen
 * zobrazuje, žádná logika ani klientské hooky (server component).
 *
 * Přesná adresa (`location.address`) se ukazuje POUZE jako soukromý hint a jen
 * když v datech je — sdílený/exportovaný snapshot ji má odstraněnou
 * (`redactBriefPrivate`), takže se u příjemce nikdy nevykreslí.
 */
export function BriefContentView({ content }: { content: BriefContent }) {
  return (
    <div className="space-y-6">
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
