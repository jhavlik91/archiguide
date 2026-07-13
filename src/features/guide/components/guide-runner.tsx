"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  CircleCheckBig,
  FileText,
  HelpCircle,
  Loader2,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { createBriefFromGuide } from "@/features/brief/actions";
import { recordGuideSummaryView, submitGuideAnswer } from "../actions";
import type { GuideSessionView } from "../service";
import type { GuideAnswer, GuideAnswerValue } from "../types";
import { GuideResultView } from "./guide-result";
import { GuideSafetyWarning } from "./guide-safety-warning";
import { GuideSummary } from "./guide-summary";
import {
  StepInput,
  answerToDraft,
  isDraftComplete,
  stepSupportsAnswer,
  type Draft,
} from "./step-input";

/**
 * Guide runner (T018). Jedna otázka na krok, průběžný autosave (každá odpověď se
 * hned perzistuje na serveru), krok zpět se změnou odpovědi, průběžné shrnutí a
 * obrazovka dokončení. Server (engine T017) je autorita: klient jen vykresluje
 * `view.visibleSteps` a odesílá odpovědi; viditelnost a přepočet větve řeší server.
 *
 * „Žádné slepé uličky": „Nevím" i „Přeskočit" jsou vždy dostupné a nikdy
 * nezablokují postup (legacy-master-spec §53.1, zadani/16 §4).
 */
export function GuideRunner({
  initialView,
}: {
  initialView: GuideSessionView;
}) {
  const [view, setView] = useState(initialView);
  const [activeKey, setActiveKey] = useState<string | null>(
    initialView.nextStep?.key ?? null,
  );
  // Editace ze souhrnu (T020): u dokončené session skočíme na krok a po uložení
  // se vrátíme na souhrn (nebo pokračujeme, pokud změna znovu otevřela větev).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const steps = view.visibleSteps;
  const progress = view.summary.progress;
  const isComplete = view.state === "completed";
  const activeIndex = steps.findIndex((s) => s.key === activeKey);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;
  const safetyOutcomes = view.result?.safetyOutcomes ?? [];

  // Předvyplní draft z uložené odpovědi vždy, když se změní aktivní krok nebo
  // dorazí nový přepočítaný náhled (po odeslání). Psaní draft needituje `view`,
  // takže tento efekt uživatele nepřepisuje během vyplňování.
  useEffect(() => {
    setError(null);
    if (activeStep) setDraft(answerToDraft(view.answers[activeStep.key]));
  }, [activeKey, view, activeStep]);

  // Analytika souhrnu (T020): summary_viewed + odvozené eventy, jednou za mount.
  // Ref drží záznam i přes přepínání edit ↔ souhrn, aby se event neopakoval.
  const summaryRecorded = useRef(false);
  useEffect(() => {
    if (view.state === "completed" && !summaryRecorded.current) {
      summaryRecorded.current = true;
      void recordGuideSummaryView(view.id);
    }
  }, [view.state, view.id]);

  function submit(answer: GuideAnswer, answeredKey: string) {
    setError(null);
    startTransition(async () => {
      const res = await submitGuideAnswer(view.id, answeredKey, answer);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const next = res.view;
      // Po uložení postup o jeden viditelný krok dál; když změna dřívější odpovědi
      // přepočítala větev, spadneme na aktuální „další nezodpovězený" krok.
      const idx = next.visibleSteps.findIndex((s) => s.key === answeredKey);
      const following = idx >= 0 ? next.visibleSteps[idx + 1] : undefined;
      setView(next);
      setActiveKey(following ? following.key : (next.nextStep?.key ?? null));
      // Editace skončila: dokončená session se vrátí na souhrn; když edit znovu
      // otevřel větev (stav zpět `active`), pokračuje se normálním průchodem.
      setEditing(false);
    });
  }

  /** Skok na krok ze souhrnu (dokončená session zůstává, jen se edituje). */
  function editStep(stepKey: string) {
    setActiveKey(stepKey);
    setEditing(true);
  }

  function submitAnswer() {
    if (!activeStep) return;
    if (!isDraftComplete(activeStep, draft)) {
      setError('Zadejte odpověď, nebo zvolte „Nevím" či „Přeskočit".');
      return;
    }
    submit(
      { status: "answered", value: draft as GuideAnswerValue },
      activeStep.key,
    );
  }

  if (isComplete && !editing) {
    return <GuideCompletion view={view} onEditStep={editStep} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        {/* Bezpečnostní upozornění se ukáže IHNED, jakmile ho odpověď spustí (§15). */}
        <GuideSafetyWarning outcomes={safetyOutcomes} />

        {editing ? (
          <div className="border-primary/30 bg-primary/5 text-muted-foreground rounded-md border px-4 py-2.5 text-sm">
            Upravujete odpověď. Po uložení se vrátíte na souhrn.
          </div>
        ) : null}

        <ProgressHeader
          scenarioName={view.scenarioName}
          answered={progress.answered}
          total={progress.total}
        />

        {activeStep ? (
          <Card>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {activeStep.prompt}
                </h2>
                {activeStep.help ? (
                  <details key={activeStep.key} className="group">
                    <summary className="text-primary flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium">
                      <HelpCircle className="size-4" />
                      Co to znamená?
                    </summary>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {activeStep.help}
                    </p>
                  </details>
                ) : null}
              </div>

              <StepInput step={activeStep} draft={draft} onChange={setDraft} />

              {error ? (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(false)}
                    disabled={pending}
                  >
                    <ArrowLeft /> Zpět na souhrn
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveKey(steps[activeIndex - 1].key)}
                    disabled={activeIndex <= 0 || pending}
                  >
                    <ChevronLeft /> Zpět
                  </Button>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      submit({ status: "unknown" }, activeStep.key)
                    }
                    disabled={pending}
                  >
                    Nevím
                  </Button>
                  {/* „Nevím" i „Přeskočit" jsou u KAŽDÉ otázky (T017 §2); u povinné
                      se přeskočení jen projeví jako chybějící podklad ve shrnutí. */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      submit({ status: "skipped" }, activeStep.key)
                    }
                    disabled={pending}
                  >
                    <SkipForward /> Přeskočit
                  </Button>
                  {stepSupportsAnswer(activeStep) ? (
                    <Button
                      type="button"
                      onClick={submitAnswer}
                      disabled={pending}
                    >
                      {pending ? <Loader2 className="animate-spin" /> : null}
                      {editing
                        ? "Uložit"
                        : activeIndex === steps.length - 1
                          ? "Dokončit"
                          : "Pokračovat"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {stepSupportsAnswer(activeStep) ? (
                <p className="text-muted-foreground text-xs">
                  Nejste si jistí? Zvolte „Nevím“ — postup to nezablokuje.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-sm">
              Pro tento scénář nejsou další otázky.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Průběžné shrnutí: postranní panel na desktopu, rozbalovací na mobilu. */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="hidden lg:block">
          <h3 className="mb-3 text-sm font-semibold">Vaše odpovědi</h3>
          <GuideSummary
            steps={steps}
            answers={view.answers}
            conflicts={view.summary.conflicts}
            emptyHint="Odpovědi se tu budou objevovat, jak budete procházet průvodce."
          />
        </div>
        <details className="rounded-md border lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">
            Vaše odpovědi ({progress.answered})
          </summary>
          <div className="border-t px-4 py-3">
            <GuideSummary
              steps={steps}
              answers={view.answers}
              conflicts={view.summary.conflicts}
              emptyHint="Zatím žádné odpovědi."
            />
          </div>
        </details>
      </aside>
    </div>
  );
}

function ProgressHeader({
  scenarioName,
  answered,
  total,
}: {
  scenarioName: string;
  answered: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">
          {scenarioName}
        </p>
        <p className="text-muted-foreground text-xs">
          Krok {Math.min(answered + 1, total)} z {total}
        </p>
      </div>
      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Postup průvodce"
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GuideCompletion({
  view,
  onEditStep,
}: {
  view: GuideSessionView;
  onEditStep: (stepKey: string) => void;
}) {
  const anonymous = view.userId === null;
  const result = view.result;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3 text-center">
        <CircleCheckBig className="text-success mx-auto size-12" />
        <h1 className="text-2xl font-semibold tracking-tight">Hotovo!</h1>
        <p className="text-muted-foreground">
          Máme podklady k vašemu záměru. Níže je shrnutí a doporučení, jak dál.
        </p>
      </div>

      {result ? (
        <GuideResultView
          result={result}
          steps={view.visibleSteps}
          answers={view.answers}
          onEditStep={onEditStep}
        />
      ) : (
        // Pojistka: náhled bez rozřešeného výsledku (nemělo by nastat na této cestě).
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold">Vaše odpovědi</h2>
            <GuideSummary
              steps={view.visibleSteps}
              answers={view.answers}
              conflicts={view.summary.conflicts}
              onEdit={onEditStep}
            />
          </CardContent>
        </Card>
      )}

      {/* Další krok: vygenerovat projektový brief (T021). */}
      <Card className="border-primary/40">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileText className="text-primary size-5" />
            Vytvořit projektový brief
          </h2>
          <p className="text-muted-foreground text-sm">
            Ze shrnutí sestavíme strukturovaný brief se všemi podklady — základ
            pro poptávku, kterou později pošlete vybraným profesionálům.
          </p>
          {/* Server akce přesměruje na náhled briefu; nepřihlášeného nejprve na
              registraci (matice „Vytvořit brief" = C). Funguje i bez JS. */}
          <form action={createBriefFromGuide.bind(null, view.id)}>
            <Button type="submit">
              Vytvořit brief
              <ArrowRight />
            </Button>
          </form>
          {anonymous ? (
            <p className="text-muted-foreground text-xs">
              Před vytvořením briefu vás vyzveme k rychlé registraci — váš záměr
              se pak připojí k účtu a nic nezmizí.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {anonymous ? (
        <Card>
          <CardContent className="space-y-3 p-5 sm:p-6">
            <h2 className="font-semibold">Uložte si záměr na později</h2>
            <p className="text-muted-foreground text-sm">
              Zaregistrujte se a rozpracovaný záměr se automaticky připojí k
              vašemu účtu — nic nezmizí. Registrace ale není podmínkou.
            </p>
            <Button variant="outline" asChild>
              <Link href="/register">Vytvořit účet</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          Váš záměr je uložen ve vašem účtu — můžete se k němu kdykoli vrátit.
        </p>
      )}

      <div className="text-center">
        <Button variant="ghost" asChild>
          <Link href="/">Zpět na úvod</Link>
        </Button>
      </div>
    </div>
  );
}
