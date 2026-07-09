import { describe, expect, it } from "vitest";
import { createResetToken, hashResetToken, isResetTokenValid } from "./tokens";

describe("createResetToken", () => {
  it("vrací plaintext a odpovídající hash", () => {
    const { token, tokenHash } = createResetToken();
    expect(token.length).toBeGreaterThan(20);
    expect(tokenHash).toBe(hashResetToken(token));
    // Hash není roven plaintextu (v DB držíme jen hash).
    expect(tokenHash).not.toBe(token);
  });

  it("generuje pokaždé jiný token", () => {
    expect(createResetToken().token).not.toBe(createResetToken().token);
  });
});

describe("hashResetToken", () => {
  it("je deterministický", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
  });
});

describe("isResetTokenValid", () => {
  const now = new Date("2026-07-09T12:00:00Z");

  it("platný token: nepoužitý a neexpirovaný", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(isResetTokenValid({ usedAt: null, expiresAt: future }, now)).toBe(
      true,
    );
  });

  it("použitý token je neplatný (jednorázovost)", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(
      isResetTokenValid({ usedAt: new Date(), expiresAt: future }, now),
    ).toBe(false);
  });

  it("expirovaný token je neplatný", () => {
    const past = new Date(now.getTime() - 1);
    expect(isResetTokenValid({ usedAt: null, expiresAt: past }, now)).toBe(
      false,
    );
  });
});
