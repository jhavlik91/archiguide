import { describe, expect, it } from "vitest";
import { SLUG_FALLBACK, SLUG_MAX_LENGTH, slugify, withSuffix } from "./slug";

describe("slugify", () => {
  it("odstraní diakritiku a zmenší písmena", () => {
    expect(slugify("Vila nad řekou")).toBe("vila-nad-rekou");
    expect(slugify("Rekonstrukce — Náměstí Míru")).toBe(
      "rekonstrukce-namesti-miru",
    );
  });

  it("ořízne okrajové pomlčky a slepí oddělovače", () => {
    expect(slugify("  Dům / 2024!  ")).toBe("dum-2024");
  });

  it("vrátí fallback, když nezbyde použitelný znak", () => {
    expect(slugify("🏠🏠")).toBe(SLUG_FALLBACK);
    expect(slugify("")).toBe(SLUG_FALLBACK);
  });

  it("ořízne na maximální délku bez koncové pomlčky", () => {
    const slug = slugify("a".repeat(SLUG_MAX_LENGTH + 20));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("withSuffix", () => {
  it("přidá sufix jen když je neprázdný", () => {
    expect(withSuffix("vila-nad-rekou", "")).toBe("vila-nad-rekou");
    expect(withSuffix("vila-nad-rekou", "a1b2")).toBe("vila-nad-rekou-a1b2");
  });
});
