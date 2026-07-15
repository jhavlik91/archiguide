import { describe, expect, it } from "vitest";
import { categorySchema, professionSchema } from "./validation";

describe("categorySchema", () => {
  it("odmítne příliš krátký název", () => {
    expect(categorySchema.safeParse({ name: "A", position: 0 }).success).toBe(
      false,
    );
  });
  it("přijme platnou kategorii", () => {
    expect(
      categorySchema.safeParse({ name: "Zahradní architektura", position: 3 })
        .success,
    ).toBe(true);
  });
});

describe("professionSchema", () => {
  it("vyžaduje kategorii", () => {
    expect(
      professionSchema.safeParse({ name: "Topenář", categoryId: "" }).success,
    ).toBe(false);
  });
  it("přijme platnou profesi s výchozími hodnotami", () => {
    const result = professionSchema.safeParse({
      name: "Topenář",
      categoryId: "cat1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.synonyms).toEqual([]);
      expect(result.data.regulated).toBe(false);
    }
  });
});
