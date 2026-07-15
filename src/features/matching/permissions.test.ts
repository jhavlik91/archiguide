import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import { canReadMatches, canUpdateMatchStatus } from "./permissions";

/**
 * Testy oprávnění matching (T028 § Permissions): „Doporučení k poptávce čte
 * jen vlastník poptávky + admin." Profesionál (kandidát doporučení) nemá k
 * doporučení přístup vůbec — o tom, že byl doporučen, se nedozví (slot T032).
 */

const OWNER = "u-owner";
const owner: Actor = {
  kind: "user",
  userId: OWNER,
  roles: ["client"],
  activeContext: "client",
};
const admin: Actor = {
  kind: "user",
  userId: "u-admin",
  roles: ["admin"],
  activeContext: "client",
};
const stranger: Actor = {
  kind: "user",
  userId: "u-other",
  roles: ["client"],
  activeContext: "client",
};
const candidateProfessional: Actor = {
  kind: "user",
  userId: "u-candidate",
  roles: ["professional"],
  activeContext: "professional",
};

describe("canReadMatches — vlastník nebo admin", () => {
  const subject = { ownerUserId: OWNER };

  it("vlastník i admin smí číst", () => {
    expect(canReadMatches(owner, subject)).toBe(true);
    expect(canReadMatches(admin, subject)).toBe(true);
  });

  it("cizí uživatel, kandidát profesionál ani návštěvník nesmí", () => {
    expect(canReadMatches(stranger, subject)).toBe(false);
    expect(canReadMatches(candidateProfessional, subject)).toBe(false);
    expect(canReadMatches(VISITOR, subject)).toBe(false);
  });
});

describe("canUpdateMatchStatus — vlastník nebo admin", () => {
  const subject = { ownerUserId: OWNER };

  it("vlastník i admin smí měnit stav (shortlist/dismiss)", () => {
    expect(canUpdateMatchStatus(owner, subject)).toBe(true);
    expect(canUpdateMatchStatus(admin, subject)).toBe(true);
  });

  it("cizí uživatel a návštěvník nesmí", () => {
    expect(canUpdateMatchStatus(stranger, subject)).toBe(false);
    expect(canUpdateMatchStatus(VISITOR, subject)).toBe(false);
  });
});
