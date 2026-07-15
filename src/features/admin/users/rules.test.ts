import { describe, expect, it } from "vitest";
import { canRevokeAdminRole, canSuspend } from "./rules";

describe("canSuspend", () => {
  it("admin nemůže zablokovat sám sebe", () => {
    expect(canSuspend("u1", "u1")).toBe(false);
  });
  it("admin smí zablokovat jiného uživatele", () => {
    expect(canSuspend("u1", "u2")).toBe(true);
  });
});

describe("canRevokeAdminRole", () => {
  it("nelze odebrat roli admin poslednímu adminovi", () => {
    expect(canRevokeAdminRole(true, 1)).toBe(false);
  });
  it("lze odebrat roli admin, když zůstane alespoň jeden další", () => {
    expect(canRevokeAdminRole(true, 2)).toBe(true);
  });
  it("odebrání role, kterou cíl nemá, invariant neporuší", () => {
    expect(canRevokeAdminRole(false, 1)).toBe(true);
  });
});
