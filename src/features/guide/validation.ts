/**
 * Validace guide (T017). Čistý modul (bez DB / `next/*`).
 *
 * Dvě roviny:
 * 1. `validateAnswer` — odpověď musí odpovídat typu otázky. „nevím"/„přeskočit"
 *    jsou VŽDY platné (nikdy neblokují postup, zadani/16 §4).
 * 2. `validateScenarioDefinition` — kontrola scénáře PŘI SEEDU: jedinečné klíče,
 *    dobře utvořené možnosti a hlavně podmínky, které odkazují jen na DŘÍVĚJŠÍ
 *    kroky (jinak by větvení nešlo vyhodnotit jedním dopředným průchodem).
 */

import { conditionReferencedSteps } from "./conditions";
import { collectOutcomeProfessions, findUncoveredPaths } from "./outcomes";
import {
  GUIDE_LEAF_OPS,
  GUIDE_STEP_TYPES,
  type GuideAnswer,
  type GuideCondition,
  type GuideFileRefValue,
  type GuideLocationValue,
  type GuideRangeValue,
  type GuideScenarioDefinition,
  type GuideStepConfig,
  type GuideStepDefinition,
} from "./types";

// --- Validace odpovědi ------------------------------------------------------

export type ValidateAnswerResult = { ok: true } | { ok: false; error: string };

const OK: ValidateAnswerResult = { ok: true };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ověří, že odpověď sedí na typ kroku. `unknown`/`skipped` projdou vždy.
 * `answered` musí nést hodnotu odpovídajícího tvaru a splnit `config` meze.
 */
export function validateAnswer(
  step: GuideStepDefinition,
  answer: GuideAnswer,
): ValidateAnswerResult {
  if (answer.status !== "answered") return OK;

  const value = answer.value;
  const config: GuideStepConfig = step.config ?? {};
  const optionValues = new Set((step.options ?? []).map((o) => o.value));

  switch (step.type) {
    case "single_choice": {
      if (typeof value !== "string") return err("Očekávána jedna možnost.");
      if (!optionValues.has(value)) return err("Neznámá možnost.");
      return OK;
    }
    case "multi_choice": {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        return err("Očekáván seznam možností.");
      }
      const values = value as string[];
      if (new Set(values).size !== values.length)
        return err("Duplicitní možnost.");
      if (values.some((v) => !optionValues.has(v)))
        return err("Neznámá možnost.");
      if (config.minSelected != null && values.length < config.minSelected) {
        return err(`Vyberte alespoň ${config.minSelected} možnost(í).`);
      }
      if (config.maxSelected != null && values.length > config.maxSelected) {
        return err(`Vyberte nejvýše ${config.maxSelected} možnost(í).`);
      }
      return OK;
    }
    case "text": {
      if (typeof value !== "string") return err("Očekáván text.");
      if (value.trim().length === 0) return err("Text nesmí být prázdný.");
      if (config.maxLength != null && value.length > config.maxLength) {
        return err(`Text je delší než ${config.maxLength} znaků.`);
      }
      return OK;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return err("Očekáváno číslo.");
      }
      return withinBounds(value, config);
    }
    case "range":
      return validateRange(value, config);
    case "location":
      return validateLocation(value);
    case "file_ref":
      return validateFileRef(value);
    default:
      return err("Neznámý typ otázky.");
  }
}

function err(error: string): ValidateAnswerResult {
  return { ok: false, error };
}

function withinBounds(
  value: number,
  config: GuideStepConfig,
): ValidateAnswerResult {
  if (config.min != null && value < config.min)
    return err(`Minimum je ${config.min}.`);
  if (config.max != null && value > config.max)
    return err(`Maximum je ${config.max}.`);
  return OK;
}

function validateRange(
  value: unknown,
  config: GuideStepConfig,
): ValidateAnswerResult {
  if (!isPlainObject(value)) return err("Očekáváno rozpětí { min, max }.");
  const { min, max } = value as unknown as GuideRangeValue;
  const minOk = min === null || typeof min === "number";
  const maxOk = max === null || typeof max === "number";
  if (!minOk || !maxOk) return err("Meze rozpětí musí být čísla nebo null.");
  if (min == null && max == null)
    return err("Zadejte alespoň jednu mez rozpětí.");
  if (typeof min === "number" && !Number.isFinite(min))
    return err("Neplatná dolní mez.");
  if (typeof max === "number" && !Number.isFinite(max))
    return err("Neplatná horní mez.");
  if (typeof min === "number" && typeof max === "number" && min > max) {
    return err("Dolní mez je větší než horní.");
  }
  if (typeof min === "number") {
    const bounded = withinBounds(min, config);
    if (!bounded.ok) return bounded;
  }
  if (typeof max === "number") {
    const bounded = withinBounds(max, config);
    if (!bounded.ok) return bounded;
  }
  return OK;
}

const LOCATION_KEYS: Array<keyof GuideLocationValue> = [
  "country",
  "region",
  "city",
  "municipality",
  "approximate",
  "address",
  "shareAddress",
];

function validateLocation(value: unknown): ValidateAnswerResult {
  if (!isPlainObject(value)) return err("Očekávána lokalita.");
  const entries = Object.entries(value);
  if (
    entries.some(
      ([key]) => !LOCATION_KEYS.includes(key as keyof GuideLocationValue),
    )
  ) {
    return err("Neznámé pole lokality.");
  }
  const loc = value as GuideLocationValue;
  for (const key of LOCATION_KEYS) {
    if (key === "shareAddress") continue;
    const v = loc[key];
    if (v !== undefined && typeof v !== "string")
      return err("Pole lokality musí být text.");
  }
  if (loc.shareAddress !== undefined && typeof loc.shareAddress !== "boolean") {
    return err("`shareAddress` musí být boolean.");
  }
  // Aspoň jeden lokalitní údaj (jinak je odpověď prázdná → spíš „přeskočit").
  const hasAny = LOCATION_KEYS.filter((k) => k !== "shareAddress").some(
    (k) => typeof loc[k] === "string" && (loc[k] as string).trim().length > 0,
  );
  if (!hasAny) return err("Zadejte alespoň jeden údaj o lokalitě.");
  return OK;
}

function validateFileRef(value: unknown): ValidateAnswerResult {
  if (!isPlainObject(value)) return err("Očekáván odkaz na podklady.");
  const { mediaIds } = value as unknown as GuideFileRefValue;
  if (
    !Array.isArray(mediaIds) ||
    mediaIds.some((id) => typeof id !== "string")
  ) {
    return err("`mediaIds` musí být seznam id.");
  }
  if (mediaIds.length === 0) return err("Přiložte alespoň jeden podklad.");
  return OK;
}

// --- Validace scénáře (seed) ------------------------------------------------

/**
 * Zkontroluje definici scénáře před seedem. Vrací seznam chyb (prázdný = OK).
 * Kontroluje mj., že podmínky odkazují jen na dřívější, existující kroky — to je
 * předpoklad korektního jednosměrného vyhodnocení větvení v `engine.ts`.
 */
export function validateScenarioDefinition(
  def: GuideScenarioDefinition,
): string[] {
  const errors: string[] = [];

  if (!def.slug || def.slug.trim().length === 0)
    errors.push("Chybí slug scénáře.");
  if (!def.name || def.name.trim().length === 0)
    errors.push("Chybí název scénáře.");
  if (!Number.isInteger(def.version) || def.version < 1) {
    errors.push("Verze scénáře musí být celé číslo ≥ 1.");
  }
  if (def.steps.length === 0) errors.push("Scénář nemá žádné kroky.");

  const seenKeys = new Set<string>();
  const keyPosition = new Map<string, number>();
  def.steps.forEach((step, index) => {
    if (seenKeys.has(step.key)) {
      errors.push(`Duplicitní klíč kroku: ${step.key}.`);
    }
    seenKeys.add(step.key);
    keyPosition.set(step.key, index);
  });

  def.steps.forEach((step, index) => {
    if (!GUIDE_STEP_TYPES.includes(step.type)) {
      errors.push(`Krok ${step.key}: neznámý typ ${step.type}.`);
    }
    if (!step.prompt || step.prompt.trim().length === 0) {
      errors.push(`Krok ${step.key}: chybí text otázky.`);
    }
    errors.push(...validateStepOptions(step));
    if (step.condition) {
      errors.push(
        ...validateCondition(step.condition, step.key, index, keyPosition, def),
      );
    }
  });

  (def.conflicts ?? []).forEach((rule) => {
    if (!rule.key) errors.push("Pravidlo rozporu bez klíče.");
    if (!rule.message) errors.push(`Rozpor ${rule.key}: chybí zpráva.`);
    // Rozpor smí odkazovat na kterýkoli krok — index za koncem = bez limitu.
    errors.push(
      ...validateCondition(
        rule.when,
        `conflict:${rule.key}`,
        def.steps.length,
        keyPosition,
        def,
      ),
    );
  });

  errors.push(...validateOutcomes(def, keyPosition));

  return errors;
}

/**
 * Zkontroluje výstupy scénáře (T019): jedinečné klíče, doporučenou profesi i
 * další krok, dobře utvořenou podmínku `when` a hlavně — ŽÁDNOU SLEPOU ULIČKU:
 * každá průchozí koncová větev musí sednout aspoň na jeden výstup
 * (`findUncoveredPaths`). Existenci profesí v taxonomii řeší
 * `validateScenarioProfessions` (potřebuje seznam slugů, který sem nepatří).
 */
function validateOutcomes(
  def: GuideScenarioDefinition,
  keyPosition: Map<string, number>,
): string[] {
  const errors: string[] = [];
  const outcomes = def.outcomes ?? [];
  const seen = new Set<string>();

  outcomes.forEach((outcome) => {
    if (!outcome.key) {
      errors.push("Výstup bez klíče.");
    } else if (seen.has(outcome.key)) {
      errors.push(`Duplicitní klíč výstupu: ${outcome.key}.`);
    }
    if (outcome.key) seen.add(outcome.key);

    if (
      !Array.isArray(outcome.professions) ||
      outcome.professions.length === 0
    ) {
      errors.push(`Výstup ${outcome.key}: chybí doporučené profese.`);
    }
    if (!outcome.nextStep || outcome.nextStep.trim().length === 0) {
      errors.push(`Výstup ${outcome.key}: chybí doporučený další krok.`);
    }
    if (outcome.when) {
      // Výstup smí odkazovat na kterýkoli krok — index za koncem = bez limitu.
      errors.push(
        ...validateCondition(
          outcome.when,
          `outcome:${outcome.key}`,
          def.steps.length,
          keyPosition,
          def,
        ),
      );
    }
  });

  // Slepé uličky kontrolujeme jen u strukturálně validních scénářů (jinak by
  // enumerace běžela nad rozbitou definicí).
  if (errors.length === 0 && outcomes.length > 0) {
    const uncovered = findUncoveredPaths(def);
    if (uncovered.length > 0) {
      const sample = uncovered
        .slice(0, 3)
        .map((a) => JSON.stringify(a))
        .join("; ");
      errors.push(
        `Slepá ulička: ${uncovered.length} koncová větev bez výstupu (např. ${sample}).`,
      );
    }
  }

  return errors;
}

/**
 * Ověří, že všechny profese doporučené výstupy existují v taxonomii (T005).
 * Odděleno od `validateScenarioDefinition`, protože potřebuje seznam platných
 * slugů zvenčí (seed / test). Vrací seznam chybějících slugů (prázdný = OK).
 */
export function validateScenarioProfessions(
  def: GuideScenarioDefinition,
  knownProfessionSlugs: ReadonlySet<string>,
): string[] {
  return collectOutcomeProfessions(def).filter(
    (slug) => !knownProfessionSlugs.has(slug),
  );
}

function validateStepOptions(step: GuideStepDefinition): string[] {
  const errors: string[] = [];
  const needsOptions =
    step.type === "single_choice" || step.type === "multi_choice";
  const options = step.options ?? [];
  if (needsOptions) {
    if (options.length === 0) {
      errors.push(`Krok ${step.key}: typ ${step.type} vyžaduje možnosti.`);
    }
    const values = new Set<string>();
    for (const option of options) {
      if (!option.value || !option.label) {
        errors.push(`Krok ${step.key}: možnost bez value/label.`);
      }
      if (values.has(option.value)) {
        errors.push(
          `Krok ${step.key}: duplicitní hodnota možnosti ${option.value}.`,
        );
      }
      values.add(option.value);
    }
  } else if (options.length > 0) {
    errors.push(`Krok ${step.key}: typ ${step.type} nemá mít možnosti.`);
  }
  return errors;
}

/**
 * Ověří, že podmínka odkazuje jen na existující kroky, a to DŘÍVĚJŠÍ než
 * `ownerIndex` (pro podmínky rozporů se předává index za koncem = bez limitu).
 * Zároveň hlídá, že `includes` míří na multi-choice krok.
 */
function validateCondition(
  condition: GuideCondition,
  ownerKey: string,
  ownerIndex: number,
  keyPosition: Map<string, number>,
  def: GuideScenarioDefinition,
): string[] {
  const errors: string[] = [];
  for (const refKey of conditionReferencedSteps(condition)) {
    const refIndex = keyPosition.get(refKey);
    if (refIndex === undefined) {
      errors.push(`${ownerKey}: podmínka odkazuje na neznámý krok ${refKey}.`);
      continue;
    }
    if (refIndex >= ownerIndex) {
      errors.push(
        `${ownerKey}: podmínka odkazuje na pozdější/týž krok ${refKey}.`,
      );
    }
  }
  for (const leaf of leafConditions(condition)) {
    if (leaf.op === "includes") {
      const refStep = def.steps.find((s) => s.key === leaf.step);
      if (refStep && refStep.type !== "multi_choice") {
        errors.push(
          `${ownerKey}: \`includes\` míří na non-multi-choice krok ${leaf.step}.`,
        );
      }
    }
  }
  return errors;
}

/** Rozloží podmínku na listové (step-vázané) operátory. */
function leafConditions(
  condition: GuideCondition,
): Array<Extract<GuideCondition, { step: string }>> {
  switch (condition.op) {
    case "all":
    case "any":
      return condition.conditions.flatMap(leafConditions);
    case "not":
      return leafConditions(condition.condition);
    default:
      return GUIDE_LEAF_OPS.includes(condition.op)
        ? [condition as Extract<GuideCondition, { step: string }>]
        : [];
  }
}
