import { describe, expect, it } from "vitest";
import { formatAnswer } from "./format";
import type { GuideStepDefinition } from "./types";

/** Malý tovární helper pro definici kroku daného typu. */
function step(
  type: GuideStepDefinition["type"],
  options?: GuideStepDefinition["options"],
): GuideStepDefinition {
  return { key: "k", type, prompt: "?", options };
}

describe("formatAnswer", () => {
  it("„nevím“ a „přeskočit“ mají lidský popisek nezávisle na typu", () => {
    expect(formatAnswer(step("text"), { status: "unknown" })).toBe("Nevím");
    expect(formatAnswer(step("single_choice"), { status: "skipped" })).toBe(
      "Přeskočeno",
    );
  });

  it("single_choice zobrazí label možnosti, ne její value", () => {
    const s = step("single_choice", [{ value: "own", label: "Již vlastním" }]);
    expect(formatAnswer(s, { status: "answered", value: "own" })).toBe(
      "Již vlastním",
    );
  });

  it("multi_choice spojí labely vybraných možností", () => {
    const s = step("multi_choice", [
      { value: "a", label: "První" },
      { value: "b", label: "Druhá" },
    ]);
    expect(formatAnswer(s, { status: "answered", value: ["a", "b"] })).toBe(
      "První, Druhá",
    );
  });

  it("number formátuje jako částku v Kč", () => {
    const out = formatAnswer(step("number"), {
      status: "answered",
      value: 2500000,
    });
    expect(out).toContain("Kč");
    // Nebulímé na konkrétní mezery (NBSP), jen na řádovou správnost.
    expect(out.replace(/\s/g, "")).toBe("2500000Kč");
  });

  it("range formátuje obě meze, jednu mez i prázdno", () => {
    const s = step("range");
    expect(
      formatAnswer(s, { status: "answered", value: { min: 1000, max: 2000 } }),
    ).toContain("–");
    expect(
      formatAnswer(s, { status: "answered", value: { min: 1000, max: null } }),
    ).toMatch(/^od /);
    expect(
      formatAnswer(s, { status: "answered", value: { min: null, max: 2000 } }),
    ).toMatch(/^do /);
  });

  it("location skládá čitelnou adresu a respektuje sdílení přesné adresy", () => {
    const s = step("location");
    expect(
      formatAnswer(s, {
        status: "answered",
        value: { city: "Praha", region: "Hl. m. Praha" },
      }),
    ).toBe("Praha, Hl. m. Praha");
    expect(
      formatAnswer(s, {
        status: "answered",
        value: { city: "Brno", address: "Nám. 1", shareAddress: false },
      }),
    ).toBe("Brno");
    expect(
      formatAnswer(s, {
        status: "answered",
        value: { city: "Brno", address: "Nám. 1", shareAddress: true },
      }),
    ).toBe("Brno (Nám. 1)");
  });

  it("file_ref zobrazí počet podkladů", () => {
    const s = step("file_ref");
    expect(
      formatAnswer(s, { status: "answered", value: { mediaIds: ["a"] } }),
    ).toBe("1 podklad");
    expect(
      formatAnswer(s, { status: "answered", value: { mediaIds: ["a", "b"] } }),
    ).toBe("2 podkladů");
  });
});
