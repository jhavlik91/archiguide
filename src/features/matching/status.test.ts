import { describe, expect, it } from "vitest";
import {
  MATCH_RECOMMENDATION_STATUSES,
  type MatchRecommendationStatus,
} from "./types";
import { canTransitionMatchStatus, isTerminalMatchStatus } from "./status";

/**
 * Testy stavového automatu doporučení (T028 § States: „new → shown →
 * shortlisted | dismissed"). Žádné zpětné přechody v MVP.
 */

describe("povolené přechody", () => {
  const ALLOWED: ReadonlyArray<
    [MatchRecommendationStatus, MatchRecommendationStatus]
  > = [
    ["new", "shown"],
    ["shown", "shortlisted"],
    ["shown", "dismissed"],
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
    ["dismissed", "shown"],
    ["dismissed", "shortlisted"],
  ];

  it.each(INVALID)("%s -> %s je odmítnuto", (from, to) => {
    expect(canTransitionMatchStatus(from, to)).toBe(false);
  });
});

describe("terminální stavy", () => {
  it("shortlisted a dismissed jsou terminální; new a shown ne", () => {
    expect(isTerminalMatchStatus("shortlisted")).toBe(true);
    expect(isTerminalMatchStatus("dismissed")).toBe(true);
    expect(isTerminalMatchStatus("new")).toBe(false);
    expect(isTerminalMatchStatus("shown")).toBe(false);
  });

  it("pokrývá celý enum stavů", () => {
    for (const status of MATCH_RECOMMENDATION_STATUSES) {
      expect(typeof canTransitionMatchStatus(status, status)).toBe("boolean");
    }
  });
});
