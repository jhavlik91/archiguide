import { describe, expect, it } from "vitest";
import {
  canPublish,
  coauthorResponseStatus,
  hasTitle,
  isCoauthorPubliclyVisible,
  isEditableStatus,
  isYearInRange,
  yearMax,
} from "./rules";
import { YEAR_MIN } from "./types";

describe("hasTitle", () => {
  it("prázdný nebo whitespace titul se nepočítá", () => {
    expect(hasTitle("")).toBe(false);
    expect(hasTitle("   ")).toBe(false);
    expect(hasTitle(null)).toBe(false);
    expect(hasTitle(undefined)).toBe(false);
    expect(hasTitle("Rodinný dům")).toBe(true);
  });
});

describe("isYearInRange", () => {
  const now = new Date("2026-07-11T00:00:00Z");

  it("prázdný rok je validní (pole je volitelné)", () => {
    expect(isYearInRange(null, now)).toBe(true);
    expect(isYearInRange(undefined, now)).toBe(true);
  });

  it("přijme rok v rozsahu a odmítne mimo", () => {
    expect(isYearInRange(2020, now)).toBe(true);
    expect(isYearInRange(YEAR_MIN, now)).toBe(true);
    expect(isYearInRange(yearMax(now), now)).toBe(true);
    expect(isYearInRange(YEAR_MIN - 1, now)).toBe(false);
    expect(isYearInRange(yearMax(now) + 1, now)).toBe(false);
  });

  it("odmítne neceločíselný rok", () => {
    expect(isYearInRange(2020.5, now)).toBe(false);
  });
});

describe("canPublish", () => {
  it("vyžaduje titul i obsah", () => {
    expect(canPublish({ title: "Dům", hasContent: true })).toBe(true);
    expect(canPublish({ title: "Dům", hasContent: false })).toBe(false);
    expect(canPublish({ title: "", hasContent: true })).toBe(false);
    expect(canPublish({ title: "   ", hasContent: true })).toBe(false);
  });
});

describe("isEditableStatus", () => {
  it("draft a published lze editovat, archived ne", () => {
    expect(isEditableStatus("draft")).toBe(true);
    expect(isEditableStatus("published")).toBe(true);
    expect(isEditableStatus("archived")).toBe(false);
  });
});

describe("spoluautoři", () => {
  it("veřejně se zobrazí jen potvrzený spoluautor", () => {
    expect(isCoauthorPubliclyVisible("confirmed")).toBe(true);
    expect(isCoauthorPubliclyVisible("invited")).toBe(false);
    expect(isCoauthorPubliclyVisible("declined")).toBe(false);
  });

  it("odpověď mapuje na cílový stav", () => {
    expect(coauthorResponseStatus("accept")).toBe("confirmed");
    expect(coauthorResponseStatus("decline")).toBe("declined");
  });
});
