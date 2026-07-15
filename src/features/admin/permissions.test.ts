import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canManageTaxonomy,
  canManageUsers,
  P_ADMIN_VIEW_USERS,
} from "./permissions";
import { can } from "@/lib/permissions";

/**
 * Permission matice administrace (T035 § Permissions): admin má plný přístup,
 * moderátor jen read-only výpis uživatelů, ostatní role a návštěvník nic.
 */

const admin: Actor = {
  kind: "user",
  userId: "u-admin",
  roles: ["admin"],
  activeContext: "client",
};
const moderator: Actor = {
  kind: "user",
  userId: "u-mod",
  roles: ["moderator"],
  activeContext: "client",
};
const client: Actor = {
  kind: "user",
  userId: "u-client",
  roles: ["client"],
  activeContext: "client",
};

describe("P_ADMIN_VIEW_USERS", () => {
  it("admin i moderátor vidí výpis uživatelů", () => {
    expect(can(admin, P_ADMIN_VIEW_USERS)).toBe(true);
    expect(can(moderator, P_ADMIN_VIEW_USERS)).toBe(true);
  });
  it("client a návštěvník nevidí", () => {
    expect(can(client, P_ADMIN_VIEW_USERS)).toBe(false);
    expect(can(VISITOR, P_ADMIN_VIEW_USERS)).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("jen admin smí blokovat/měnit role", () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(moderator)).toBe(false);
    expect(canManageUsers(client)).toBe(false);
    expect(canManageUsers(VISITOR)).toBe(false);
  });
});

describe("canManageTaxonomy", () => {
  it("jen admin smí spravovat taxonomii", () => {
    expect(canManageTaxonomy(admin)).toBe(true);
    expect(canManageTaxonomy(moderator)).toBe(false);
    expect(canManageTaxonomy(client)).toBe(false);
  });
});
