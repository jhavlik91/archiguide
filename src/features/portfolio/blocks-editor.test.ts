import { describe, expect, it } from "vitest";
import {
  blockAssetIds,
  defaultBlockContent,
  draftPortfolioBlockSchema,
  isBlockPublishable,
  isPortfolioBlockKind,
  PORTFOLIO_BLOCK_TYPES,
  savePortfolioBlocksSchema,
} from "./blocks";

/**
 * Čisté helpery blokového editoru (T013): výchozí obsah, lenient draft schéma,
 * detekce publikovatelnosti a extrakce media assetů pro usage seam.
 */

describe("defaultBlockContent", () => {
  it("dá pro každý typ objekt (tvar dle typu, ale zpravidla neúplný)", () => {
    for (const kind of PORTFOLIO_BLOCK_TYPES) {
      const content = defaultBlockContent(kind);
      expect(content).toBeTypeOf("object");
      expect(content).not.toBeNull();
    }
  });

  it("nově přidaný text není publikovatelný (prázdný obsah)", () => {
    expect(
      isBlockPublishable({ type: "text", content: defaultBlockContent("text") }),
    ).toBe(false);
  });

  it("vyplněný text už publikovatelný je", () => {
    expect(
      isBlockPublishable({ type: "text", content: { text: "Ahoj" } }),
    ).toBe(true);
  });
});

describe("draftPortfolioBlockSchema", () => {
  it("uloží i rozpracovaný (neúplný) obsah — žádná tichá ztráta draftu", () => {
    const parsed = draftPortfolioBlockSchema.safeParse({
      type: "list",
      content: { style: "bulleted", items: [] },
    });
    expect(parsed.success).toBe(true);
  });

  it("odmítne neznámý typ bloku", () => {
    const parsed = draftPortfolioBlockSchema.safeParse({
      type: "video",
      content: {},
    });
    expect(parsed.success).toBe(false);
  });

  it("odmítne obsah, který není objekt", () => {
    const parsed = draftPortfolioBlockSchema.safeParse({
      type: "text",
      content: "ne",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("savePortfolioBlocksSchema", () => {
  it("přijme payload s verzí a poli bloků", () => {
    const parsed = savePortfolioBlocksSchema.safeParse({
      projectId: "p1",
      baseVersion: 3,
      blocks: [{ type: "text", content: { text: "" } }],
    });
    expect(parsed.success).toBe(true);
  });

  it("odmítne zápornou verzi", () => {
    const parsed = savePortfolioBlocksSchema.safeParse({
      projectId: "p1",
      baseVersion: -1,
      blocks: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("blockAssetIds", () => {
  it("vytáhne assetId z image/gallery/before_after a jinde nic", () => {
    expect(
      blockAssetIds({ type: "image", content: { assetId: "a1", url: "u" } }),
    ).toEqual(["a1"]);

    expect(
      blockAssetIds({
        type: "gallery",
        content: { images: [{ assetId: "a1" }, { assetId: "a2" }, { url: "u" }] },
      }),
    ).toEqual(["a1", "a2"]);

    expect(
      blockAssetIds({
        type: "before_after",
        content: { before: { assetId: "b" }, after: { assetId: "a" } },
      }),
    ).toEqual(["b", "a"]);

    expect(blockAssetIds({ type: "text", content: { text: "x" } })).toEqual([]);
  });

  it("je odolný vůči rozpracovanému / poškozenému obsahu", () => {
    expect(blockAssetIds({ type: "image", content: null })).toEqual([]);
    expect(blockAssetIds({ type: "gallery", content: { images: "ne" } })).toEqual(
      [],
    );
    expect(blockAssetIds({ type: "image", content: { assetId: 5 } })).toEqual([]);
  });
});

describe("isPortfolioBlockKind", () => {
  it("rozezná MVP typy od cizích", () => {
    expect(isPortfolioBlockKind("gallery")).toBe(true);
    expect(isPortfolioBlockKind("video")).toBe(false);
    expect(isPortfolioBlockKind(42)).toBe(false);
  });
});
