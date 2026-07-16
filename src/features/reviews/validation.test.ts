import { describe, expect, it } from "vitest";
import {
  reviewDisputeSchema,
  reviewInputSchema,
  reviewReplySchema,
} from "./validation";
import { REVIEW_CRITERIA } from "./types";

/**
 * Testy validace vstupu hodnocení (T037, § Validation): všechna kritéria
 * povinná v rozsahu 1–5, text volitelný; odpověď a spor mají povinný text.
 */

const validRatings = Object.fromEntries(REVIEW_CRITERIA.map((c) => [c, 4]));

describe("reviewInputSchema", () => {
  it("přijme validní vstup a prázdný text převede na null", () => {
    const parsed = reviewInputSchema.parse({
      ratings: validRatings,
      text: "  ",
    });
    expect(parsed.text).toBeNull();
    expect(parsed.ratings).toEqual(validRatings);
  });

  it("zachová vyplněný text", () => {
    const parsed = reviewInputSchema.parse({
      ratings: validRatings,
      text: "Skvělá spolupráce.",
    });
    expect(parsed.text).toBe("Skvělá spolupráce.");
  });

  it("odmítne chybějící kritérium", () => {
    const incomplete = Object.fromEntries(
      Object.entries(validRatings).filter(
        ([key]) => key !== REVIEW_CRITERIA[0],
      ),
    );
    expect(
      reviewInputSchema.safeParse({ ratings: incomplete, text: "" }).success,
    ).toBe(false);
  });

  it.each([0, 6, 3.5])("odmítne hodnocení mimo škálu 1–5 (%s)", (value) => {
    expect(
      reviewInputSchema.safeParse({
        ratings: { ...validRatings, quality: value },
        text: "",
      }).success,
    ).toBe(false);
  });
});

describe("reviewReplySchema", () => {
  it("odmítne prázdnou odpověď", () => {
    expect(reviewReplySchema.safeParse({ text: "  " }).success).toBe(false);
  });

  it("přijme vyplněnou odpověď", () => {
    expect(
      reviewReplySchema.parse({ text: "Děkujeme za zpětnou vazbu." }).text,
    ).toBe("Děkujeme za zpětnou vazbu.");
  });
});

describe("reviewDisputeSchema", () => {
  it("odmítne příliš krátký důvod", () => {
    expect(reviewDisputeSchema.safeParse({ reason: "ne" }).success).toBe(false);
  });

  it("přijme vyplněný důvod sporu", () => {
    expect(
      reviewDisputeSchema.parse({
        reason: "Hodnocení neodpovídá průběhu zakázky.",
      }).reason,
    ).toBe("Hodnocení neodpovídá průběhu zakázky.");
  });
});
