import { describe, expect, it } from "vitest";
import { SLUG_FALLBACK, SLUG_MAX_LENGTH, slugify, withSuffix } from "./slug";

describe("slugify", () => {
  it("odstraní českou diakritiku a zmenší písmena", () => {
    expect(slugify("Architekt Žížala")).toBe("architekt-zizala");
    expect(slugify("Návrhy pasivních domů")).toBe("navrhy-pasivnich-domu");
  });

  it("nealfanumerické znaky sloučí do jedné pomlčky a ořízne okraje", () => {
    expect(slugify("  Ing. Jan   Novák!!!  ")).toBe("ing-jan-novak");
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
    // Ořez uprostřed pomlček nesmí nechat trailing pomlčku.
    const withDashAtCut = "a".repeat(SLUG_MAX_LENGTH - 1) + " b c";
    expect(slugify(withDashAtCut).endsWith("-")).toBe(false);
  });
});

describe("withSuffix", () => {
  it("připojí sufix jen když je neprázdný", () => {
    expect(withSuffix("jan-novak", "")).toBe("jan-novak");
    expect(withSuffix("jan-novak", "x7k2")).toBe("jan-novak-x7k2");
  });
});
