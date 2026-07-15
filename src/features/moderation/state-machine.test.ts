import { describe, expect, it } from "vitest";
import {
  REPORT_ACTIONS,
  REPORT_TRANSITIONS,
  canTransition,
  isTerminalState,
  isUnresolvedState,
  nextReportState,
  type ReportAction,
} from "./state-machine";
import { REPORT_STATES, type ReportState } from "./types";

/**
 * Testy stavového automatu reportu (T036 acceptance: "Unit testy stavového
 * automatu reportu"). Automat je jediný zdroj pravdy o přechodech (zadani/12 §5).
 */

const ALLOWED: ReadonlyArray<[ReportState, ReportAction, ReportState]> = [
  ["open", "triage", "triaged"],
  ["open", "start_review", "under_review"],
  ["triaged", "start_review", "under_review"],
  ["open", "dismiss", "dismissed"],
  ["triaged", "dismiss", "dismissed"],
  ["under_review", "dismiss", "dismissed"],
  ["open", "resolve", "actioned"],
  ["triaged", "resolve", "actioned"],
  ["under_review", "resolve", "actioned"],
  ["actioned", "appeal", "appealed"],
  ["dismissed", "close", "closed"],
  ["appealed", "close", "closed"],
];

describe("povolené přechody", () => {
  it.each(ALLOWED)("%s --%s--> %s", (from, action, to) => {
    expect(canTransition(from, action)).toBe(true);
    expect(nextReportState(from, action)).toBe(to);
  });

  it("happy path: open → triaged → under_review → actioned → appealed → closed", () => {
    let state: ReportState = "open";
    for (const action of [
      "triage",
      "start_review",
      "resolve",
      "appeal",
      "close",
    ] as ReportAction[]) {
      const to = nextReportState(state, action);
      expect(to).not.toBeNull();
      state = to as ReportState;
    }
    expect(state).toBe("closed");
  });

  it("dismiss path: open → dismissed → closed", () => {
    let state: ReportState = "open";
    for (const action of ["dismiss", "close"] as ReportAction[]) {
      const to = nextReportState(state, action);
      expect(to).not.toBeNull();
      state = to as ReportState;
    }
    expect(state).toBe("closed");
  });
});

describe("neplatné přechody odmítne", () => {
  const INVALID: ReadonlyArray<[ReportState, ReportAction]> = [
    ["triaged", "triage"],
    ["under_review", "triage"],
    ["actioned", "dismiss"],
    ["actioned", "resolve"],
    ["dismissed", "resolve"],
    ["dismissed", "appeal"],
    ["open", "appeal"],
    ["open", "close"],
    ["actioned", "close"],
    ["closed", "close"],
    ["appealed", "appeal"],
  ];

  it.each(INVALID)("%s --%s--> ✗", (from, action) => {
    expect(canTransition(from, action)).toBe(false);
    expect(nextReportState(from, action)).toBeNull();
  });

  it("z terminálního stavu `closed` nevede žádný přechod", () => {
    expect(isTerminalState("closed")).toBe(true);
    for (const action of REPORT_ACTIONS) {
      expect(canTransition("closed", action)).toBe(false);
    }
  });

  it("žádný jiný stav není terminální", () => {
    for (const state of REPORT_STATES) {
      if (state === "closed") continue;
      expect(isTerminalState(state)).toBe(false);
    }
  });
});

describe("nevyřešené stavy (dedupe/agregace)", () => {
  it("open, triaged, under_review jsou nevyřešené — nový report se připojí", () => {
    expect(isUnresolvedState("open")).toBe(true);
    expect(isUnresolvedState("triaged")).toBe(true);
    expect(isUnresolvedState("under_review")).toBe(true);
  });

  it("actioned, dismissed, appealed, closed už nejsou otevřené — nový report založí nový případ", () => {
    for (const state of [
      "actioned",
      "dismissed",
      "appealed",
      "closed",
    ] as ReportState[]) {
      expect(isUnresolvedState(state)).toBe(false);
    }
  });
});

describe("konzistence definic", () => {
  it("každá akce má definici s neprázdnou množinou zdrojů", () => {
    for (const action of REPORT_ACTIONS) {
      expect(REPORT_TRANSITIONS[action].from.length).toBeGreaterThan(0);
      expect(REPORT_STATES).toContain(REPORT_TRANSITIONS[action].to);
    }
  });
});
