import { describe, expect, it } from "vitest";
import { extractBudgetAmount, matchesBudgetBand } from "./budget-band";

describe("extractBudgetAmount", () => {
  it("vytáhne číslo s mezerami jako tisícovým oddělovačem", () => {
    expect(extractBudgetAmount("cca 1 500 000 Kč")).toBe(1_500_000);
  });

  it("vytáhne krátké číslo bez oddělovače", () => {
    expect(extractBudgetAmount("150000")).toBe(150_000);
  });

  it("null / \"neuvedeno\" / text bez čísla → null", () => {
    expect(extractBudgetAmount(null)).toBeNull();
    expect(extractBudgetAmount("Rozpočet neuveden")).toBeNull();
    expect(extractBudgetAmount("")).toBeNull();
  });
});

describe("matchesBudgetBand", () => {
  it("zařadí do správného pásma dle dolní/horní meze", () => {
    expect(matchesBudgetBand("150 000 Kč", "under_200k")).toBe(true);
    expect(matchesBudgetBand("200 000 Kč", "under_200k")).toBe(false);
    expect(matchesBudgetBand("200 000 Kč", "200k_1m")).toBe(true);
    expect(matchesBudgetBand("999 999 Kč", "200k_1m")).toBe(true);
    expect(matchesBudgetBand("1 000 000 Kč", "200k_1m")).toBe(false);
    expect(matchesBudgetBand("1 000 000 Kč", "1m_5m")).toBe(true);
    expect(matchesBudgetBand("5 000 000 Kč", "1m_5m")).toBe(false);
    expect(matchesBudgetBand("6 000 000 Kč", "over_5m")).toBe(true);
  });

  it("nerozpoznatelný rozpočet nikdy nespadá do žádného pásma", () => {
    expect(matchesBudgetBand(null, "under_200k")).toBe(false);
    expect(matchesBudgetBand("Rozpočet neuveden", "over_5m")).toBe(false);
  });
});
