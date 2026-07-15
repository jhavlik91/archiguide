import { describe, expect, it } from "vitest";
import { MATCH_WEIGHTS } from "./config";
import {
  computeProfileCompleteness,
  scoreCandidate,
  type ScoringCandidate,
} from "./scoring";

/**
 * Testy čistého skórování (T028, acceptance: „region a specializace zvyšují
 * skóre"; „každé doporučení má ≥1 strukturovaný důvod"; „nikdy jako procento").
 * Tvrdý filtr profese a konflikt zájmů žijí v `service.ts` (DB vrstva) — zde
 * kandidát vždy PŘICHÁZÍ s ≥1 shodnou profesí (viz `service.test.ts`).
 */

function baseCandidate(
  overrides: Partial<ScoringCandidate> = {},
): ScoringCandidate {
  return {
    userId: "u-candidate",
    matchedProfessions: [
      { slug: "architekt", name: "Architekt", isPrimary: false },
    ],
    location: null,
    serviceAreas: [],
    specializations: [],
    projectTypes: [],
    availability: "open",
    verified: false,
    publishedProjectCount: 0,
    completeness: 0,
    ...overrides,
  };
}

describe("profese", () => {
  it("hlavní profese váží víc než vedlejší", () => {
    const primary = scoreCandidate(
      baseCandidate({
        matchedProfessions: [
          { slug: "architekt", name: "Architekt", isPrimary: true },
        ],
      }),
      { region: "", projectType: null },
    );
    const secondary = scoreCandidate(baseCandidate(), {
      region: "",
      projectType: null,
    });
    expect(primary.score).toBeGreaterThan(secondary.score);
    expect(primary.score - secondary.score).toBeCloseTo(
      MATCH_WEIGHTS.professionPrimary - MATCH_WEIGHTS.professionSecondary,
      5,
    );
  });

  it("doporučení vždy nese ≥1 strukturovaný důvod obsahující profession_match", () => {
    const { reasons } = scoreCandidate(baseCandidate(), {
      region: "",
      projectType: null,
    });
    expect(reasons.length).toBeGreaterThanOrEqual(1);
    expect(reasons.some((r) => r.type === "profession_match")).toBe(true);
  });
});

describe("region", () => {
  it("shoda regionu (přes serviceAreas) zvyšuje skóre a přidá důvod", () => {
    const withoutRegion = scoreCandidate(baseCandidate(), {
      region: "Praha",
      projectType: null,
    });
    const withRegion = scoreCandidate(
      baseCandidate({ serviceAreas: ["Praha a okolí"] }),
      { region: "Praha", projectType: null },
    );
    expect(withRegion.score).toBeGreaterThan(withoutRegion.score);
    expect(withRegion.reasons.some((r) => r.type === "region")).toBe(true);
    expect(withoutRegion.reasons.some((r) => r.type === "region")).toBe(false);
  });

  it("shoda regionu přes lokalitu funguje bez diakritiky", () => {
    const result = scoreCandidate(baseCandidate({ location: "Brno" }), {
      region: "brno",
      projectType: null,
    });
    expect(result.reasons.some((r) => r.type === "region")).toBe(true);
  });

  it("prázdný region poptávky nikdy neprodukuje region reason", () => {
    const result = scoreCandidate(baseCandidate({ location: "Brno" }), {
      region: "",
      projectType: null,
    });
    expect(result.reasons.some((r) => r.type === "region")).toBe(false);
  });
});

describe("specializace", () => {
  it("shoda specializace s typem projektu zvyšuje skóre a přidá důvod", () => {
    const withoutSpec = scoreCandidate(baseCandidate(), {
      region: "",
      projectType: "Rekonstrukce bytu",
    });
    const withSpec = scoreCandidate(
      baseCandidate({ specializations: ["Rekonstrukce bytů"] }),
      { region: "", projectType: "Rekonstrukce bytu" },
    );
    expect(withSpec.score).toBeGreaterThan(withoutSpec.score);
    expect(withSpec.reasons.some((r) => r.type === "specialization")).toBe(
      true,
    );
  });
});

describe("podobné projekty (portfolio)", () => {
  it("publikované portfolio odpovídající typu projektu přidá similar_projects a vyšší skóre", () => {
    const generic = scoreCandidate(
      baseCandidate({ publishedProjectCount: 8 }),
      { region: "", projectType: "Rekonstrukce bytu" },
    );
    const matching = scoreCandidate(
      baseCandidate({
        publishedProjectCount: 8,
        projectTypes: ["Rekonstrukce bytu"],
      }),
      { region: "", projectType: "Rekonstrukce bytu" },
    );
    expect(matching.score).toBeGreaterThan(generic.score);
    expect(matching.reasons.some((r) => r.type === "similar_projects")).toBe(
      true,
    );
    expect(generic.reasons.some((r) => r.type === "similar_projects")).toBe(
      true,
    );
  });

  it("žádné publikované portfolio → žádný similar_projects důvod", () => {
    const result = scoreCandidate(baseCandidate({ publishedProjectCount: 0 }), {
      region: "",
      projectType: "Rekonstrukce bytu",
    });
    expect(result.reasons.some((r) => r.type === "similar_projects")).toBe(
      false,
    );
  });
});

describe("dostupnost — penalizuje, NIKDY nevylučuje (§ Edge cases)", () => {
  it("nulová dostupnost sníží skóre, ale kandidát dál dostane doporučení s vysvětlením", () => {
    const open = scoreCandidate(baseCandidate({ availability: "open" }), {
      region: "",
      projectType: null,
    });
    const unavailable = scoreCandidate(
      baseCandidate({ availability: "unavailable" }),
      { region: "", projectType: null },
    );
    expect(unavailable.score).toBeLessThan(open.score);
    expect(
      unavailable.reasons.some((r) => r.type === "limited_availability"),
    ).toBe(true);
    // Skóre existuje (kandidát NENÍ vyloučen) a stále nese profession_match.
    expect(unavailable.reasons.some((r) => r.type === "profession_match")).toBe(
      true,
    );
  });

  it("omezená kapacita penalizuje méně než nulová dostupnost", () => {
    const limited = scoreCandidate(baseCandidate({ availability: "limited" }), {
      region: "",
      projectType: null,
    });
    const unavailable = scoreCandidate(
      baseCandidate({ availability: "unavailable" }),
      { region: "", projectType: null },
    );
    expect(limited.score).toBeGreaterThan(unavailable.score);
  });
});

describe("skóre nikdy nevypadá jako procento přesnosti", () => {
  it("je to plain number, ne řetězec s '%'", () => {
    const { score } = scoreCandidate(baseCandidate(), {
      region: "",
      projectType: null,
    });
    expect(typeof score).toBe("number");
    expect(String(score)).not.toContain("%");
  });
});

describe("kompletnost profilu — jen tie-break, nikdy nepřeváží skutečnou shodu", () => {
  it("kompletnost nikdy nepřeváží rozdíl hlavní vs. vedlejší profese", () => {
    const fullProfile = computeProfileCompleteness({
      headline: "Ateliér",
      bio: "Bio",
      photoUrl: "https://x/y.jpg",
      location: "Praha",
      serviceAreas: ["Praha"],
      specializations: ["Rekonstrukce"],
      projectTypes: ["Byt"],
      yearsOfExperience: 10,
      pricingModel: "hourly",
    });
    const emptyProfile = computeProfileCompleteness({
      headline: null,
      bio: null,
      photoUrl: null,
      location: null,
      serviceAreas: [],
      specializations: [],
      projectTypes: [],
      yearsOfExperience: null,
      pricingModel: null,
    });
    expect(fullProfile).toBeGreaterThan(emptyProfile);

    const secondaryFull = scoreCandidate(
      baseCandidate({ completeness: fullProfile }),
      { region: "", projectType: null },
    );
    const primaryEmpty = scoreCandidate(
      baseCandidate({
        completeness: emptyProfile,
        matchedProfessions: [
          { slug: "architekt", name: "Architekt", isPrimary: true },
        ],
      }),
      { region: "", projectType: null },
    );
    expect(primaryEmpty.score).toBeGreaterThan(secondaryFull.score);
  });
});
