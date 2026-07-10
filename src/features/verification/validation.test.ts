import { describe, expect, it } from "vitest";
import { codeSchema, phoneSchema } from "./validation";

describe("phoneSchema", () => {
  it("přijme E.164 a normalizuje mezery/pomlčky/závorky", () => {
    expect(phoneSchema.parse("+420123456789")).toBe("+420123456789");
    expect(phoneSchema.parse("+420 123 456 789")).toBe("+420123456789");
    expect(phoneSchema.parse("+420-123-456-789")).toBe("+420123456789");
    expect(phoneSchema.parse(" +1 (555) 123-4567 ")).toBe("+15551234567");
  });

  it("odmítne číslo bez předvolby, s písmeny nebo příliš krátké", () => {
    expect(phoneSchema.safeParse("123456789").success).toBe(false);
    expect(phoneSchema.safeParse("+420abc").success).toBe(false);
    expect(phoneSchema.safeParse("+420").success).toBe(false);
    expect(phoneSchema.safeParse("+0123456789").success).toBe(false);
  });
});

describe("codeSchema", () => {
  it("přijme přesně 6 číslic", () => {
    expect(codeSchema.parse("123456")).toBe("123456");
    expect(codeSchema.parse(" 000000 ")).toBe("000000");
  });

  it("odmítne jinou délku nebo nečíslice", () => {
    expect(codeSchema.safeParse("12345").success).toBe(false);
    expect(codeSchema.safeParse("1234567").success).toBe(false);
    expect(codeSchema.safeParse("12a456").success).toBe(false);
  });
});
