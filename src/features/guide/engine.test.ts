import { describe, expect, it } from "vitest";
import {
  applyAnswer,
  evaluateConflicts,
  getNextStep,
  getProgress,
  getStaleAnswerKeys,
  getSummary,
  resolveGuide,
} from "./engine";
import type { GuideAnswers, GuideScenarioDefinition } from "./types";

/** Kompaktní scénář s větvením pro testy enginu (nezávislý na seedu). */
const scenario: GuideScenarioDefinition = {
  slug: "test",
  version: 1,
  name: "Test",
  steps: [
    {
      key: "intent",
      type: "single_choice",
      prompt: "Co chcete?",
      options: [
        { value: "A", label: "A" },
        { value: "B", label: "B" },
      ],
    },
    {
      key: "a_detail",
      type: "single_choice",
      prompt: "Detail A",
      condition: { op: "equals", step: "intent", value: "A" },
      options: [
        { value: "a1", label: "a1" },
        { value: "a2", label: "a2" },
      ],
    },
    {
      key: "b_detail",
      type: "single_choice",
      prompt: "Detail B",
      condition: { op: "equals", step: "intent", value: "B" },
      options: [
        { value: "b1", label: "b1" },
        { value: "b2", label: "b2" },
      ],
    },
    {
      key: "common",
      type: "single_choice",
      prompt: "Společná otázka",
      options: [
        { value: "x", label: "x" },
        { value: "y", label: "y" },
      ],
    },
  ],
  conflicts: [
    {
      key: "a_with_x",
      message: "Rozpor: A a zároveň x.",
      when: {
        op: "all",
        conditions: [
          { op: "equals", step: "intent", value: "A" },
          { op: "equals", step: "common", value: "x" },
        ],
      },
    },
  ],
};

const answered = (value: string) => ({ status: "answered" as const, value });

describe("větvení (acceptance: A vede jinou cestou než B)", () => {
  it("odpověď A odkryje a_detail, ne b_detail", () => {
    const answers: GuideAnswers = { intent: answered("A") };
    const visible = resolveGuide(scenario, answers).visibleSteps.map(
      (s) => s.key,
    );
    expect(visible).toEqual(["intent", "a_detail", "common"]);
    expect(getNextStep(scenario, answers)?.key).toBe("a_detail");
  });

  it("odpověď B odkryje b_detail, ne a_detail", () => {
    const answers: GuideAnswers = { intent: answered("B") };
    const visible = resolveGuide(scenario, answers).visibleSteps.map(
      (s) => s.key,
    );
    expect(visible).toEqual(["intent", "b_detail", "common"]);
    expect(getNextStep(scenario, answers)?.key).toBe("b_detail");
  });
});

describe(`„nevím"/„přeskočit" nikdy nezablokuje postup`, () => {
  it("unknown na kroku posune na další krok", () => {
    const answers: GuideAnswers = { intent: { status: "unknown" } };
    // intent není na A ani B → větve skryté, další je common.
    expect(getNextStep(scenario, answers)?.key).toBe("common");
  });

  it("skip všech viditelných kroků scénář dokončí", () => {
    const answers: GuideAnswers = {
      intent: { status: "skipped" },
      common: { status: "skipped" },
    };
    expect(getNextStep(scenario, answers)).toBeNull();
    expect(getProgress(scenario, answers).complete).toBe(true);
  });
});

describe("změna dřívější odpovědi přepočítá další kroky", () => {
  it("přepnutí A→B zneplatní odpověď z A větve (stale, nesmaže se)", () => {
    let answers: GuideAnswers = {
      intent: answered("A"),
      a_detail: answered("a1"),
    };
    expect(getStaleAnswerKeys(scenario, answers)).toEqual([]);

    // Uživatel změní intent na B.
    const applied = applyAnswer(scenario, answers, "intent", answered("B"));
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    answers = applied.answers;

    // a_detail zůstane v datech, ale je mimo platnou větev.
    expect(answers.a_detail).toEqual(answered("a1"));
    expect(getStaleAnswerKeys(scenario, answers)).toEqual(["a_detail"]);
    // Další krok je nově b_detail.
    expect(getNextStep(scenario, answers)?.key).toBe("b_detail");

    // Přepnutí zpět na A stale odpověď opět zplatní (nebyla smazána).
    const back = applyAnswer(scenario, answers, "intent", answered("A"));
    expect(
      back.ok && getStaleAnswerKeys(scenario, back.ok ? back.answers : {}),
    ).toEqual([]);
  });
});

describe("applyAnswer — stráž viditelnosti", () => {
  it("odmítne krok, který není ve scénáři", () => {
    const res = applyAnswer(scenario, {}, "nope", answered("x"));
    expect(res).toEqual({ ok: false, reason: "unknown_step" });
  });

  it("odmítne odpověď na skrytý krok", () => {
    // b_detail je skrytý, dokud intent není B.
    const res = applyAnswer(
      scenario,
      { intent: answered("A") },
      "b_detail",
      answered("b1"),
    );
    expect(res).toEqual({ ok: false, reason: "not_visible" });
  });
});

describe("rozpory a shrnutí", () => {
  it("rozpor se hlásí nad efektivními odpověďmi", () => {
    const answers: GuideAnswers = {
      intent: answered("A"),
      a_detail: answered("a1"),
      common: answered("x"),
    };
    expect(evaluateConflicts(scenario, answers).map((c) => c.key)).toEqual([
      "a_with_x",
    ]);
  });

  it("rozpor ze stale větve se nespustí", () => {
    // intent=B → common=x, ale ve stale datech zůstalo intent by-A? Ne: přepneme
    // tak, že common=x platí jen s A. S B žádný rozpor.
    const answers: GuideAnswers = {
      intent: answered("B"),
      common: answered("x"),
    };
    expect(evaluateConflicts(scenario, answers)).toEqual([]);
  });

  it("summary vypíše viditelné odpovědi, chybějící povinné a postup", () => {
    const answers: GuideAnswers = { intent: answered("B") };
    const summary = getSummary(scenario, answers);
    expect(summary.items.map((i) => i.key)).toEqual(["intent"]);
    expect(summary.missing.map((m) => m.key)).toEqual(["b_detail", "common"]);
    expect(summary.progress).toMatchObject({
      answered: 1,
      total: 3,
      complete: false,
    });
  });
});
