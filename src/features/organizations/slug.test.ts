import { describe, expect, it } from "vitest";
import { SLUG_FALLBACK, SLUG_MAX_LENGTH, slugify, withSuffix } from "./slug";

describe("slugify (organizace)", () => {
  it("odstraní českou diakritiku a zmenší písmena", () => {
    expect(slugify("Studio Žížala")).toBe("studio-zizala");
    expect(slugify("Návrhy pasivních domů")).toBe("navrhy-pasivnich-domu");
  });

  it("nealfanumerické znaky sloučí do jedné pomlčky a ořízne okraje", () => {
    expect(slugify("  Ateliér   Novák s.r.o.!!!  ")).toBe(
      "atelier-novak-s-r-o",
    );
    expect(slugify("A/B & C")).toBe("a-b-c");
  });

  it("prázdný nebo bezalfanumerický vstup dá fallback", () => {
    expect(slugify("")).toBe(SLUG_FALLBACK);
    expect(slugify("🏛️🏛️")).toBe(SLUG_FALLBACK);
    expect(slugify("—–-")).toBe(SLUG_FALLBACK);
  });

  it("ořízne na maximální délku a nenechá pomlčku na konci", () => {
    const long = "a".repeat(100);
    expect(slugify(long)).toHaveLength(SLUG_MAX_LENGTH);
    const withDashAtCut = "a".repeat(SLUG_MAX_LENGTH - 1) + " b c";
    expect(slugify(withDashAtCut).endsWith("-")).toBe(false);
  });
});

describe("withSuffix", () => {
  it("připojí sufix jen když je neprázdný", () => {
    expect(withSuffix("studio-test", "")).toBe("studio-test");
    expect(withSuffix("studio-test", "x7k2")).toBe("studio-test-x7k2");
  });
});
