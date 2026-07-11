import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  hasExif,
  makeThumbnail,
  makeWebVariant,
  readDimensions,
} from "./image";

/**
 * Acceptance (T014): „GPS EXIF se v derivátech nevyskytuje". Vyrobíme zdrojový
 * JPEG s EXIF včetně GPS souřadnic, ověříme, že originál EXIF má, a že oba
 * deriváty (thumbnail i web) EXIF — a tedy i GPS — nemají.
 */
async function sourceWithGpsExif(): Promise<Buffer> {
  return sharp({
    create: {
      width: 200,
      height: 150,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .jpeg()
    // GPS není v typu sharp.Exif jako top-level klíč, ale sharp ho za běhu zapíše;
    // cast nám dovolí vložit GPS EXIF do zdroje pro test odstranění metadat.
    .withExif({
      IFD0: { Copyright: "ArchiGuide test" },
      GPS: {
        GPSLatitudeRef: "N",
        GPSLatitude: "50/1 5/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "14/1 25/1 0/1",
      },
    } as sharp.Exif)
    .toBuffer();
}

describe("image deriváty", () => {
  it("zdrojový obrázek EXIF (a GPS) obsahuje — sanity check", async () => {
    const source = await sourceWithGpsExif();
    expect(await hasExif(source)).toBe(true);
  });

  it("thumbnail NEobsahuje EXIF (a tím ani GPS)", async () => {
    const source = await sourceWithGpsExif();
    const thumb = await makeThumbnail(source);
    expect(await hasExif(thumb.data)).toBe(false);
    expect(thumb.mime).toBe("image/webp");
  });

  it("web varianta NEobsahuje EXIF (a tím ani GPS)", async () => {
    const source = await sourceWithGpsExif();
    const web = await makeWebVariant(source);
    expect(await hasExif(web.data)).toBe(false);
  });

  it("deriváty zmenšují delší stranu bez zvětšování", async () => {
    const source = await sourceWithGpsExif();
    const thumb = await makeThumbnail(source);
    // Zdroj 200×150; thumbnail (max 400) se nezvětšuje → zůstává 200×150.
    expect(Math.max(thumb.width, thumb.height)).toBeLessThanOrEqual(200);
  });

  it("readDimensions vrátí rozměry originálu", async () => {
    const source = await sourceWithGpsExif();
    expect(await readDimensions(source)).toEqual({ width: 200, height: 150 });
  });
});
