import { describe, expect, it } from "vitest";
import { BUILTIN_SCENARIOS, MAIN_SCENARIO_SLUG } from "./scenarios";
import { validateScenarioDefinition } from "./validation";
import { getNextStep, resolveGuide } from "./engine";
import type { GuideAnswers } from "./types";

describe("zabudované scénáře", () => {
  it("každý projde validací (seed by je jinak odmítl)", () => {
    for (const def of BUILTIN_SCENARIOS) {
      expect(validateScenarioDefinition(def)).toEqual([]);
    }
  });

  it("hlavní scénář existuje a má stabilní slug", () => {
    const main = BUILTIN_SCENARIOS.find((s) => s.slug === MAIN_SCENARIO_SLUG);
    expect(main).toBeDefined();
  });
});

describe("hlavní scénář — reálné větvení", () => {
  const main = BUILTIN_SCENARIOS.find((s) => s.slug === MAIN_SCENARIO_SLUG)!;
  const answered = (value: unknown) => ({
    status: "answered" as const,
    value: value as never,
  });

  it("konzultace přeskočí lokalitu (podmínka not consultation)", () => {
    const answers: GuideAnswers = { intent: answered("consultation") };
    const visible = resolveGuide(main, answers).visibleSteps.map((s) => s.key);
    expect(visible).not.toContain("location");
    expect(visible).not.toContain("ownership");
  });

  it("rekonstrukce odkryje vlastnický vztah i podklady", () => {
    const answers: GuideAnswers = { intent: answered("reconstruction") };
    const visible = resolveGuide(main, answers).visibleSteps.map((s) => s.key);
    expect(visible).toContain("ownership");
    expect(visible).toContain("attachments");
    expect(visible).not.toContain("new_build_stage");
  });

  it("nový dům odkryje fázi přípravy, ne vlastnický vztah", () => {
    const answers: GuideAnswers = { intent: answered("new_build") };
    const visible = resolveGuide(main, answers).visibleSteps.map((s) => s.key);
    expect(visible).toContain("new_build_stage");
    expect(visible).not.toContain("ownership");
  });

  it("volba přesné částky odkryje pole částky (ne rozpětí)", () => {
    const answers: GuideAnswers = {
      intent: answered("new_build"),
      budget_known: answered("exact"),
    };
    const visible = resolveGuide(main, answers).visibleSteps.map((s) => s.key);
    expect(visible).toContain("budget_amount");
    expect(visible).not.toContain("budget_range");
  });

  it(`„nevím" u rozpočtu nezablokuje postup na časování`, () => {
    const answers: GuideAnswers = {
      intent: answered("consultation"),
      budget_known: { status: "unknown" },
    };
    expect(getNextStep(main, answers)?.key).toBe("timing");
  });
});
