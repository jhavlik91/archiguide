import { describe, expect, it } from "vitest";
import { validateAnswer, validateScenarioDefinition } from "./validation";
import type { GuideScenarioDefinition, GuideStepDefinition } from "./types";

const step = (over: Partial<GuideStepDefinition>): GuideStepDefinition => ({
  key: "s",
  type: "text",
  prompt: "?",
  ...over,
});

describe("validateAnswer — nevím/přeskočit vždy projde", () => {
  it("unknown i skipped jsou platné bez ohledu na typ", () => {
    const number = step({ type: "number", config: { min: 0 } });
    expect(validateAnswer(number, { status: "unknown" }).ok).toBe(true);
    expect(validateAnswer(number, { status: "skipped" }).ok).toBe(true);
  });
});

describe("validateAnswer — podle typu", () => {
  it("single_choice musí být známá možnost", () => {
    const s = step({
      type: "single_choice",
      options: [{ value: "a", label: "A" }],
    });
    expect(validateAnswer(s, { status: "answered", value: "a" }).ok).toBe(true);
    expect(validateAnswer(s, { status: "answered", value: "z" }).ok).toBe(
      false,
    );
    expect(validateAnswer(s, { status: "answered", value: 1 }).ok).toBe(false);
  });

  it("multi_choice hlídá známé, unikátní hodnoty a meze počtu", () => {
    const s = step({
      type: "multi_choice",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
      config: { minSelected: 1, maxSelected: 1 },
    });
    expect(validateAnswer(s, { status: "answered", value: ["a"] }).ok).toBe(
      true,
    );
    expect(
      validateAnswer(s, { status: "answered", value: ["a", "b"] }).ok,
    ).toBe(false); // > max
    expect(validateAnswer(s, { status: "answered", value: [] }).ok).toBe(false); // < min
    expect(
      validateAnswer(s, { status: "answered", value: ["a", "a"] }).ok,
    ).toBe(false); // dup
    expect(validateAnswer(s, { status: "answered", value: ["z"] }).ok).toBe(
      false,
    ); // neznámá
  });

  it("text nesmí být prázdný a respektuje maxLength", () => {
    const s = step({ type: "text", config: { maxLength: 5 } });
    expect(validateAnswer(s, { status: "answered", value: "ok" }).ok).toBe(
      true,
    );
    expect(validateAnswer(s, { status: "answered", value: "   " }).ok).toBe(
      false,
    );
    expect(validateAnswer(s, { status: "answered", value: "toolong" }).ok).toBe(
      false,
    );
  });

  it("number hlídá konečné číslo a meze", () => {
    const s = step({ type: "number", config: { min: 0, max: 10 } });
    expect(validateAnswer(s, { status: "answered", value: 5 }).ok).toBe(true);
    expect(validateAnswer(s, { status: "answered", value: -1 }).ok).toBe(false);
    expect(validateAnswer(s, { status: "answered", value: 11 }).ok).toBe(false);
    expect(validateAnswer(s, { status: "answered", value: Infinity }).ok).toBe(
      false,
    );
  });

  it("range vyžaduje aspoň jednu mez a min ≤ max", () => {
    const s = step({ type: "range", config: { min: 0 } });
    expect(
      validateAnswer(s, { status: "answered", value: { min: 1, max: 2 } }).ok,
    ).toBe(true);
    expect(
      validateAnswer(s, { status: "answered", value: { min: null, max: 5 } })
        .ok,
    ).toBe(true);
    expect(
      validateAnswer(s, { status: "answered", value: { min: null, max: null } })
        .ok,
    ).toBe(false);
    expect(
      validateAnswer(s, { status: "answered", value: { min: 5, max: 1 } }).ok,
    ).toBe(false);
    expect(
      validateAnswer(s, { status: "answered", value: { min: -1, max: 1 } }).ok,
    ).toBe(false); // pod min
  });

  it("location vyžaduje aspoň jeden údaj a jen známá pole", () => {
    const s = step({ type: "location" });
    expect(
      validateAnswer(s, { status: "answered", value: { city: "Praha" } }).ok,
    ).toBe(true);
    expect(validateAnswer(s, { status: "answered", value: {} }).ok).toBe(false);
    expect(
      validateAnswer(s, { status: "answered", value: { foo: "x" } as never })
        .ok,
    ).toBe(false);
    expect(
      validateAnswer(s, {
        status: "answered",
        value: { city: "P", shareAddress: true },
      }).ok,
    ).toBe(true);
  });

  it("file_ref vyžaduje neprázdný seznam id", () => {
    const s = step({ type: "file_ref" });
    expect(
      validateAnswer(s, { status: "answered", value: { mediaIds: ["m1"] } }).ok,
    ).toBe(true);
    expect(
      validateAnswer(s, { status: "answered", value: { mediaIds: [] } }).ok,
    ).toBe(false);
    expect(
      validateAnswer(s, {
        status: "answered",
        value: { mediaIds: [1] as never },
      }).ok,
    ).toBe(false);
  });
});

describe("validateScenarioDefinition", () => {
  const base: GuideScenarioDefinition = {
    slug: "s",
    version: 1,
    name: "S",
    steps: [
      {
        key: "a",
        type: "single_choice",
        prompt: "?",
        options: [{ value: "x", label: "X" }],
      },
      {
        key: "b",
        type: "text",
        prompt: "?",
        condition: { op: "equals", step: "a", value: "x" },
      },
    ],
  };

  it("validní scénář nemá chyby", () => {
    expect(validateScenarioDefinition(base)).toEqual([]);
  });

  it("odhalí odkaz na pozdější krok", () => {
    const def: GuideScenarioDefinition = {
      ...base,
      steps: [
        {
          key: "a",
          type: "text",
          prompt: "?",
          condition: { op: "answered", step: "b" },
        },
        { key: "b", type: "text", prompt: "?" },
      ],
    };
    expect(
      validateScenarioDefinition(def).some((e) => e.includes("pozdější")),
    ).toBe(true);
  });

  it("odhalí odkaz na neznámý krok", () => {
    const def: GuideScenarioDefinition = {
      ...base,
      steps: [
        {
          key: "a",
          type: "text",
          prompt: "?",
          condition: { op: "answered", step: "ghost" },
        },
      ],
    };
    expect(
      validateScenarioDefinition(def).some((e) => e.includes("neznámý krok")),
    ).toBe(true);
  });

  it("odhalí duplicitní klíč a chybějící možnosti", () => {
    const def: GuideScenarioDefinition = {
      ...base,
      steps: [
        { key: "a", type: "single_choice", prompt: "?" },
        { key: "a", type: "text", prompt: "?" },
      ],
    };
    const errors = validateScenarioDefinition(def);
    expect(errors.some((e) => e.includes("Duplicitní klíč"))).toBe(true);
    expect(errors.some((e) => e.includes("vyžaduje možnosti"))).toBe(true);
  });

  it("odhalí includes mířící na non-multi-choice krok", () => {
    const def: GuideScenarioDefinition = {
      ...base,
      steps: [
        {
          key: "a",
          type: "single_choice",
          prompt: "?",
          options: [{ value: "x", label: "X" }],
        },
        {
          key: "b",
          type: "text",
          prompt: "?",
          condition: { op: "includes", step: "a", value: "x" },
        },
      ],
    };
    expect(
      validateScenarioDefinition(def).some((e) => e.includes("includes")),
    ).toBe(true);
  });
});
