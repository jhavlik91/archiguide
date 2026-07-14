import { describe, expect, it } from "vitest";
import { requestInputSchema } from "./validation";

/**
 * Testy validace vstupu poptávky (T024, §Validation): povinné ≥1 profese, region,
 * typ; rozpočet/časový horizont „neuvedeno" (prázdné → null) je validní.
 */

const base = {
  title: "Rekonstrukce bytu",
  type: "b2c" as const,
  targetProfessionSlugs: ["architekt"],
  region: "Praha",
  budget: "",
  timeline: "",
  deadline: "",
};

describe("requestInputSchema", () => {
  it("přijme validní vstup a prázdný rozpočet/čas převede na null", () => {
    const parsed = requestInputSchema.parse(base);
    expect(parsed.budget).toBeNull();
    expect(parsed.timeline).toBeNull();
    expect(parsed.deadline).toBeNull();
    expect(parsed.targetProfessionSlugs).toEqual(["architekt"]);
  });

  it("odmítne prázdný seznam cílových profesí", () => {
    const result = requestInputSchema.safeParse({
      ...base,
      targetProfessionSlugs: [],
    });
    expect(result.success).toBe(false);
  });

  it("deduplikuje cílové profese a odfiltruje prázdné", () => {
    const parsed = requestInputSchema.parse({
      ...base,
      targetProfessionSlugs: ["architekt", "architekt", " ", "statik"],
    });
    expect(parsed.targetProfessionSlugs).toEqual(["architekt", "statik"]);
  });

  it("odmítne prázdný region a prázdný název", () => {
    expect(
      requestInputSchema.safeParse({ ...base, region: "  " }).success,
    ).toBe(false);
    expect(requestInputSchema.safeParse({ ...base, title: "" }).success).toBe(
      false,
    );
  });

  it("zachová vyplněný rozpočet a časový horizont", () => {
    const parsed = requestInputSchema.parse({
      ...base,
      budget: "500 000 Kč",
      timeline: "do jara",
    });
    expect(parsed.budget).toBe("500 000 Kč");
    expect(parsed.timeline).toBe("do jara");
  });

  it("odmítne neplatné datum termínu, přijme validní ISO", () => {
    expect(
      requestInputSchema.safeParse({ ...base, deadline: "not-a-date" }).success,
    ).toBe(false);
    const ok = requestInputSchema.parse({ ...base, deadline: "2026-09-01" });
    expect(ok.deadline).toBe("2026-09-01");
  });
});
