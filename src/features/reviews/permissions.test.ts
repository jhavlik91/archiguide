import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canCreateReview,
  canDisputeReview,
  canReplyToReview,
} from "./permissions";

/**
 * Testy oprávnění hodnocení (T037, zadani/05 — „Vytvořit recenzi":
 * N | C | C | C | C | C | N | Y). Vytvořit smí jen vlastník poptávky s
 * eligibilitou; odpovědět/rozporovat jen cíl recenze (hodnocený).
 */

const OWNER_ID = "u-owner";
const TARGET_ID = "u-target";
const ORG_ID = "org-1";

const owner: Actor = {
  kind: "user",
  userId: OWNER_ID,
  roles: ["client"],
  activeContext: "client",
};
const admin: Actor = {
  kind: "user",
  userId: "u-admin",
  roles: ["admin"],
  activeContext: "client",
};
const moderatorOnly: Actor = {
  kind: "user",
  userId: OWNER_ID,
  roles: ["moderator"],
  activeContext: "client",
};
const target: Actor = {
  kind: "user",
  userId: TARGET_ID,
  roles: ["professional"],
  activeContext: "professional",
};
const stranger: Actor = {
  kind: "user",
  userId: "u-other",
  roles: ["professional"],
  activeContext: "professional",
};

describe("canCreateReview", () => {
  it("vlastník poptávky s eligibilitou smí založit recenzi", () => {
    expect(
      canCreateReview(owner, {
        requestOwnerUserId: OWNER_ID,
        isEligible: true,
      }),
    ).toBe(true);
  });

  it("bez eligibility (žádná accepted interakce, nebo už recenzováno) nesmí", () => {
    expect(
      canCreateReview(owner, {
        requestOwnerUserId: OWNER_ID,
        isEligible: false,
      }),
    ).toBe(false);
  });

  it("cizí uživatel nesmí založit recenzi za vlastníka", () => {
    expect(
      canCreateReview(stranger, {
        requestOwnerUserId: OWNER_ID,
        isEligible: true,
      }),
    ).toBe(false);
  });

  it("účet POUZE s rolí moderátor nesmí hodnotit", () => {
    expect(
      canCreateReview(moderatorOnly, {
        requestOwnerUserId: OWNER_ID,
        isEligible: true,
      }),
    ).toBe(false);
  });

  it("návštěvník nikdy", () => {
    expect(
      canCreateReview(VISITOR, {
        requestOwnerUserId: OWNER_ID,
        isEligible: true,
      }),
    ).toBe(false);
  });

  it("admin smí i bez eligibility (matice — Admin Y)", () => {
    expect(
      canCreateReview(admin, {
        requestOwnerUserId: OWNER_ID,
        isEligible: false,
      }),
    ).toBe(true);
  });
});

describe("canReplyToReview / canDisputeReview — jen cíl recenze", () => {
  const userTarget = {
    target: { type: "professional" as const, userId: TARGET_ID },
  };

  it("hodnocený profesionál smí odpovědět i rozporovat", () => {
    expect(canReplyToReview(target, userTarget)).toBe(true);
    expect(canDisputeReview(target, userTarget)).toBe(true);
  });

  it("recenzent (vlastník poptávky) nesmí odpovídat ani rozporovat vlastní recenzi", () => {
    expect(canReplyToReview(owner, userTarget)).toBe(false);
    expect(canDisputeReview(owner, userTarget)).toBe(false);
  });

  it("cizí uživatel nesmí", () => {
    expect(canReplyToReview(stranger, userTarget)).toBe(false);
  });

  it("firemní cíl vyžaduje org editor+", () => {
    const orgTarget = {
      target: { type: "organization" as const, orgId: ORG_ID },
    };
    expect(
      canReplyToReview(stranger, { ...orgTarget, isOrgEditor: false }),
    ).toBe(false);
    expect(
      canReplyToReview(stranger, { ...orgTarget, isOrgEditor: true }),
    ).toBe(true);
  });

  it("admin smí i bez být cílem", () => {
    expect(canReplyToReview(admin, userTarget)).toBe(true);
    expect(canDisputeReview(admin, userTarget)).toBe(true);
  });
});
