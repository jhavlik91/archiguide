/**
 * Vyhodnocení podmínkového DSL guide (T017). Čistý modul (bez DB / `next/*`).
 *
 * Podmínka je deklarativní výraz nad odpověďmi (`GuideAnswers`). Používá se pro
 * zobrazení kroku (`GuideStepDefinition.condition`) i pro pravidla rozporů
 * (`GuideConflictRule.when`). Vyhodnocení běží VŽDY na serveru — klient nikdy
 * neurčuje větvení.
 *
 * Sémantika vůči „nevím"/„přeskočit": porovnávací operátory (`equals`, `in`,
 * `includes`) pracují jen s reálnou hodnotou (`answered`) — na `unknown`/`skipped`
 * vracejí `false`. Pro dotaz na samotný stav slouží `answered`/`unknown`/
 * `skipped`/`exists`.
 */

import type { GuideAnswer, GuideAnswers, GuideCondition } from "./types";

/** Vytáhne hodnotu z odpovědi (jen `answered`); jinak `undefined`. */
function answeredValue(answer: GuideAnswer | undefined): unknown {
  if (!answer || answer.status !== "answered") return undefined;
  return answer.value;
}

/** Odpověď typu single-value string/number (pro `equals`/`in`). */
function scalarValue(
  answer: GuideAnswer | undefined,
): string | number | undefined {
  const value = answeredValue(answer);
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}

/** Vyhodnotí podmínku nad odpověďmi. Neznámý operátor je bezpečně `false`. */
export function evaluateCondition(
  condition: GuideCondition,
  answers: GuideAnswers,
): boolean {
  switch (condition.op) {
    case "all":
      return condition.conditions.every((c) => evaluateCondition(c, answers));
    case "any":
      return condition.conditions.some((c) => evaluateCondition(c, answers));
    case "not":
      return !evaluateCondition(condition.condition, answers);
    case "equals":
      return scalarValue(answers[condition.step]) === condition.value;
    case "in":
      return condition.values.includes(
        scalarValue(answers[condition.step]) as never,
      );
    case "includes": {
      const value = answeredValue(answers[condition.step]);
      return Array.isArray(value) && value.includes(condition.value);
    }
    case "answered":
      return answers[condition.step]?.status === "answered";
    case "unknown":
      return answers[condition.step]?.status === "unknown";
    case "skipped":
      return answers[condition.step]?.status === "skipped";
    case "exists":
      return answers[condition.step] !== undefined;
    default:
      return false;
  }
}

/**
 * Klíče kroků, na které se podmínka odkazuje. Slouží validaci (odkaz smí mířit
 * jen na dřívější krok) — proto vrací i duplicity zdola nahoru přes stromové ops.
 */
export function conditionReferencedSteps(condition: GuideCondition): string[] {
  switch (condition.op) {
    case "all":
    case "any":
      return condition.conditions.flatMap(conditionReferencedSteps);
    case "not":
      return conditionReferencedSteps(condition.condition);
    default:
      return [condition.step];
  }
}
