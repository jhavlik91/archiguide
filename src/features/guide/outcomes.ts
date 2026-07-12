/**
 * Výstupy guide (T019). Čistý modul (bez DB / `next/*`), plně testovatelný.
 *
 * Mapuje odpovědi na DOPORUČENÍ (`GuideOutcome`): profese (slugy T005), další
 * krok, podklady, případně `safetyWarning`. Render výstupů řeší T020 — tady je
 * jen logika nad daty scénáře.
 *
 * Dvě role:
 * 1. `resolveOutcomes` — které výstupy platí pro danou session (runtime).
 * 2. `findUncoveredPaths` / `collectOutcomeProfessions` — validace při seedu:
 *    žádná průchozí koncová větev bez výstupu („slepá ulička") a všechny
 *    odkazované profese existují v taxonomii.
 */

import { conditionReferencedSteps, evaluateCondition } from "./conditions";
import { resolveGuide } from "./engine";
import type {
  GuideAnswer,
  GuideAnswers,
  GuideAnswerValue,
  GuideOutcome,
  GuideScenarioDefinition,
  GuideStepDefinition,
} from "./types";

// --- Runtime: rozřešení výstupů ---------------------------------------------

/**
 * Výstupy, které platí pro dané odpovědi, v pořadí definice. Vyhodnocuje se nad
 * EFEKTIVNÍMI odpověďmi (bez stale větví), stejně jako rozpory — neplatná větev
 * tak výstup nespustí. Výstup bez `when` platí vždy (záchranná síť).
 */
export function resolveOutcomes(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): GuideOutcome[] {
  const { effectiveAnswers } = resolveGuide(def, answers);
  return (def.outcomes ?? []).filter(
    (outcome) =>
      outcome.when === undefined ||
      evaluateCondition(outcome.when, effectiveAnswers),
  );
}

/** Primární (první platný) výstup, nebo `null`, nesedne-li žádný. */
export function getPrimaryOutcome(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): GuideOutcome | null {
  return resolveOutcomes(def, answers)[0] ?? null;
}

/** Nese některý z platných výstupů bezpečnostní upozornění (§15)? */
export function hasSafetyWarning(
  def: GuideScenarioDefinition,
  answers: GuideAnswers,
): boolean {
  return resolveOutcomes(def, answers).some((o) => o.safetyWarning === true);
}

/** Unikátní slugy profesí ze všech výstupů scénáře (pro validaci taxonomie). */
export function collectOutcomeProfessions(
  def: GuideScenarioDefinition,
): string[] {
  const slugs = new Set<string>();
  for (const outcome of def.outcomes ?? []) {
    for (const slug of outcome.professions) slugs.add(slug);
  }
  return [...slugs];
}

// --- Validace: žádná slepá ulička -------------------------------------------
//
// „Průchozí koncová větev" = kombinace odpovědí, po které už engine nemá další
// viditelný krok. Enumerujeme je dopředným průchodem, ale větvíme jen na krocích,
// které ROZHODUJÍ O VÝSTUPU: kroky odkazované podmínkou `when` některého výstupu
// a — tranzitivně — kroky, na jejichž `condition` (viditelnosti) tyto závisí.
// Ostatní kroky (rozpočet, čas, rozpory…) do výběru výstupu nevstupují, takže je
// stačí projít jednou zástupnou odpovědí. Tím je enumerace řádově menší a přitom
// pro detekci slepé uličky ÚPLNÁ: výstupy na nerozhodovacích krocích nezávisí,
// takže jejich hodnota pokrytí nemění. Každá enumerovaná větev pak musí sednout
// aspoň na jeden výstup — jinak je to slepá ulička.

/** Pojistka proti kombinatorické explozi u příliš rozvětveného scénáře. */
const MAX_TERMINAL_PATHS = 50_000;

/**
 * Uzávěr kroků rozhodujících o výstupu: reference ve `when` výstupů plus
 * tranzitivně kroky, na jejichž podmínce viditelnosti tyto kroky závisí.
 */
export function decisionStepKeys(def: GuideScenarioDefinition): Set<string> {
  const stepByKey = new Map(def.steps.map((s) => [s.key, s]));
  const keys = new Set<string>();
  const queue: string[] = [];
  const add = (key: string) => {
    if (!keys.has(key)) {
      keys.add(key);
      queue.push(key);
    }
  };

  for (const outcome of def.outcomes ?? []) {
    if (outcome.when) conditionReferencedSteps(outcome.when).forEach(add);
  }
  while (queue.length > 0) {
    const step = stepByKey.get(queue.pop()!);
    if (step?.condition) conditionReferencedSteps(step.condition).forEach(add);
  }
  return keys;
}

const answered = (value: GuideAnswerValue): GuideAnswer => ({
  status: "answered",
  value,
});

/** Zástupná „answered" hodnota podle typu kroku (pro nerozhodovací kroky). */
function placeholderAnswer(step: GuideStepDefinition): GuideAnswer {
  switch (step.type) {
    case "single_choice":
      return answered(step.options?.[0]?.value ?? "");
    case "multi_choice":
      return answered([step.options?.[0]?.value ?? ""]);
    case "number":
      return answered(step.config?.min ?? 0);
    case "range": {
      const min = step.config?.min ?? 0;
      return answered({ min, max: step.config?.max ?? min + 1 });
    }
    case "location":
      return answered({ city: "Praha" });
    case "file_ref":
      return answered({ mediaIds: ["placeholder"] });
    case "text":
    default:
      return answered("…");
  }
}

/** Varianty odpovědí, přes které se na rozhodovacím kroku větví. */
function branchAnswers(step: GuideStepDefinition): GuideAnswer[] {
  const skipUnknown: GuideAnswer[] = [
    { status: "unknown" },
    { status: "skipped" },
  ];
  const options = step.options ?? [];
  switch (step.type) {
    case "single_choice":
      return [...options.map((o) => answered(o.value)), ...skipUnknown];
    case "multi_choice":
      return [
        ...options.map((o) => answered([o.value])),
        ...(options.length > 1 ? [answered(options.map((o) => o.value))] : []),
        ...skipUnknown,
      ];
    default:
      return [placeholderAnswer(step), ...skipUnknown];
  }
}

/**
 * Enumeruje všechny průchozí koncové stavy odpovědí. Rozhodovací kroky se větví,
 * ostatní dostanou zástupnou odpověď. Vyhozená výjimka = scénář je příliš
 * rozvětvený (regresní pojistka, ne běžný stav).
 */
export function enumerateTerminalAnswers(
  def: GuideScenarioDefinition,
): GuideAnswers[] {
  const decisions = decisionStepKeys(def);
  const results: GuideAnswers[] = [];

  const walk = (answers: GuideAnswers): void => {
    if (results.length > MAX_TERMINAL_PATHS) {
      throw new Error(
        `Scénář ${def.slug}: příliš mnoho koncových větví (> ${MAX_TERMINAL_PATHS}).`,
      );
    }
    const next = resolveGuide(def, answers).nextStep;
    if (!next) {
      results.push(answers);
      return;
    }
    const branches = decisions.has(next.key)
      ? branchAnswers(next)
      : [placeholderAnswer(next)];
    for (const branch of branches) {
      walk({ ...answers, [next.key]: branch });
    }
  };

  walk({});
  return results;
}

/** Koncové větve BEZ platného výstupu (slepé uličky). Prázdné pole = OK. */
export function findUncoveredPaths(
  def: GuideScenarioDefinition,
): GuideAnswers[] {
  if ((def.outcomes ?? []).length === 0) return [];
  return enumerateTerminalAnswers(def).filter(
    (answers) => resolveOutcomes(def, answers).length === 0,
  );
}
