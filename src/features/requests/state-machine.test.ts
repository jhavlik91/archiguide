import { describe, expect, it } from "vitest";
import {
  REQUEST_ACTIONS,
  REQUEST_TRANSITIONS,
  availableActions,
  canTransition,
  isAuditedAction,
  isTerminalStatus,
  nextStatus,
  ownerActions,
  type RequestAction,
} from "./state-machine";
import { REQUEST_STATUSES, type RequestStatus } from "./types";

/**
 * Testy stavového automatu poptávky (T024, acceptance: „všechny povolené přechody
 * projdou, neplatné server odmítne"). Automat je jediný zdroj pravdy o přechodech.
 */

/** Povolené přechody dle zadani/08 §3 (+ paused→cancelled — zadani/09). */
const ALLOWED: ReadonlyArray<[RequestStatus, RequestAction, RequestStatus]> = [
  ["draft", "publish", "active"],
  ["active", "start_discussion", "in_discussion"],
  ["active", "pause", "paused"],
  ["paused", "resume", "active"],
  ["in_discussion", "award", "awarded"],
  ["awarded", "close", "closed"],
  ["active", "cancel", "cancelled"],
  ["in_discussion", "cancel", "cancelled"],
  ["paused", "cancel", "cancelled"],
  ["active", "expire", "expired"],
];

describe("povolené přechody (celý happy path i alternativy)", () => {
  it.each(ALLOWED)("%s --%s--> %s", (from, action, to) => {
    expect(canTransition(from, action)).toBe(true);
    expect(nextStatus(from, action)).toBe(to);
  });

  it("kompletní životní cyklus draft → active → in_discussion → awarded → closed", () => {
    let status: RequestStatus = "draft";
    for (const action of [
      "publish",
      "start_discussion",
      "award",
      "close",
    ] as RequestAction[]) {
      const to = nextStatus(status, action);
      expect(to).not.toBeNull();
      status = to as RequestStatus;
    }
    expect(status).toBe("closed");
  });
});

describe("neplatné přechody odmítne", () => {
  const INVALID: ReadonlyArray<[RequestStatus, RequestAction]> = [
    ["draft", "pause"],
    ["draft", "cancel"],
    ["draft", "award"],
    ["draft", "close"],
    ["active", "resume"],
    ["active", "award"],
    ["active", "close"],
    ["in_discussion", "pause"],
    ["awarded", "cancel"],
    ["paused", "publish"],
    ["expired", "publish"],
  ];

  it.each(INVALID)("%s --%s--> ✗", (from, action) => {
    expect(canTransition(from, action)).toBe(false);
    expect(nextStatus(from, action)).toBeNull();
  });

  it("z terminálních stavů nevede žádný přechod", () => {
    for (const status of [
      "closed",
      "cancelled",
      "expired",
    ] as RequestStatus[]) {
      expect(isTerminalStatus(status)).toBe(true);
      expect(availableActions(status)).toHaveLength(0);
    }
  });
});

describe("audit a nabídka akcí", () => {
  it("všechny přechody se auditují (významné dle §Stavová pravidla)", () => {
    for (const action of REQUEST_ACTIONS) {
      expect(isAuditedAction(action)).toBe(true);
    }
  });

  it("vyžadované auditované přechody pokrývají publish/pause/cancel/award/close", () => {
    for (const action of [
      "publish",
      "pause",
      "cancel",
      "award",
      "close",
    ] as RequestAction[]) {
      expect(isAuditedAction(action)).toBe(true);
    }
  });

  it("ownerActions vynechá systémové přechody (start_discussion, expire)", () => {
    expect(ownerActions("active")).not.toContain("start_discussion");
    expect(ownerActions("active")).not.toContain("expire");
    expect(ownerActions("active")).toEqual(
      expect.arrayContaining(["pause", "cancel"]),
    );
    expect(ownerActions("draft")).toEqual(["publish"]);
  });

  it("každá akce má definici s neprázdnou množinou zdrojů", () => {
    for (const action of REQUEST_ACTIONS) {
      expect(REQUEST_TRANSITIONS[action].from.length).toBeGreaterThan(0);
      expect(REQUEST_STATUSES).toContain(REQUEST_TRANSITIONS[action].to);
    }
  });
});
