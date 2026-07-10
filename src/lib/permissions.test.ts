import { describe, expect, it } from "vitest";
import {
  type ActiveContext,
  type Actor,
  type Role,
  P_ACCESS_ADMIN_AREA,
  P_MANAGE_PLATFORM,
  VISITOR,
  can,
  definePermission,
  hasAnyRole,
  hasRole,
  inContext,
  isPermissionDefined,
} from "./permissions";

function user(
  roles: Role[],
  activeContext: ActiveContext = "client",
): Actor {
  return { kind: "user", userId: "u1", roles, activeContext };
}

describe("hasRole / hasAnyRole", () => {
  it("návštěvník nemá žádnou roli", () => {
    expect(hasRole(VISITOR, "admin")).toBe(false);
    expect(hasAnyRole(VISITOR, "admin", "client")).toBe(false);
  });

  it("uživatel má jen přiřazené role", () => {
    const actor = user(["client", "professional"]);
    expect(hasRole(actor, "client")).toBe(true);
    expect(hasRole(actor, "professional")).toBe(true);
    expect(hasRole(actor, "admin")).toBe(false);
    expect(hasAnyRole(actor, "admin", "professional")).toBe(true);
  });
});

describe("inContext", () => {
  it("odpovídá aktivnímu kontextu, návštěvník nikdy", () => {
    expect(inContext(user(["client"], "client"), "client")).toBe(true);
    expect(inContext(user(["professional"], "professional"), "client")).toBe(
      false,
    );
    expect(inContext(VISITOR, "client")).toBe(false);
  });
});

describe("registr oprávnění", () => {
  it("neznámá akce vyhodí chybu", () => {
    expect(() => can(VISITOR, "neexistuje.akce")).toThrow(/Neznámé/);
  });

  it("duplicitní registrace vyhodí chybu", () => {
    const name = "test.duplicita";
    definePermission(name, () => true);
    expect(isPermissionDefined(name)).toBe(true);
    expect(() => definePermission(name, () => false)).toThrow(/už je/);
  });

  it("předá actor i subject do check funkce", () => {
    const name = "test.subject";
    definePermission<{ ownerId: string }>(
      name,
      (actor, subject) =>
        actor.kind === "user" && actor.userId === subject.ownerId,
    );
    expect(can(user(["client"]), name, { ownerId: "u1" })).toBe(true);
    expect(can(user(["client"]), name, { ownerId: "u2" })).toBe(false);
  });
});

describe("foundation oprávnění napříč rolemi", () => {
  const cases: { role: Role | "visitor"; adminArea: boolean; platform: boolean }[] =
    [
      { role: "visitor", adminArea: false, platform: false },
      { role: "client", adminArea: false, platform: false },
      { role: "professional", adminArea: false, platform: false },
      { role: "moderator", adminArea: true, platform: false },
      { role: "admin", adminArea: true, platform: true },
    ];

  for (const c of cases) {
    it(`${c.role}: admin_area=${c.adminArea}, platform=${c.platform}`, () => {
      const actor: Actor = c.role === "visitor" ? VISITOR : user([c.role]);
      expect(can(actor, P_ACCESS_ADMIN_AREA)).toBe(c.adminArea);
      expect(can(actor, P_MANAGE_PLATFORM)).toBe(c.platform);
    });
  }
});
