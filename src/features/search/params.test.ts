import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  hasActiveCriteria,
  parseSearchParams,
  toSearchParams,
} from "./params";

/**
 * Parsování a serializace URL stavu vyhledávání (T034). URL je zdroj pravdy pro
 * filtry (sdílitelné, SEO), proto se neznámé/prázdné hodnoty musí spolehlivě
 * normalizovat a round-trip zachovat.
 */
describe("parseSearchParams", () => {
  it("prázdné params → prázdný stav s výchozím řazením", () => {
    expect(parseSearchParams({})).toEqual({
      query: "",
      profession: null,
      region: null,
      specialization: null,
      verifiedOnly: false,
      sort: "relevance",
      cursor: null,
    });
  });

  it("načte a ořízne filtry; neznámé řazení spadne na relevance", () => {
    const state = parseSearchParams({
      q: "  architekt ",
      profese: "architekt",
      region: "Praha",
      specializace: "dřevostavby",
      overeny: "1",
      sort: "nonsense",
    });
    expect(state.query).toBe("architekt");
    expect(state.profession).toBe("architekt");
    expect(state.verifiedOnly).toBe(true);
    expect(state.sort).toBe("relevance");
  });

  it("overeny jiné než '1' = false; pole → první hodnota", () => {
    expect(parseSearchParams({ overeny: "true" }).verifiedOnly).toBe(false);
    expect(parseSearchParams({ q: ["a", "b"] }).query).toBe("a");
  });
});

describe("toSearchParams", () => {
  it("vynechá prázdné klíče a výchozí řazení", () => {
    expect(toSearchParams({ query: "architekt" }).toString()).toBe(
      "q=architekt",
    );
    expect(toSearchParams({ query: "x", sort: "relevance" }).toString()).toBe(
      "q=x",
    );
    expect(toSearchParams({ sort: "newest" }).toString()).toBe("sort=newest");
  });

  it("resetCursor zahodí kurzor", () => {
    const sp = toSearchParams(
      { query: "x", cursor: "abc" },
      { resetCursor: true },
    );
    expect(sp.has("cursor")).toBe(false);
  });

  it("round-trip zachová stav", () => {
    const state = parseSearchParams({
      q: "architekt",
      profese: "architekt",
      region: "Brno",
      overeny: "1",
      sort: "newest",
    });
    expect(
      parseSearchParams(Object.fromEntries(toSearchParams(state))),
    ).toEqual(state);
  });
});

describe("cursor", () => {
  it("zakóduje a dekóduje keyset kurzor", () => {
    const cursor = {
      publishedAt: "2026-07-13T00:00:00.000Z",
      id: "abc",
      rank: 0.5,
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("bez rank (newest) round-trip", () => {
    const cursor = { publishedAt: "2026-07-13T00:00:00.000Z", id: "abc" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("poškozený / prázdný kurzor → null (chová se jako první stránka)", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(
      decodeCursor(Buffer.from("{}", "utf8").toString("base64url")),
    ).toBeNull();
  });
});

describe("hasActiveCriteria", () => {
  it("false bez dotazu i filtrů, true s čímkoli", () => {
    const empty = parseSearchParams({});
    expect(hasActiveCriteria(empty)).toBe(false);
    expect(hasActiveCriteria({ ...empty, region: "Praha" })).toBe(true);
    expect(hasActiveCriteria({ ...empty, verifiedOnly: true })).toBe(true);
  });
});
