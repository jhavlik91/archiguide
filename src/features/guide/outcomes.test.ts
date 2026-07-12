import { describe, expect, it } from "vitest";
import {
  collectOutcomeProfessions,
  enumerateTerminalAnswers,
  findUncoveredPaths,
  getPrimaryOutcome,
  hasSafetyWarning,
  isLowConfidence,
  resolveOutcomes,
} from "./outcomes";
import type { GuideAnswer, GuideScenarioDefinition } from "./types";

const answered = (value: unknown): GuideAnswer => ({
  status: "answered",
  value: value as never,
});

/** Malý scénář: jedna volba se dvěma větvemi + záchranný výstup. */
const fixture: GuideScenarioDefinition = {
  slug: "test",
  version: 1,
  name: "Test",
  steps: [
    {
      key: "intent",
      type: "single_choice",
      prompt: "Co chcete?",
      required: true,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    },
  ],
  outcomes: [
    {
      key: "a",
      when: { op: "equals", step: "intent", value: "a" },
      professions: ["architekt"],
      nextStep: "Konzultace s architektem.",
    },
    {
      key: "fallback",
      professions: ["diagnostik-staveb"],
      nextStep: "Obecná konzultace.",
    },
  ],
};

describe("resolveOutcomes", () => {
  it("vrátí specifický výstup, sedne-li podmínka", () => {
    const outcomes = resolveOutcomes(fixture, { intent: answered("a") });
    expect(outcomes.map((o) => o.key)).toEqual(["a", "fallback"]);
    expect(getPrimaryOutcome(fixture, { intent: answered("a") })?.key).toBe(
      "a",
    );
  });

  it("padne na záchranný výstup, nesedne-li specifický (i u statusu unknown)", () => {
    expect(getPrimaryOutcome(fixture, { intent: answered("b") })?.key).toBe(
      "fallback",
    );
    expect(
      getPrimaryOutcome(fixture, { intent: { status: "unknown" } })?.key,
    ).toBe("fallback");
  });

  it("vyhodnocuje nad efektivními odpověďmi (stale větev nespustí výstup)", () => {
    // `intent` skrytý → odpověď na něj je stale → specifický výstup se neuplatní.
    const gated: GuideScenarioDefinition = {
      ...fixture,
      steps: [
        {
          key: "gate",
          type: "single_choice",
          prompt: "Brána?",
          required: true,
          options: [
            { value: "open", label: "Otevřít" },
            { value: "closed", label: "Zavřít" },
          ],
        },
        {
          ...fixture.steps[0],
          condition: { op: "equals", step: "gate", value: "open" },
        },
      ],
    };
    const primary = getPrimaryOutcome(gated, {
      gate: answered("closed"),
      intent: answered("a"),
    });
    expect(primary?.key).toBe("fallback");
  });
});

describe("isLowConfidence (T020)", () => {
  it("samá nevím/přeskočit na viditelných krocích → true", () => {
    expect(isLowConfidence(fixture, { intent: { status: "unknown" } })).toBe(
      true,
    );
    expect(isLowConfidence(fixture, { intent: { status: "skipped" } })).toBe(
      true,
    );
  });

  it("aspoň jedna hodnotná odpověď → false", () => {
    expect(isLowConfidence(fixture, { intent: answered("a") })).toBe(false);
  });

  it("zatím nezodpovězený viditelný krok → false (jde poctivě dál)", () => {
    expect(isLowConfidence(fixture, {})).toBe(false);
  });
});

describe("hasSafetyWarning (T020)", () => {
  const withSafety: GuideScenarioDefinition = {
    ...fixture,
    outcomes: [
      {
        key: "danger",
        when: { op: "equals", step: "intent", value: "a" },
        professions: ["statik"],
        nextStep: "Přerušte užívání a volejte pohotovost.",
        safetyWarning: true,
      },
      { key: "fallback", professions: ["architekt"], nextStep: "Konzultace." },
    ],
  };

  it("rizikový výstup na platné větvi → true", () => {
    expect(hasSafetyWarning(withSafety, { intent: answered("a") })).toBe(true);
  });

  it("jiná větev bez rizikového výstupu → false", () => {
    expect(hasSafetyWarning(withSafety, { intent: answered("b") })).toBe(false);
  });
});

describe("collectOutcomeProfessions", () => {
  it("sesbírá unikátní slugy ze všech výstupů", () => {
    expect(collectOutcomeProfessions(fixture).sort()).toEqual([
      "architekt",
      "diagnostik-staveb",
    ]);
  });
});

describe("findUncoveredPaths / enumerateTerminalAnswers", () => {
  it("enumeruje obě větve volby jako koncové stavy", () => {
    const terminals = enumerateTerminalAnswers(fixture);
    // a / b / unknown / skipped
    expect(terminals.length).toBe(4);
  });

  it("scénář se záchranným výstupem nemá slepou uličku", () => {
    expect(findUncoveredPaths(fixture)).toEqual([]);
  });

  it("odhalí slepou uličku, chybí-li výstup pro některou větev", () => {
    const leaky: GuideScenarioDefinition = {
      ...fixture,
      outcomes: [
        {
          key: "a",
          when: { op: "equals", step: "intent", value: "a" },
          professions: ["architekt"],
          nextStep: "Jen pro A.",
        },
      ],
    };
    const uncovered = findUncoveredPaths(leaky);
    // Větve „b", „nevím", „přeskočit" končí bez výstupu.
    expect(uncovered.length).toBe(3);
  });

  it("scénář bez výstupů se nekontroluje (prázdné outcomes = žádná pravidla)", () => {
    const noOutcomes: GuideScenarioDefinition = { ...fixture, outcomes: [] };
    expect(findUncoveredPaths(noOutcomes)).toEqual([]);
  });
});
