import { describe, expect, it } from "vitest";
import { responseInputSchema, responseRejectSchema } from "./validation";
import { RESPONSE_MAX_PORTFOLIO_ITEMS } from "./types";

/**
 * Testy validace vstupu reakce (T027, § Validation): zpráva povinná; cenový
 * model/poznámka/dostupnost nepovinné („neuvedeno" je validní); horní limit
 * počtu přiložených portfolio projektů.
 */

const base = {
  message: "Rád bych na projektu spolupracoval.",
  priceModel: "",
  priceNote: "",
  availability: "",
  portfolioProjectIds: [] as string[],
};

describe("responseInputSchema", () => {
  it("přijme validní vstup a prázdná pole převede na null", () => {
    const parsed = responseInputSchema.parse(base);
    expect(parsed.priceModel).toBeNull();
    expect(parsed.priceNote).toBeNull();
    expect(parsed.availability).toBeNull();
    expect(parsed.portfolioProjectIds).toEqual([]);
  });

  it("odmítne prázdnou zprávu", () => {
    expect(
      responseInputSchema.safeParse({ ...base, message: "  " }).success,
    ).toBe(false);
  });

  it("přijme validní cenový model a zachová poznámku/dostupnost", () => {
    const parsed = responseInputSchema.parse({
      ...base,
      priceModel: "hourly",
      priceNote: "od 1 500 Kč/h",
      availability: "od září",
    });
    expect(parsed.priceModel).toBe("hourly");
    expect(parsed.priceNote).toBe("od 1 500 Kč/h");
    expect(parsed.availability).toBe("od září");
  });

  it("odmítne neplatný cenový model", () => {
    expect(
      responseInputSchema.safeParse({ ...base, priceModel: "negotiable" })
        .success,
    ).toBe(false);
  });

  it("deduplikuje přiložené portfolio projekty a odfiltruje prázdné", () => {
    const parsed = responseInputSchema.parse({
      ...base,
      portfolioProjectIds: ["p1", "p1", " ", "p2"],
    });
    expect(parsed.portfolioProjectIds).toEqual(["p1", "p2"]);
  });

  it(`odmítne víc než ${RESPONSE_MAX_PORTFOLIO_ITEMS} přiložených projektů`, () => {
    const ids = Array.from(
      { length: RESPONSE_MAX_PORTFOLIO_ITEMS + 1 },
      (_, i) => `p${i}`,
    );
    expect(
      responseInputSchema.safeParse({ ...base, portfolioProjectIds: ids })
        .success,
    ).toBe(false);
  });
});

describe("responseRejectSchema", () => {
  it("prázdný důvod je validní (→ null)", () => {
    expect(responseRejectSchema.parse({ reason: "" }).reason).toBeNull();
  });

  it("zachová vyplněný důvod", () => {
    expect(
      responseRejectSchema.parse({ reason: "Hledáme jinou specializaci." })
        .reason,
    ).toBe("Hledáme jinou specializaci.");
  });
});
