import { describe, expect, it } from "vitest";
import { buildTaxonomy } from "../taxonomy/data";
import { ALL_SCENARIO_SLUGS, BUILTIN_SCENARIOS } from "./scenarios";
import {
  validateScenarioDefinition,
  validateScenarioProfessions,
} from "./validation";
import {
  findUncoveredPaths,
  getPrimaryOutcome,
  hasSafetyWarning,
  resolveOutcomes,
} from "./outcomes";
import { getNextStep, resolveGuide } from "./engine";
import type { GuideAnswer, GuideAnswers } from "./types";

const answered = (value: unknown): GuideAnswer => ({
  status: "answered",
  value: value as never,
});

const KNOWN_PROFESSION_SLUGS = new Set(
  buildTaxonomy().flatMap((c) => c.professions.map((p) => p.slug)),
);

function scenario(slug: string) {
  const def = BUILTIN_SCENARIOS.find((s) => s.slug === slug);
  if (!def) throw new Error(`Neznámý scénář ${slug}`);
  return def;
}

describe("zabudované scénáře (T019)", () => {
  it("obsahuje 14 scénářů (vstupní karty §7) s unikátními slugy", () => {
    expect(BUILTIN_SCENARIOS).toHaveLength(14);
    expect(new Set(ALL_SCENARIO_SLUGS).size).toBe(14);
  });

  it("každý projde strukturální validací (seed by je jinak odmítl)", () => {
    for (const def of BUILTIN_SCENARIOS) {
      expect(validateScenarioDefinition(def)).toEqual([]);
    }
  });

  it("všechny doporučené profese existují v taxonomii (T005)", () => {
    for (const def of BUILTIN_SCENARIOS) {
      expect(validateScenarioProfessions(def, KNOWN_PROFESSION_SLUGS)).toEqual(
        [],
      );
    }
  });

  it("žádná slepá ulička — každá koncová větev má výstup", () => {
    for (const def of BUILTIN_SCENARIOS) {
      expect(findUncoveredPaths(def)).toEqual([]);
    }
  });

  it("odpověď nevím u klíčových otázek nikdy nezablokuje postup", () => {
    const def = scenario("rekonstrukce-domu");
    // Odpovídej všude „nevím" a ověř, že postup nikde neuvázne a skončí výstupem.
    let current: GuideAnswers = {};
    let guard = 0;
    let next = getNextStep(def, current);
    while (next && guard < 50) {
      current = { ...current, [next.key]: { status: "unknown" } };
      next = getNextStep(def, current);
      guard += 1;
    }
    expect(getNextStep(def, current)).toBeNull();
    expect(resolveOutcomes(def, current).length).toBeGreaterThan(0);
  });
});

describe("AC — Scénář B: bourání + nevím, zda nosná → statik", () => {
  const def = scenario("rekonstrukce-domu");

  it("chci bourat + status unknown u nosnosti → primární výstup doporučí statika", () => {
    const answers: GuideAnswers = {
      ownership: answered("own"),
      scope: answered(["layout"]),
      demolition: answered("yes"),
      load_bearing: { status: "unknown" },
    };
    const outcome = getPrimaryOutcome(def, answers);
    expect(outcome?.professions).toContain("statik");
    // Nikdy netvrdí, že lze bourat.
    expect(outcome?.nextStep).not.toMatch(/lze bourat/i);
  });

  it("explicitní volba dont_know také vede na statika", () => {
    const answers: GuideAnswers = {
      ownership: answered("own"),
      scope: answered(["layout"]),
      demolition: answered("yes"),
      load_bearing: answered("dont_know"),
    };
    expect(getPrimaryOutcome(def, answers)?.professions).toContain("statik");
  });

  it("volba not_bearing → structural_assessment se neuplatní", () => {
    const answers: GuideAnswers = {
      ownership: answered("own"),
      scope: answered(["layout"]),
      demolition: answered("yes"),
      load_bearing: answered("not_bearing"),
    };
    expect(getPrimaryOutcome(def, answers)?.key).not.toBe(
      "structural_assessment",
    );
  });
});

describe("AC — Scénář F: rizikové odpovědi nesou safety_warning", () => {
  const def = scenario("technicky-problem");

  it("akutní příznak (únik plynu) → výstup se safetyWarning", () => {
    const answers: GuideAnswers = {
      acute_signs: answered(["gas_leak"]),
      problem: answered("smell"),
    };
    expect(hasSafetyWarning(def, answers)).toBe(true);
    expect(getPrimaryOutcome(def, answers)?.safetyWarning).toBe(true);
  });

  it("bez akutního příznaku → žádné safetyWarning", () => {
    const answers: GuideAnswers = {
      acute_signs: answered(["none"]),
      problem: answered("damp"),
    };
    expect(hasSafetyWarning(def, answers)).toBe(false);
    expect(getPrimaryOutcome(def, answers)?.professions).toContain(
      "specialista-vlhkosti",
    );
  });
});

describe("AC — Scénář H: volný popis → doplňující otázky → kategorie s vysvětlením", () => {
  const def = scenario("nevim-co-potrebuji");

  it("po volném popisu se ptá na cílenou doplňující otázku", () => {
    const answers: GuideAnswers = {
      description: answered("Praská mi zeď a nevím, koho zavolat."),
    };
    expect(getNextStep(def, answers)?.key).toBe("area");
  });

  it("oblast nová stavba → návrh kategorií s vysvětlením, ne rovnou firma", () => {
    const answers: GuideAnswers = {
      description: answered("Chci větší dům."),
      area: answered("build"),
    };
    const outcome = getPrimaryOutcome(def, answers);
    expect(outcome?.professions).toEqual(["architekt", "statik"]);
    expect(outcome?.note).toBeTruthy();
    expect(outcome?.nextStep).toMatch(/nepotřebujete rovnou stavební firmu/i);
  });

  it("i s přeskočeným popisem dojde k výstupu — žádná slepá ulička", () => {
    const answers: GuideAnswers = {
      description: { status: "skipped" },
      area: answered("unsure"),
      urgency: { status: "skipped" },
      attachments: { status: "skipped" },
    };
    expect(resolveGuide(def, answers).nextStep).toBeNull();
    expect(getPrimaryOutcome(def, answers)).not.toBeNull();
  });
});
