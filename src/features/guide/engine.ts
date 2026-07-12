/**
 * Guide engine (T017). Čisté jádro produktu — bez DB a bez `next/*`, plně
 * pokryté unit testy. Pracuje nad DEFINICÍ scénáře (`GuideScenarioDefinition`)
 * a mapou odpovědí (`GuideAnswers`); service vrstva (`service.ts`) jen načte
 * definici z DB a perzistuje výsledek.
 *
 * Klíčové vlastnosti:
 * - dynamické větvení: viditelnost kroku určuje jeho `condition` nad DŘÍVĚJŠÍMI
 *   odpověďmi (jeden dopředný průchod, protože podmínky míří jen dozadu);
 * - „nevím"/„přeskočit" jsou zodpovězené kroky → engine jde dál, nikdy neblokuje;
 * - změna dřívější odpovědi přepočítá větev: odpovědi na krocích, které tím
 *   vypadly z platné cesty, se NEMAŽOU, jen se přestanou počítat (`staleAnswerKeys`);
 * - rozpory: pravidla `conflicts` se vyhodnocují nad EFEKTIVNÍMI odpověďmi
 *   (bez stale větví), takže neplatná větev falešný rozpor nespustí.
 */

import { evaluateCondition } from "./conditions";
import type {
  GuideAnswer,
  GuideAnswers,
  GuideConflict,
  GuideProgress,
  GuideScenarioDefinition,
  GuideStepDefinition,
  GuideSummary,
} from "./types";

/**
 * Rozřešení scénáře nad odpověďmi: co je vidět, co reálně platí, kam dál.
 * Jednorázový výpočet, ze kterého se odvozují všechny veřejné dotazy.
 */
export interface ResolvedGuide {
  /** Aktuálně viditelné kroky v pořadí scénáře. */
  visibleSteps: GuideStepDefinition[];
  /** Odpovědi na viditelných krocích (bez stale větví) — „efektivní" stav. */
  effectiveAnswers: GuideAnswers;
  /** Další nezodpovězený viditelný krok, nebo `null`, je-li scénář hotový. */
  nextStep: GuideStepDefinition | null;
  /** Klíče odpovědí, které leží mimo platnou větev (označené, ne smazané). */
  staleAnswerKeys: string[];
  progress: GuideProgress;
}

/**
 * Jednorázově rozřeší scénář. Kroky se procházejí v pořadí; podmínka se
 * vyhodnocuje nad DOSUD efektivními odpověďmi, takže odpověď na skrytém kroku
 * se nepropíše do viditelnosti navazujících kroků (invalidace větve se šíří).
 */
export function resolveGuide(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): ResolvedGuide {
  const visibleSteps: GuideStepDefinition[] = [];
  const effectiveAnswers: GuideAnswers = {};

  for (const step of def.steps) {
    const shown =
      !step.condition || evaluateCondition(step.condition, effectiveAnswers);
    if (!shown) continue;
    visibleSteps.push(step);
    const answer = answers[step.key];
    if (answer) effectiveAnswers[step.key] = answer;
  }

  const nextStep =
    visibleSteps.find((s) => !(s.key in effectiveAnswers)) ?? null;
  const answered = visibleSteps.filter((s) => s.key in effectiveAnswers).length;
  const total = visibleSteps.length;

  const knownKeys = new Set(def.steps.map((s) => s.key));
  const staleAnswerKeys = Object.keys(answers).filter(
    (key) => knownKeys.has(key) && !(key in effectiveAnswers),
  );

  return {
    visibleSteps,
    effectiveAnswers,
    nextStep,
    staleAnswerKeys,
    progress: {
      answered,
      total,
      ratio: total === 0 ? 0 : answered / total,
      complete: nextStep === null && total > 0,
    },
  };
}

/** Další nezodpovězený viditelný krok (`null` = scénář je hotový). */
export function getNextStep(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): GuideStepDefinition | null {
  return resolveGuide(def, answers).nextStep;
}

/** Postup vyplnění nad aktuálně viditelnými kroky. */
export function getProgress(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): GuideProgress {
  return resolveGuide(def, answers).progress;
}

/** Klíče odpovědí mimo platnou větev (po změně dřívější odpovědi). */
export function getStaleAnswerKeys(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): string[] {
  return resolveGuide(def, answers).staleAnswerKeys;
}

/** Vyhodnotí pravidla rozporů nad efektivními (platnými) odpověďmi. */
export function evaluateConflicts(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): GuideConflict[] {
  const { effectiveAnswers } = resolveGuide(def, answers);
  return (def.conflicts ?? [])
    .filter((rule) => evaluateCondition(rule.when, effectiveAnswers))
    .map((rule) => ({ key: rule.key, message: rule.message }));
}

/**
 * Strukturované shrnutí session: zodpovězené viditelné kroky, chybějící povinné
 * podklady, rozpory a stale větve. Bez „AI závěrů" (zadani/16 §4) — jen data.
 */
export function getSummary(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): GuideSummary {
  const resolved = resolveGuide(def, answers);
  const { visibleSteps, effectiveAnswers, staleAnswerKeys, progress } =
    resolved;

  const items = visibleSteps
    .filter((step) => step.key in effectiveAnswers)
    .map((step) => ({
      key: step.key,
      prompt: step.prompt,
      type: step.type,
      answer: effectiveAnswers[step.key],
    }));

  const missing = visibleSteps
    .filter(
      (step) =>
        (step.required ?? true) &&
        effectiveAnswers[step.key]?.status !== "answered",
    )
    .map((step) => ({ key: step.key, prompt: step.prompt }));

  return {
    items,
    missing,
    conflicts: evaluateConflicts(def, answers),
    staleAnswerKeys,
    progress,
  };
}

/** Výsledek pokusu o zápis odpovědi. */
export type ApplyAnswerResult =
  | { ok: true; answers: GuideAnswers; staleAnswerKeys: string[] }
  | { ok: false; reason: "unknown_step" | "not_visible" };

/**
 * Zapíše odpověď na krok (bez validace hodnoty — tu dělá `validateAnswer`).
 * Odmítne krok, který ve scénáři není, i krok, který právě NENÍ viditelný
 * (nesmí se odpovídat na skrytou otázku). Vrací novou mapu odpovědí (immutable)
 * a klíče, které se tím dostaly mimo platnou větev.
 */
export function applyAnswer(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
  stepKey: string,
  answer: GuideAnswer,
): ApplyAnswerResult {
  if (!def.steps.some((s) => s.key === stepKey)) {
    return { ok: false, reason: "unknown_step" };
  }
  const { visibleSteps } = resolveGuide(def, answers);
  if (!visibleSteps.some((s) => s.key === stepKey)) {
    return { ok: false, reason: "not_visible" };
  }

  const next = { ...answers, [stepKey]: answer };
  return {
    ok: true,
    answers: next,
    staleAnswerKeys: getStaleAnswerKeys(def, next),
  };
}
