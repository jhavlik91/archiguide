import { describe, expect, it } from "vitest";
import {
  createPortfolioSchema,
  inviteCoauthorSchema,
  updatePortfolioSchema,
} from "./validation";
import { YEAR_MIN } from "./types";

describe("createPortfolioSchema", () => {
  it("titul je povinný", () => {
    expect(createPortfolioSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createPortfolioSchema.safeParse({ title: "  " }).success).toBe(false);
    const ok = createPortfolioSchema.safeParse({ title: "  Vila  " });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.title).toBe("Vila");
  });
});

describe("updatePortfolioSchema", () => {
  it("odmítne rok mimo rozsah", () => {
    expect(
      updatePortfolioSchema.safeParse({ title: "X", year: YEAR_MIN - 1 })
        .success,
    ).toBe(false);
  });

  it("prázdné volitelné texty projdou jako undefined", () => {
    const parsed = updatePortfolioSchema.safeParse({
      title: "Dům",
      location: "  ",
      description: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.location).toBeUndefined();
      expect(parsed.data.description).toBeUndefined();
      expect(parsed.data.visibility).toBe("public");
    }
  });

  it("odmítne neznámý typ projektu", () => {
    expect(
      updatePortfolioSchema.safeParse({ title: "Dům", projectType: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("inviteCoauthorSchema", () => {
  it("normalizuje e-mail a odmítne nevalidní", () => {
    const ok = inviteCoauthorSchema.safeParse({ email: "  Jan@Firma.CZ " });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("jan@firma.cz");
    expect(inviteCoauthorSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
  });
});
