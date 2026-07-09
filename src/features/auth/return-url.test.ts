import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "./return-url";

describe("safeReturnUrl", () => {
  it("propustí interní cestu včetně query", () => {
    expect(safeReturnUrl("/dashboard")).toBe("/dashboard");
    expect(safeReturnUrl("/requests?tab=open")).toBe("/requests?tab=open");
  });

  it("odmítne externí a protokol-relativní URL (open redirect)", () => {
    expect(safeReturnUrl("https://evil.example")).toBe("/dashboard");
    expect(safeReturnUrl("//evil.example")).toBe("/dashboard");
    expect(safeReturnUrl("/\\evil.example")).toBe("/dashboard");
    expect(safeReturnUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("chybějící nebo prázdnou hodnotu nahradí fallbackem", () => {
    expect(safeReturnUrl(null)).toBe("/dashboard");
    expect(safeReturnUrl("")).toBe("/dashboard");
    expect(safeReturnUrl(undefined, "/admin")).toBe("/admin");
  });
});
