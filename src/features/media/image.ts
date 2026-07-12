import "server-only";

import sharp from "sharp";
import {
  THUMBNAIL_MAX_DIMENSION,
  WEB_MAX_DIMENSION,
  type AllowedMimeType,
} from "./types";
import { aspectRatio, centeredAspectCrop, type ImageEdit } from "./edit";

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

// --- Úpravy obrázků (T015) --------------------------------------------------

export type EditRender = {
  thumbnail: Derivative;
  web: Derivative;
  /** Rozměry upravené (full-res) verze — po rotaci a cropu, před resize derivátů. */
  width: number;
  height: number;
};

/**
 * Renderuje upravenou verzi obrázku z BAJTŮ ORIGINÁLU podle parametrů úpravy.
 * Klíčové: vstupem je vždy originál (ne předchozí derivát), takže opakovaná úprava
 * kvalitu nedegraduje (T015 § Edge cases). Pořadí: EXIF auto-orient → rotace uživatele
 * → crop (centrovaný výřez poměru) → jas/kontrast/saturace. Z výsledku se pak
 * vygenerují stejné deriváty jako při uploadu (thumbnail + web, bez EXIF).
 */
export async function renderEdit(originalBytes: Buffer, edit: ImageEdit): Promise<EditRender> {
  // 1. EXIF auto-orient (stejný základ jako u uploadových derivátů).
  let buf = await sharp(originalBytes).rotate().toBuffer();

  // 2. Rotace uživatele po 90°.
  if (edit.rotate !== 0) {
    buf = await sharp(buf).rotate(edit.rotate).toBuffer();
  }

  // 3. Crop na centrovaný výřez zvoleného poměru stran.
  const ratio = aspectRatio(edit.crop);
  if (ratio) {
    const meta = await sharp(buf).metadata();
    const rect = centeredAspectCrop(meta.width ?? 0, meta.height ?? 0, ratio[0], ratio[1]);
    buf = await sharp(buf).extract(rect).toBuffer();
  }

  // 4. Barevné úpravy: jas/saturace přes modulate, kontrast lineárně kolem 128.
  if (edit.brightness !== 1 || edit.saturation !== 1 || edit.contrast !== 1) {
    let pipeline = sharp(buf).modulate({
      brightness: edit.brightness,
      saturation: edit.saturation,
    });
    if (edit.contrast !== 1) {
      // out = a·in + b; a = kontrast, b = 128·(1−a) drží střed (šedou) na místě.
      pipeline = pipeline.linear(edit.contrast, 128 * (1 - edit.contrast));
    }
    buf = await pipeline.toBuffer();
  }

  const meta = await sharp(buf).metadata();
  const [thumbnail, web] = await Promise.all([makeThumbnail(buf), makeWebVariant(buf)]);
  return { thumbnail, web, width: meta.width ?? 0, height: meta.height ?? 0 };
}
