import { describe, expect, it } from "vitest";
import {
  type ChallengeState,
  VERIFICATION_LABELS,
  canConfirmChallenge,
  evaluateCodeAttempt,
  isChallengeExpired,
} from "./rules";

const MAX = 5;

function challenge(overrides: Partial<ChallengeState> = {}): ChallengeState {
  return {
    status: "pending",
    secretHash: "hash",
    expiresAt: new Date("2026-01-01T00:10:00Z"),
    attempts: 0,
    ...overrides,
  };
}

const now = new Date("2026-01-01T00:05:00Z");
const afterExpiry = new Date("2026-01-01T00:11:00Z");

describe("VERIFICATION_LABELS", () => {
  it("popisují, co bylo ověřeno, bez kontaktu", () => {
    expect(VERIFICATION_LABELS.email).toBe("Ověřený e-mail");
    expect(VERIFICATION_LABELS.phone).toBe("Ověřený telefon");
    // Popisek nikdy neobsahuje zástupný kontakt.
    for (const label of Object.values(VERIFICATION_LABELS)) {
      expect(label).not.toMatch(/@|\+?\d{5,}/);
    }
  });
});

describe("isChallengeExpired", () => {
  it("bez expirace nikdy nevyprší", () => {
    expect(isChallengeExpired({ expiresAt: null }, now)).toBe(false);
  });
  it("vyprší po expiraci", () => {
    expect(isChallengeExpired(challenge(), now)).toBe(false);
    expect(isChallengeExpired(challenge(), afterExpiry)).toBe(true);
  });
});

describe("canConfirmChallenge", () => {
  it("povolí čerstvou pending výzvu", () => {
    expect(canConfirmChallenge(challenge(), MAX, now)).toBe(true);
  });
  it("odmítne po vyčerpání pokusů", () => {
    expect(canConfirmChallenge(challenge({ attempts: MAX }), MAX, now)).toBe(false);
  });
  it("odmítne vypršelou i bez tajemství i neaktivní", () => {
    expect(canConfirmChallenge(challenge(), MAX, afterExpiry)).toBe(false);
    expect(canConfirmChallenge(challenge({ secretHash: null }), MAX, now)).toBe(false);
    expect(canConfirmChallenge(challenge({ status: "verified" }), MAX, now)).toBe(false);
  });
});

describe("evaluateCodeAttempt", () => {
  it("správný kód → verified", () => {
    expect(evaluateCodeAttempt(challenge(), true, MAX, now)).toEqual({
      result: "verified",
    });
  });
  it("špatný kód snižuje zbývající pokusy", () => {
    expect(evaluateCodeAttempt(challenge({ attempts: 0 }), false, MAX, now)).toEqual({
      result: "wrong_code",
      attemptsLeft: 4,
    });
    expect(evaluateCodeAttempt(challenge({ attempts: 4 }), false, MAX, now)).toEqual({
      result: "wrong_code",
      attemptsLeft: 0,
    });
  });
  it("vypršení má přednost před správným kódem", () => {
    expect(evaluateCodeAttempt(challenge(), true, MAX, afterExpiry)).toEqual({
      result: "expired",
    });
  });
  it("vyčerpané pokusy → too_many_attempts", () => {
    expect(evaluateCodeAttempt(challenge({ attempts: MAX }), true, MAX, now)).toEqual({
      result: "too_many_attempts",
    });
  });
});
