import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import { canEditOrg, canManageMembers, canViewInternal } from "./permissions";
import type { OrgRole } from "./types";

/**
 * Ověřuje permission matici členů (T009 AC) na úrovni engine: viditelnost
 * interních dat, editace profilu a správa členů podle firemní role + role
 * systémového admina. Kompetence člen↔člen (kdo koho) pokrývá rules.test.ts.
 */

function member(orgRole: OrgRole | null): { orgRole: OrgRole | null } {
  return { orgRole };
}

const client: Actor = {
  kind: "user",
  userId: "u1",
  roles: ["client"],
  activeContext: "client",
};
const admin: Actor = {
  kind: "user",
  userId: "sysadmin",
  roles: ["admin"],
  activeContext: "client",
};

describe("canViewInternal", () => {
  it("vidí každý člen firmy (i member)", () => {
    for (const r of ["owner", "admin", "editor", "member"] as const) {
      expect(canViewInternal(client, member(r))).toBe(true);
    }
  });
  it("nečlen nevidí", () => {
    expect(canViewInternal(client, member(null))).toBe(false);
    expect(canViewInternal(VISITOR, member(null))).toBe(false);
  });
  it("systémový admin vidí i bez členství", () => {
    expect(canViewInternal(admin, member(null))).toBe(true);
  });
});

describe("canEditOrg (owner/admin/editor)", () => {
  it("owner, admin i editor smí editovat profil", () => {
    expect(canEditOrg(client, member("owner"))).toBe(true);
    expect(canEditOrg(client, member("admin"))).toBe(true);
    expect(canEditOrg(client, member("editor"))).toBe(true);
  });
  it("member ani nečlen needituje", () => {
    expect(canEditOrg(client, member("member"))).toBe(false);
    expect(canEditOrg(client, member(null))).toBe(false);
  });
  it("systémový admin edituje i bez členství", () => {
    expect(canEditOrg(admin, member(null))).toBe(true);
  });
});

describe("canManageMembers (owner/admin)", () => {
  it("owner a admin smí spravovat členy", () => {
    expect(canManageMembers(client, member("owner"))).toBe(true);
    expect(canManageMembers(client, member("admin"))).toBe(true);
  });
  it("editor a member nesmí", () => {
    expect(canManageMembers(client, member("editor"))).toBe(false);
    expect(canManageMembers(client, member("member"))).toBe(false);
  });
  it("systémový admin smí i bez členství", () => {
    expect(canManageMembers(admin, member(null))).toBe(true);
  });
});
