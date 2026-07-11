import "server-only";

import sharp from "sharp";
import {
  THUMBNAIL_MAX_DIMENSION,
  WEB_MAX_DIMENSION,
  type AllowedMimeType,
} from "./types";

/**
 * Zpracování obrázků médií (T014) přes `sharp`. Zodpovídá za:
 *  - přečtení rozměrů originálu,
 *  - generování derivátů (thumbnail, web-optimized) jako NOVÝCH souborů,
 *  - odstranění metadat včetně GPS EXIF z derivátů (privacy, T014 § Edge cases).
 *
 * `sharp` ve výchozím stavu metadata do výstupu NEkopíruje (nevoláme
 * `.withMetadata()`), takže deriváty EXIF/GPS neobsahují — to je záměr a kryje to
 * unit test. Originál se tímto modulem nikdy nepřepisuje.
 */

export type ImageDimensions = { width: number; height: number };

export type Derivative = {
  data: Buffer;
  mime: AllowedMimeType;
  width: number;
  height: number;
};

/** Rozměry obrázku z bajtů. Vyhodí, když je vstup nečitelný (poškozený soubor). */
export async function readDimensions(input: Buffer): Promise<ImageDimensions> {
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Nelze přečíst rozměry obrázku.");
  }
  return { width: meta.width, height: meta.height };
}

/**
 * Vyrobí jeden derivát: zmenší delší stranu na `maxDimension` (bez zvětšování),
 * překóduje na WebP a ZAHODÍ metadata (bez `.withMetadata()` → žádné EXIF/GPS).
 * `rotate()` bez argumentu aplikuje EXIF orientaci předtím, než se metadata
 * zahodí, aby derivát nebyl otočený špatně.
 */
async function makeDerivative(
  input: Buffer,
  maxDimension: number,
): Promise<Derivative> {
  const pipeline = sharp(input)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, mime: "image/webp", width: info.width, height: info.height };
}

/** Náhled (thumbnail) — malá varianta pro grid knihovny. */
export function makeThumbnail(input: Buffer): Promise<Derivative> {
  return makeDerivative(input, THUMBNAIL_MAX_DIMENSION);
}

/** Web-optimalizovaná varianta — pro veřejné zobrazení. */
export function makeWebVariant(input: Buffer): Promise<Derivative> {
  return makeDerivative(input, WEB_MAX_DIMENSION);
}

/**
 * Testovací pomocník i sanity check: vrátí `true`, když výstup NEobsahuje EXIF.
 * Používá ho unit test „GPS EXIF se v derivátech nevyskytuje".
 */
export async function hasExif(input: Buffer): Promise<boolean> {
  const meta = await sharp(input).metadata();
  return meta.exif !== undefined && meta.exif !== null;
}
