import { describe, expect, it } from "vitest";
import { conditionReferencedSteps, evaluateCondition } from "./conditions";
import type { GuideAnswers, GuideCondition } from "./types";

const answers: GuideAnswers = {
  intent: { status: "answered", value: "reconstruction" },
  rooms: { status: "answered", value: ["kitchen", "bathroom"] },
  budget: { status: "answered", value: 500000 },
  timing: { status: "unknown" },
  note: { status: "skipped" },
};

describe("evaluateCondition — listové operátory", () => {
  it("equals porovnává skalární hodnotu", () => {
    expect(
      evaluateCondition(
        { op: "equals", step: "intent", value: "reconstruction" },
        answers,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "equals", step: "intent", value: "new_build" },
        answers,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { op: "equals", step: "budget", value: 500000 },
        answers,
      ),
    ).toBe(true);
  });

  it("in testuje příslušnost do množiny", () => {
    expect(
      evaluateCondition(
        { op: "in", step: "intent", values: ["reconstruction", "buy_check"] },
        answers,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "in", step: "intent", values: ["new_build"] },
        answers,
      ),
    ).toBe(false);
  });

  it("includes hledá hodnotu v multi-choice poli", () => {
    expect(
      evaluateCondition(
        { op: "includes", step: "rooms", value: "kitchen" },
        answers,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "includes", step: "rooms", value: "garage" },
        answers,
      ),
    ).toBe(false);
  });

  it("stavové operátory rozliší answered/unknown/skipped/exists", () => {
    expect(evaluateCondition({ op: "answered", step: "intent" }, answers)).toBe(
      true,
    );
    expect(evaluateCondition({ op: "answered", step: "timing" }, answers)).toBe(
      false,
    );
    expect(evaluateCondition({ op: "unknown", step: "timing" }, answers)).toBe(
      true,
    );
    expect(evaluateCondition({ op: "skipped", step: "note" }, answers)).toBe(
      true,
    );
    expect(evaluateCondition({ op: "exists", step: "timing" }, answers)).toBe(
      true,
    );
    expect(evaluateCondition({ op: "exists", step: "missing" }, answers)).toBe(
      false,
    );
  });

  it("equals/in/includes na unknown/skipped odpovědi vrací false", () => {
    expect(
      evaluateCondition(
        { op: "equals", step: "timing", value: "immediately" },
        answers,
      ),
    ).toBe(false);
    expect(
      evaluateCondition({ op: "in", step: "note", values: ["a"] }, answers),
    ).toBe(false);
  });
});

describe("evaluateCondition — stromové operátory", () => {
  const cond: GuideCondition = {
    op: "all",
    conditions: [
      { op: "in", step: "intent", values: ["reconstruction"] },
      {
        op: "any",
        conditions: [
          { op: "equals", step: "budget", value: 1 },
          { op: "answered", step: "budget" },
        ],
      },
      { op: "not", condition: { op: "answered", step: "timing" } },
    ],
  };

  it("all/any/not se skládají", () => {
    expect(evaluateCondition(cond, answers)).toBe(true);
  });

  it("neznámý operátor je bezpečně false", () => {
    expect(
      evaluateCondition({ op: "wat" } as unknown as GuideCondition, answers),
    ).toBe(false);
  });
});

describe("conditionReferencedSteps", () => {
  it("posbírá klíče ze všech větví", () => {
    const cond: GuideCondition = {
      op: "all",
      conditions: [
        { op: "equals", step: "a", value: 1 },
        { op: "not", condition: { op: "answered", step: "b" } },
        { op: "any", conditions: [{ op: "includes", step: "c", value: "x" }] },
      ],
    };
    expect(conditionReferencedSteps(cond).sort()).toEqual(["a", "b", "c"]);
  });
});
