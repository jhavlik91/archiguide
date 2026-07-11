import { describe, expect, it } from "vitest";
import { firstImageUrl, parsePortfolioBlocks } from "./blocks";

describe("parsePortfolioBlocks", () => {
  it("nechá projít validní bloky a doplní defaulty", () => {
    const blocks = parsePortfolioBlocks([
      { type: "heading", content: { text: "Nadpis" } },
      { type: "list", content: { items: ["a", "b"] } },
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      type: "heading",
      content: { text: "Nadpis", level: 2 },
    });
    expect(blocks[1]).toMatchObject({
      type: "list",
      content: { style: "bulleted", items: ["a", "b"] },
    });
  });

  it("zahodí nevalidní i neznámé bloky (render nesmí spadnout)", () => {
    const blocks = parsePortfolioBlocks([
      { type: "heading", content: { text: "" } }, // prázdný text → neplatné
      { type: "video", content: { url: "x" } }, // neznámý typ (post-MVP)
      { type: "image", content: {} }, // chybí url
      { type: "text", content: { text: "ok" } }, // validní
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });

  it("zahodí CTA s jiným než http(s) schématem (URL jde do href)", () => {
    const blocks = parsePortfolioBlocks([
      { type: "cta", content: { label: "Klik", url: "javascript:alert(1)" } },
      { type: "cta", content: { label: "Web", url: "https://example.com" } },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "cta",
      content: { url: "https://example.com" },
    });
  });

  it("nespadne na jiném než poli", () => {
    expect(parsePortfolioBlocks(null)).toEqual([]);
    expect(parsePortfolioBlocks(undefined)).toEqual([]);
    expect(parsePortfolioBlocks("neco")).toEqual([]);
  });
});

describe("firstImageUrl", () => {
  it("najde první obrázek napříč typy (image → gallery → before_after)", () => {
    const blocks = parsePortfolioBlocks([
      { type: "text", content: { text: "úvod" } },
      { type: "gallery", content: { images: [{ url: "g1" }, { url: "g2" }] } },
      { type: "image", content: { url: "i1" } },
    ]);
    expect(firstImageUrl(blocks)).toBe("g1");
  });

  it("vezme before obrázek z before_after, když je první", () => {
    const blocks = parsePortfolioBlocks([
      {
        type: "before_after",
        content: { before: { url: "b" }, after: { url: "a" } },
      },
    ]);
    expect(firstImageUrl(blocks)).toBe("b");
  });

  it("vrátí null, když dílo nemá obrázek", () => {
    const blocks = parsePortfolioBlocks([
      { type: "text", content: { text: "jen text" } },
    ]);
    expect(firstImageUrl(blocks)).toBeNull();
  });
});
