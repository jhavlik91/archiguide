import { describe, expect, it } from "vitest";
import { emailsCollide, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("převede na malá písmena a ořízne mezery", () => {
    expect(normalizeEmail("  Foo.Bar@Example.CZ  ")).toBe("foo.bar@example.cz");
  });

  it("je idempotentní", () => {
    const once = normalizeEmail("USER@Example.com");
    expect(normalizeEmail(once)).toBe(once);
  });
});

describe("emailsCollide (case-insensitive unikátnost)", () => {
  it("stejný e-mail s jinou velikostí písmen koliduje", () => {
    expect(
      emailsCollide("investor@archiguide.cz", "INVESTOR@archiguide.cz"),
    ).toBe(true);
  });

  it("okrajové mezery nezakládají nový účet", () => {
    expect(emailsCollide("a@b.cz", "  a@b.cz ")).toBe(true);
  });

  it("odlišné e-maily nekolidují", () => {
    expect(emailsCollide("a@b.cz", "c@b.cz")).toBe(false);
  });
});
