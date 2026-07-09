import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  loginSchema,
  registerSchema,
  resetConfirmSchema,
} from "./validation";

describe("registerSchema", () => {
  const valid = {
    email: "investor@archiguide.cz",
    password: "tajneheslo1",
    acceptTerms: true,
  };

  it("přijme platnou registraci", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("odmítne krátké heslo", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(result.success).toBe(false);
  });

  it("vyžaduje souhlas s podmínkami", () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it("odmítne neplatný e-mail", () => {
    const result = registerSchema.safeParse({ ...valid, email: "neni-email" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("při loginu nevaliduje délku hesla, jen jeho přítomnost", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.cz", password: "x" }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ email: "a@b.cz", password: "" }).success,
    ).toBe(false);
  });
});

describe("resetConfirmSchema", () => {
  it("vyžaduje token i dostatečně dlouhé heslo", () => {
    expect(
      resetConfirmSchema.safeParse({ token: "t", password: "noveheslo1" })
        .success,
    ).toBe(true);
    expect(
      resetConfirmSchema.safeParse({ token: "", password: "noveheslo1" })
        .success,
    ).toBe(false);
    expect(
      resetConfirmSchema.safeParse({ token: "t", password: "krat" }).success,
    ).toBe(false);
  });
});
