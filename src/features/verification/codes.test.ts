import { describe, expect, it } from "vitest";
import {
  createEmailToken,
  generateNumericCode,
  hashSecret,
  secretMatches,
} from "./codes";

describe("generateNumericCode", () => {
  it("vygeneruje kód požadované délky ze samých číslic", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateNumericCode(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("respektuje vlastní délku (včetně vedoucích nul)", () => {
    const code = generateNumericCode(4);
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^\d{4}$/);
  });
});

describe("hashSecret / secretMatches", () => {
  it("je deterministický", () => {
    expect(hashSecret("123456")).toBe(hashSecret("123456"));
  });

  it("nezveřejňuje plaintext (hash != vstup)", () => {
    expect(hashSecret("123456")).not.toContain("123456");
  });

  it("secretMatches uzná správné a odmítne špatné tajemství", () => {
    const hash = hashSecret("654321");
    expect(secretMatches("654321", hash)).toBe(true);
    expect(secretMatches("000000", hash)).toBe(false);
  });

  it("secretMatches vůči prázdnému hashi vždy false", () => {
    expect(secretMatches("123456", null)).toBe(false);
  });
});

describe("createEmailToken", () => {
  it("vrátí plaintext token a jeho hash", () => {
    const { token, tokenHash } = createEmailToken();
    expect(token.length).toBeGreaterThan(20);
    expect(tokenHash).toBe(hashSecret(token));
    expect(secretMatches(token, tokenHash)).toBe(true);
  });

  it("generuje pokaždé jiný token", () => {
    expect(createEmailToken().token).not.toBe(createEmailToken().token);
  });
});
