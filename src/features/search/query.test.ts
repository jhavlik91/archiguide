import { describe, expect, it } from "vitest";
import { buildTsQuery, tokenize } from "./query";

/**
 * Sanitizace a sestavení fulltextového dotazu (T034 § Validation). Klíčové je,
 * že se z uživatelského vstupu nikdy neprovede tsquery operátor — vše kromě
 * písmen/číslic je oddělovač.
 */
describe("tokenize", () => {
  it("rozdělí na alfanumerické tokeny a zahodí operátory", () => {
    expect(tokenize("dřevo stavby")).toEqual(["dřevo", "stavby"]);
    expect(tokenize("  více   mezer ")).toEqual(["více", "mezer"]);
  });

  it("neutroušené tsquery operátory jsou jen oddělovače (žádná injektáž)", () => {
    expect(tokenize("a & b | c ! d : e ( f )")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
    expect(tokenize("':*!&|()")).toEqual([]);
  });

  it("ponechá diakritiku (sjednotí ji unaccent až v SQL)", () => {
    expect(tokenize("zámečník")).toEqual(["zámečník"]);
  });

  it("omezí počet i délku tokenů", () => {
    expect(tokenize(Array(20).fill("x").join(" "))).toHaveLength(10);
    expect(tokenize("a".repeat(100))[0]).toHaveLength(40);
  });
});

describe("buildTsQuery", () => {
  it("složí prefixový AND dotaz", () => {
    expect(buildTsQuery("dřevo stavby")).toBe("dřevo:* & stavby:*");
  });

  it("jeden token → jeden prefix", () => {
    expect(buildTsQuery("architekt")).toBe("architekt:*");
  });

  it("prázdný / jen operátory → null (žádný fulltext filtr)", () => {
    expect(buildTsQuery("")).toBeNull();
    expect(buildTsQuery("   ")).toBeNull();
    expect(buildTsQuery("&|!()")).toBeNull();
  });
});
