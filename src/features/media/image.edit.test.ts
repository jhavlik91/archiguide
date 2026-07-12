import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { hasExif, renderEdit } from "./image";
import { NEUTRAL_EDIT, type ImageEdit } from "./edit";

/** Zdrojový landscape obrázek daného odstínu (bez EXIF). */
async function source(
  width = 200,
  height = 120,
  gray = 120,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: gray, g: gray, b: gray },
    },
  })
    .png()
    .toBuffer();
}

/** Průměrný jas (0–255) prvního kanálu bufferu. */
async function meanLuma(buf: Buffer): Promise<number> {
  const stats = await sharp(buf).stats();
  return stats.channels[0].mean;
}

const edit = (over: Partial<ImageEdit>): ImageEdit => ({ ...NEUTRAL_EDIT, ...over });

describe("renderEdit", () => {
  it("neutrální úprava zachová rozměry a vyrobí webp deriváty bez EXIF", async () => {
    const render = await renderEdit(await source(), NEUTRAL_EDIT);
    expect(render.width).toBe(200);
    expect(render.height).toBe(120);
    expect(render.thumbnail.mime).toBe("image/webp");
    expect(render.web.mime).toBe("image/webp");
    expect(await hasExif(render.web.data)).toBe(false);
  });

  it("rotace o 90° prohodí strany", async () => {
    const render = await renderEdit(await source(200, 120), edit({ rotate: 90 }));
    expect(render.width).toBe(120);
    expect(render.height).toBe(200);
  });

  it("crop 1:1 vyrobí čtverec (centrovaný výřez)", async () => {
    const render = await renderEdit(await source(200, 120), edit({ crop: "1:1" }));
    expect(render.width).toBe(render.height);
    expect(render.width).toBe(120);
  });

  it("zvýšení jasu zesvětlí výsledek", async () => {
    const base = await source(200, 120, 120);
    const neutral = await renderEdit(base, NEUTRAL_EDIT);
    const brighter = await renderEdit(base, edit({ brightness: 1.5 }));
    expect(await meanLuma(brighter.web.data)).toBeGreaterThan(
      await meanLuma(neutral.web.data),
    );
  });

  it("saturace na 0 odbarví (kanály se srovnají)", async () => {
    // Barevný zdroj → po desaturaci mají R/G/B blízké průměry.
    const colored = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 60, b: 60 } },
    })
      .png()
      .toBuffer();
    const render = await renderEdit(colored, edit({ saturation: 0 }));
    const stats = await sharp(render.web.data).stats();
    const [r, g, b] = stats.channels.map((c) => c.mean);
    expect(Math.abs(r - g)).toBeLessThan(15);
    expect(Math.abs(g - b)).toBeLessThan(15);
  });
});
