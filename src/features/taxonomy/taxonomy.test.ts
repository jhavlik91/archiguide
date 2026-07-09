import { describe, expect, it } from "vitest";
import {
  buildTaxonomy,
  TAXONOMY,
  type SeedCategory,
} from "@/features/taxonomy/data";
import {
  matchProfessions,
  normalize,
  slugify,
} from "@/features/taxonomy/match";

describe("normalize", () => {
  it("strips diacritics, lowercases and trims", () => {
    expect(normalize("  Topenář ")).toBe("topenar");
    expect(normalize("ŽELEZOBETON")).toBe("zelezobeton");
  });
});

describe("slugify", () => {
  it("produces URL-friendly ascii slugs", () => {
    expect(slugify("Architecture & Design")).toBe("architecture-design");
    expect(slugify("autorizovaný architekt")).toBe("autorizovany-architekt");
    expect(slugify("3D vizualizátor")).toBe("3d-vizualizator");
  });
});

describe("buildTaxonomy", () => {
  const taxonomy = buildTaxonomy();

  it("materializes all 17 categories in spec order", () => {
    expect(taxonomy).toHaveLength(17);
    expect(taxonomy[0].name).toBe("Architecture & Design");
    expect(taxonomy.at(-1)?.name).toBe("Supply");
    taxonomy.forEach((category, index) => {
      expect(category.position).toBe(index);
    });
  });

  it("seeds every profession from the spec (no empty category)", () => {
    const total = taxonomy.reduce((sum, c) => sum + c.professions.length, 0);
    const specTotal = TAXONOMY.reduce(
      (sum, c) => sum + c.professions.length,
      0,
    );
    expect(total).toBe(specTotal);
    taxonomy.forEach((category) => {
      expect(category.professions.length).toBeGreaterThan(0);
    });
  });

  it("assigns a globally unique slug to every profession", () => {
    const slugs = taxonomy.flatMap((c) => c.professions.map((p) => p.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("assigns unique category slugs", () => {
    const slugs = taxonomy.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("marks regulated professions with verification hints", () => {
    const professions = taxonomy.flatMap((c) => c.professions);
    const statik = professions.find((p) => p.slug === "statik");
    expect(statik?.regulated).toBe(true);
    expect(statik?.verificationHints.length).toBeGreaterThan(0);
  });
});

describe("matchProfessions", () => {
  const professions = buildTaxonomy().flatMap((c) => c.professions);

  it("finds a profession by its name (case- and diacritics-insensitive)", () => {
    const result = matchProfessions(professions, "Topenář");
    expect(result[0]?.slug).toBe("topenar");
  });

  it("finds a profession by a synonym", () => {
    const result = matchProfessions(professions, "topenářství");
    expect(result.map((p) => p.slug)).toContain("topenar");
    expect(result[0]?.slug).toBe("topenar");
  });

  it("returns an empty list for an empty query", () => {
    expect(matchProfessions(professions, "   ")).toEqual([]);
  });

  it("excludes archived professions from the number lists by default", () => {
    const source: SeedCategory[] = [
      {
        name: "Trades",
        professions: [
          { name: "topenář", synonyms: ["topenářství"] },
          { name: "kominík", synonyms: ["kominictví"], status: "archived" },
        ],
      },
    ];
    const custom = buildTaxonomy(source).flatMap((c) => c.professions);

    expect(matchProfessions(custom, "kominík")).toEqual([]);
    expect(
      matchProfessions(custom, "kominík", { includeArchived: true })[0]?.slug,
    ).toBe("kominik");
  });
});
