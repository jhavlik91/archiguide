import { describe, expect, it } from "vitest";
import { canAccessSession } from "./permissions";

describe("canAccessSession", () => {
  it("přihlášený vlastník má přístup přes shodu userId", () => {
    const session = { userId: "u1", token: "tok" };
    expect(canAccessSession(session, { userId: "u1" })).toBe(true);
    expect(canAccessSession(session, { userId: "u2" })).toBe(false);
  });

  it("anonym má přístup přes držení tokenu", () => {
    const session = { userId: null, token: "tok" };
    expect(canAccessSession(session, { token: "tok" })).toBe(true);
    expect(canAccessSession(session, { token: "jiny" })).toBe(false);
  });

  it("po připojení k účtu platí userId i token", () => {
    const session = { userId: "u1", token: "tok" };
    expect(canAccessSession(session, { token: "tok" })).toBe(true);
    expect(canAccessSession(session, { userId: "u1", token: "x" })).toBe(true);
  });

  it("bez shody (ani userId, ani token) nemá přístup", () => {
    const session = { userId: "u1", token: "tok" };
    expect(canAccessSession(session, {})).toBe(false);
    expect(canAccessSession(session, { userId: null, token: null })).toBe(
      false,
    );
  });
});
