import { describe, expect, it } from "vitest";
import {
  canAssignRole,
  canChangeRole,
  canLeave,
  canModifyMember,
  canRemoveMember,
  invitationExpiry,
  isInvitationActionable,
  isInvitationExpired,
  normalizeBusinessId,
  ownerCount,
  roleAtLeast,
} from "./rules";
import { INVITATION_TTL_DAYS } from "./types";

describe("roleAtLeast", () => {
  it("respektuje hierarchii owner > admin > editor > member", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("member", "editor")).toBe(false);
    expect(roleAtLeast(null, "member")).toBe(false);
  });
});

describe("canAssignRole (kdo smí přiřadit jakou roli)", () => {
  it("owner smí přiřadit cokoli včetně ownera (předání vlastnictví)", () => {
    for (const r of ["owner", "admin", "editor", "member"] as const) {
      expect(canAssignRole("owner", r)).toBe(true);
    }
  });
  it("admin smí přiřadit vše kromě ownera", () => {
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("admin", "member")).toBe(true);
  });
  it("editor ani member nesmí přiřazovat role", () => {
    expect(canAssignRole("editor", "member")).toBe(false);
    expect(canAssignRole("member", "member")).toBe(false);
  });
});

describe("canModifyMember (permission matice členů)", () => {
  const roles = ["owner", "admin", "editor", "member"] as const;
  it("owner smí upravovat kohokoli", () => {
    for (const target of roles)
      expect(canModifyMember("owner", target)).toBe(true);
  });
  it("admin smí upravovat všechny kromě ownera", () => {
    expect(canModifyMember("admin", "owner")).toBe(false);
    expect(canModifyMember("admin", "admin")).toBe(true);
    expect(canModifyMember("admin", "editor")).toBe(true);
    expect(canModifyMember("admin", "member")).toBe(true);
  });
  it("editor a member nesmí spravovat členy", () => {
    for (const target of roles) {
      expect(canModifyMember("editor", target)).toBe(false);
      expect(canModifyMember("member", target)).toBe(false);
    }
  });
});

describe("ownerCount", () => {
  it("spočítá ownery", () => {
    expect(ownerCount(["owner", "admin", "owner", "member"])).toBe(2);
    expect(ownerCount(["admin", "member"])).toBe(0);
  });
});

describe("invariant: min. 1 owner", () => {
  it("posledního ownera nelze odebrat, s dalším ownerem ano", () => {
    expect(canRemoveMember({ targetRole: "owner", ownerCount: 1 })).toBe(false);
    expect(canRemoveMember({ targetRole: "owner", ownerCount: 2 })).toBe(true);
  });
  it("neownera lze odebrat vždy", () => {
    expect(canRemoveMember({ targetRole: "admin", ownerCount: 1 })).toBe(true);
    expect(canRemoveMember({ targetRole: "member", ownerCount: 1 })).toBe(true);
  });
  it("posledního ownera nelze degradovat", () => {
    expect(
      canChangeRole({ currentRole: "owner", newRole: "admin", ownerCount: 1 }),
    ).toBe(false);
    expect(
      canChangeRole({ currentRole: "owner", newRole: "admin", ownerCount: 2 }),
    ).toBe(true);
  });
  it("owner → owner (beze změny) je vždy v pořádku", () => {
    expect(
      canChangeRole({ currentRole: "owner", newRole: "owner", ownerCount: 1 }),
    ).toBe(true);
  });
  it("povýšení na ownera je vždy v pořádku", () => {
    expect(
      canChangeRole({ currentRole: "member", newRole: "owner", ownerCount: 1 }),
    ).toBe(true);
  });
  it("poslední owner nemůže odejít, jiná role ano", () => {
    expect(canLeave({ memberRole: "owner", ownerCount: 1 })).toBe(false);
    expect(canLeave({ memberRole: "owner", ownerCount: 2 })).toBe(true);
    expect(canLeave({ memberRole: "editor", ownerCount: 1 })).toBe(true);
  });
});

describe("expirace pozvánky", () => {
  it("vyprší přesně za 14 dní", () => {
    const from = new Date("2026-07-10T00:00:00.000Z");
    const expiry = invitationExpiry(from);
    const expected = from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBe(expected);
  });
  it("isInvitationExpired podle expiresAt", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(
      isInvitationExpired({ expiresAt: new Date("2026-07-09T00:00:00Z") }, now),
    ).toBe(true);
    expect(
      isInvitationExpired({ expiresAt: new Date("2026-07-20T00:00:00Z") }, now),
    ).toBe(false);
  });
  it("reagovat lze jen na pending, která nevypršela", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const future = new Date("2026-07-20T00:00:00Z");
    const past = new Date("2026-07-01T00:00:00Z");
    expect(
      isInvitationActionable({ status: "pending", expiresAt: future }, now),
    ).toBe(true);
    expect(
      isInvitationActionable({ status: "pending", expiresAt: past }, now),
    ).toBe(false);
    expect(
      isInvitationActionable({ status: "accepted", expiresAt: future }, now),
    ).toBe(false);
    expect(
      isInvitationActionable({ status: "declined", expiresAt: future }, now),
    ).toBe(false);
  });
});

describe("normalizeBusinessId (detekce duplicit IČO)", () => {
  it("nechá jen číslice; formátování nerozlišuje", () => {
    expect(normalizeBusinessId(" 123 456 78 ")).toBe("12345678");
    expect(normalizeBusinessId("CZ12345678")).toBe("12345678");
  });
  it("prázdné / bez číslic → null", () => {
    expect(normalizeBusinessId("")).toBeNull();
    expect(normalizeBusinessId(null)).toBeNull();
    expect(normalizeBusinessId("abc")).toBeNull();
  });
});
