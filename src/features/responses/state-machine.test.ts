import { describe, expect, it } from "vitest";
import {
  RESPONSE_ACTIONS,
  RESPONSE_TRANSITIONS,
  authorActions,
  availableResponseActions,
  canTransitionResponse,
  isAuditedResponseAction,
  isTerminalResponseStatus,
  nextResponseStatus,
  ownerResponseActions,
  type ResponseAction,
} from "./state-machine";
import { RESPONSE_STATUSES, type ResponseStatus } from "./types";

/**
 * Testy stavového automatu reakce na poptávku (T027, acceptance: „unit testy
 * stavového automatu reakce včetně neplatných přechodů"). Automat je jediný
 * zdroj pravdy o přechodech.
 */

/** Povolené přechody dle T027 § Main flow bod 3. */
const ALLOWED: ReadonlyArray<[ResponseStatus, ResponseAction, ResponseStatus]> = [
  ["draft", "send", "sent"],
  ["sent", "mark_viewed", "viewed"],
  ["viewed", "shortlist", "shortlisted"],
  ["shortlisted", "accept", "accepted"],
  ["sent", "withdraw", "withdrawn"],
  ["viewed", "reject", "rejected"],
  ["shortlisted", "reject", "rejected"],
  ["shortlisted", "withdraw", "withdrawn"],
];

describe("povolené přechody (celý happy path i alternativy)", () => {
  it.each(ALLOWED)("%s --%s--> %s", (from, action, to) => {
    expect(canTransitionResponse(from, action)).toBe(true);
    expect(nextResponseStatus(from, action)).toBe(to);
  });

  it("kompletní životní cyklus draft → sent → viewed → shortlisted → accepted", () => {
    let status: ResponseStatus = "draft";
    for (const action of [
      "send",
      "mark_viewed",
      "shortlist",
      "accept",
    ] as ResponseAction[]) {
      const to = nextResponseStatus(status, action);
      expect(to).not.toBeNull();
      status = to as ResponseStatus;
    }
    expect(status).toBe("accepted");
  });
});

describe("neplatné přechody odmítne", () => {
  const INVALID: ReadonlyArray<[ResponseStatus, ResponseAction]> = [
    ["draft", "mark_viewed"],
    ["draft", "shortlist"],
    ["draft", "accept"],
    ["draft", "withdraw"],
    ["sent", "shortlist"],
    ["sent", "accept"],
    // `viewed → withdrawn` NENÍ v diagramu (jen `sent`/`shortlisted` → withdrawn).
    ["viewed", "withdraw"],
    ["viewed", "accept"],
    ["shortlisted", "mark_viewed"],
    ["accepted", "reject"],
    ["rejected", "withdraw"],
    ["withdrawn", "send"],
  ];

  it.each(INVALID)("%s --%s--> ✗", (from, action) => {
    expect(canTransitionResponse(from, action)).toBe(false);
    expect(nextResponseStatus(from, action)).toBeNull();
  });

  it("z terminálních stavů nevede žádný přechod", () => {
    for (const status of ["accepted", "rejected", "withdrawn"] as ResponseStatus[]) {
      expect(isTerminalResponseStatus(status)).toBe(true);
      expect(availableResponseActions(status)).toHaveLength(0);
    }
  });
});

describe("audit a rozdělení akcí mezi autora a vlastníka", () => {
  it("shortlist/accept/reject/withdraw se auditují; send/mark_viewed ne", () => {
    for (const action of ["shortlist", "accept", "reject", "withdraw"] as ResponseAction[]) {
      expect(isAuditedResponseAction(action)).toBe(true);
    }
    for (const action of ["send", "mark_viewed"] as ResponseAction[]) {
      expect(isAuditedResponseAction(action)).toBe(false);
    }
  });

  it("authorActions nabídne jen withdraw (nikdy systémové send/mark_viewed)", () => {
    expect(authorActions("sent")).toEqual(["withdraw"]);
    expect(authorActions("shortlisted")).toEqual(["withdraw"]);
    expect(authorActions("viewed")).toEqual([]);
    expect(authorActions("draft")).toEqual([]);
  });

  it("ownerResponseActions vynechá systémové přechody i withdraw (jen autor)", () => {
    expect(ownerResponseActions("sent")).not.toContain("mark_viewed");
    expect(ownerResponseActions("viewed")).toEqual(
      expect.arrayContaining(["shortlist", "reject"]),
    );
    expect(ownerResponseActions("shortlisted")).toEqual(
      expect.arrayContaining(["accept", "reject"]),
    );
    expect(ownerResponseActions("shortlisted")).not.toContain("withdraw");
    expect(ownerResponseActions("draft")).toEqual([]);
  });

  it("každá akce má definici s neprázdnou množinou zdrojů", () => {
    for (const action of RESPONSE_ACTIONS) {
      expect(RESPONSE_TRANSITIONS[action].from.length).toBeGreaterThan(0);
      expect(RESPONSE_STATUSES).toContain(RESPONSE_TRANSITIONS[action].to);
    }
  });
});
