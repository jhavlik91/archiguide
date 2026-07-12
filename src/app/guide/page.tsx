import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveScenarios } from "@/features/guide/service";
import { startGuideScenario } from "@/features/guide/actions";
import { GuideResumeBanner } from "@/features/guide/components/guide-resume-banner";

export const metadata: Metadata = {
  title: "Co chcete vyřešit? — ArchiGuide",
  description:
    "Průvodce vás jednoduchými otázkami provede k jasnému zadání pro architekty a profesionály.",
};

/**
 * Vstupní obrazovka guide (T018): výběr scénáře „Co chcete vyřešit?" (karty proti
 * seed datům; scénáře plní T019). Veřejná — projde i nepřihlášený. Nahoře nabídne
 * návrat do rozpracovaného záměru.
 */
export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, scenarios] = await Promise.all([
    searchParams,
    listActiveScenarios(),
  ]);

  return (
    <div className="space-y-8">
      <GuideResumeBanner />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Co chcete vyřešit?
        </h1>
        <p className="text-muted-foreground">
          Vyberte, co je vám nejblíž. Pár jednoduchých otázek — bez odborných
          pojmů — a připravíme jasné zadání. Kdykoli můžete zvolit „Nevím“.
        </p>
      </div>

      {error === "no_scenario" ? (
        <p role="alert" className="text-destructive text-sm">
          Tento průvodce teď není dostupný. Zkuste to prosím později.
        </p>
      ) : null}

      {scenarios.length === 0 ? (
        <EmptyState
          title="Zatím tu není žádný průvodce"
          description="Scénáře se připravují. Zkuste to prosím později."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <form
              key={scenario.slug}
              action={startGuideScenario.bind(null, scenario.slug)}
            >
              <button
                type="submit"
                className="hover:border-primary/50 block h-full w-full text-left transition-colors"
              >
                <Card className="hover:border-primary/50 h-full transition-colors">
                  <CardContent className="flex h-full items-center justify-between gap-4 p-5">
                    <span className="font-medium">{scenario.name}</span>
                    <ArrowRight className="text-muted-foreground size-5 shrink-0" />
                  </CardContent>
                </Card>
              </button>
            </form>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        Nechcete se registrovat? Nevadí — průvodce dokončíte i bez účtu.{" "}
        <Button variant="link" className="h-auto p-0" asChild>
          <a href="/login">Už mám účet</a>
        </Button>
      </p>
    </div>
  );
}
