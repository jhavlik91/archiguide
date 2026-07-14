import { describe, expect, it } from "vitest";
import { parseSearchParams } from "./params";
import { buildEmptySuggestions } from "./suggestions";

/**
 * Návrhy pro prázdný výsledek (T034 § Main flow #6). Uživatel nesmí skončit ve
 * slepé uličce — vždy dostane konkrétní krok (odebrat filtr, příbuzná profese,
 * zobrazit vše).
 */
describe("buildEmptySuggestions", () => {
  it("bez kritérií nenavrhuje nic (prázdný katalog není chyba hledání)", () => {
    expect(buildEmptySuggestions(parseSearchParams({}))).toEqual([]);
  });

  it("navrhne odebrání každého aktivního filtru + zobrazení celého katalogu", () => {
    const state = parseSearchParams({
      region: "Praha",
      specializace: "dřevostavby",
      overeny: "1",
    });
    const kinds = buildEmptySuggestions(state).map((s) => s.kind);
    expect(kinds).toContain("remove_filter");
    expect(kinds[kinds.length - 1]).toBe("browse_all");
    // Ověřený, region i specializace mají svůj návrh na odebrání.
    expect(
      buildEmptySuggestions(state).filter((s) => s.kind === "remove_filter"),
    ).toHaveLength(3);
  });

  it("nabídne příbuzné profese před zrušením filtru profese", () => {
    const state = parseSearchParams({ q: "projektant", profese: "architekt" });
    const suggestions = buildEmptySuggestions(state, [
      {
        slug: "projektant-pozemnich-staveb",
        name: "projektant pozemních staveb",
      },
    ]);
    const related = suggestions.findIndex(
      (s) => s.kind === "related_profession",
    );
    const removeProfession = suggestions.findIndex(
      (s) => s.kind === "remove_filter" && s.filter === "profession",
    );
    expect(related).toBeGreaterThanOrEqual(0);
    expect(related).toBeLessThan(removeProfession);
  });
});
