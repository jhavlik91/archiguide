import { describe, expect, it } from "vitest";
import {
  MATCH_RECOMMENDATION_STATUSES,
  type MatchRecommendationStatus,
} from "./types";
import { canTransitionMatchStatus, isTerminalMatchStatus } from "./status";

/**
 * Testy stavového automatu doporučení (T028 § States + T029 § Main flow bod 4:
 * „new → shown → shortlisted | dismissed", `dismissed → shown` = obnovení
 * skrytého, jediný zpětný přechod v MVP).
 */

describe("povolené přechody", () => {
  const ALLOWED: ReadonlyArray<
    [MatchRecommendationStatus, MatchRecommendationStatus]
  > = [
    ["new", "shown"],
    ["shown", "shortlisted"],
    ["shown", "dismissed"],
    ["dismissed", "shown"],
  ];

  it.each(ALLOWED)("%s -> %s", (from, to) => {
    expect(canTransitionMatchStatus(from, to)).toBe(true);
  });
});

describe("neplatné přechody", () => {
  const INVALID: ReadonlyArray<
    [MatchRecommendationStatus, MatchRecommendationStatus]
  > = [
    ["new", "shortlisted"],
    ["new", "dismissed"],
    ["shortlisted", "shown"],
    ["shortlisted", "dismissed"],
    ["dismissed", "shortlisted"],
  ];

  it.each(INVALID)("%s -> %s je odmítnuto", (from, to) => {
    expect(canTransitionMatchStatus(from, to)).toBe(false);
  });
});

describe("terminální stavy", () => {
  it("shortlisted je terminální; dismissed jde obnovit; new a shown nejsou terminální", () => {
    expect(isTerminalMatchStatus("shortlisted")).toBe(true);
    expect(isTerminalMatchStatus("dismissed")).toBe(false);
    expect(isTerminalMatchStatus("new")).toBe(false);
    expect(isTerminalMatchStatus("shown")).toBe(false);
  });

  it("pokrývá celý enum stavů", () => {
    for (const status of MATCH_RECOMMENDATION_STATUSES) {
      expect(typeof canTransitionMatchStatus(status, status)).toBe("boolean");
    }
  });
});
