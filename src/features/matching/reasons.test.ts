import { describe, expect, it } from "vitest";
import { formatReasons } from "./reasons";

describe("formatReasons", () => {
  it("prázdný seznam vrátí prázdný řetězec", () => {
    expect(formatReasons([])).toBe("");
  });

  it("jeden důvod: 'Doporučeno, protože <věta>.'", () => {
    const text = formatReasons([
      { type: "profession_match", detail: "Hlavní profese: Architekt." },
    ]);
    expect(text).toBe("Doporučeno, protože hlavní profese: Architekt.");
  });

  it("víc důvodů se spojí čárkami a 'a' před posledním", () => {
    const text = formatReasons([
      {
        type: "similar_projects",
        detail: 'Realizoval 8 projekty typu „rekonstrukce bytu".',
      },
      { type: "region", detail: "Působí v regionu Praha." },
    ]);
    expect(text).toBe(
      'Doporučeno, protože realizoval 8 projekty typu „rekonstrukce bytu" a působí v regionu Praha.',
    );
  });

  it("nepřidává fakta navíc — jen existující detaily", () => {
    const reasons = [
      {
        type: "limited_availability" as const,
        detail: "Má omezenou kapacitu.",
      },
    ];
    const text = formatReasons(reasons);
    expect(text).toContain("omezenou kapacitu");
  });
});
