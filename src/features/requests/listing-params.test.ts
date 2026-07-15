import { describe, expect, it } from "vitest";
import {
  decodeListingCursor,
  encodeListingCursor,
  parseListingParams,
  toListingParams,
} from "./listing-params";
import { hasActiveRequestFilters } from "./listing-types";

describe("parseListingParams", () => {
  it("prázdné params → prázdný stav", () => {
    expect(parseListingParams({})).toEqual({
      profession: null,
      region: null,
      type: null,
      budgetBand: null,
      cursor: null,
    });
  });

  it("načte a ořízne platné filtry", () => {
    const state = parseListingParams({
      profese: "architekt",
      region: " Praha ",
      typ: "b2b",
      rozpocet: "1m_5m",
    });
    expect(state.profession).toBe("architekt");
    expect(state.region).toBe("Praha");
    expect(state.type).toBe("b2b");
    expect(state.budgetBand).toBe("1m_5m");
  });

  it("neznámý typ/pásmo se zahodí (ne chyba)", () => {
    const state = parseListingParams({ typ: "nesmysl", rozpocet: "nesmysl" });
    expect(state.type).toBeNull();
    expect(state.budgetBand).toBeNull();
  });

  it("pole → první hodnota", () => {
    expect(parseListingParams({ region: ["Brno", "Praha"] }).region).toBe(
      "Brno",
    );
  });
});

describe("toListingParams", () => {
  it("vynechá prázdné klíče", () => {
    expect(toListingParams({}).toString()).toBe("");
    expect(toListingParams({ region: "Praha" }).toString()).toBe(
      "region=Praha",
    );
  });

  it("resetCursor zahodí kurzor", () => {
    const sp = toListingParams(
      { region: "Praha", cursor: "abc" },
      { resetCursor: true },
    );
    expect(sp.has("cursor")).toBe(false);
  });

  it("round-trip zachová stav", () => {
    const state = parseListingParams({
      profese: "architekt",
      region: "Brno",
      typ: "b2c",
      rozpocet: "over_5m",
    });
    expect(
      parseListingParams(Object.fromEntries(toListingParams(state))),
    ).toEqual(state);
  });
});

describe("kurzor", () => {
  it("zakóduje a dekóduje", () => {
    const cursor = { publishedAt: "2026-07-13T00:00:00.000Z", id: "abc" };
    expect(decodeListingCursor(encodeListingCursor(cursor))).toEqual(cursor);
  });

  it("poškozený / prázdný kurzor → null", () => {
    expect(decodeListingCursor(null)).toBeNull();
    expect(decodeListingCursor("not-base64-json")).toBeNull();
    expect(
      decodeListingCursor(Buffer.from("{}", "utf8").toString("base64url")),
    ).toBeNull();
  });
});

describe("hasActiveRequestFilters", () => {
  it("false bez filtrů, true s čímkoli", () => {
    const empty = parseListingParams({});
    expect(hasActiveRequestFilters(empty)).toBe(false);
    expect(hasActiveRequestFilters({ ...empty, region: "Praha" })).toBe(true);
    expect(hasActiveRequestFilters({ ...empty, budgetBand: "over_5m" })).toBe(
      true,
    );
  });
});
