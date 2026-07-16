import { describe, expect, it } from "vitest";
import {
  REVIEW_ACTIONS,
  REVIEW_TRANSITIONS,
  canTransitionReview,
  isPubliclyVisible,
  nextReviewStatus,
  type ReviewAction,
} from "./state-machine";
import { REVIEW_STATUSES, type ReviewStatus } from "./types";

/**
 * Testy stavového automatu recenze (T037, zadani/08 §6). Automat je jediný
 * zdroj pravdy o přechodech.
 */

const ALLOWED: ReadonlyArray<[ReviewStatus, ReviewAction, ReviewStatus]> = [
  ["published", "dispute", "disputed"],
  ["disputed", "resolve_dismiss", "published"],
  ["published", "resolve_hide", "hidden"],
  ["disputed", "resolve_hide", "hidden"],
  ["hidden", "restore", "published"],
];

describe("povolené přechody", () => {
  it.each(ALLOWED)("%s --%s--> %s", (from, action, to) => {
    expect(canTransitionReview(from, action)).toBe(true);
    expect(nextReviewStatus(from, action)).toBe(to);
  });
});

describe("neplatné přechody odmítne", () => {
  const INVALID: ReadonlyArray<[ReviewStatus, ReviewAction]> = [
    ["published", "resolve_dismiss"],
    ["published", "restore"],
    ["disputed", "dispute"],
    ["disputed", "restore"],
    ["hidden", "dispute"],
    ["hidden", "resolve_dismiss"],
    ["hidden", "resolve_hide"],
  ];

  it.each(INVALID)("%s --%s--> ✗", (from, action) => {
    expect(canTransitionReview(from, action)).toBe(false);
    expect(nextReviewStatus(from, action)).toBeNull();
  });

  it("každá akce má definici s neprázdnou množinou zdrojů", () => {
    for (const action of REVIEW_ACTIONS) {
      expect(REVIEW_TRANSITIONS[action].from.length).toBeGreaterThan(0);
      expect(REVIEW_STATUSES).toContain(REVIEW_TRANSITIONS[action].to);
    }
  });
});

describe("isPubliclyVisible (§ acceptance criteria — skrytá recenze není veřejná)", () => {
  it("published a disputed jsou veřejné", () => {
    expect(isPubliclyVisible("published")).toBe(true);
    expect(isPubliclyVisible("disputed")).toBe(true);
  });

  it("hidden není veřejná", () => {
    expect(isPubliclyVisible("hidden")).toBe(false);
  });
});
