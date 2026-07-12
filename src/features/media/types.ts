/**
 * Sdílené typy a číselníky médií (T014).
 *
 * Modul je čistý (bez DB / `next/*` / `sharp`), aby šel použít i v klientských
 * komponentách (dropzone, knihovna) i na serveru. Hodnoty (limity, whitelist,
 * rozměry derivátů) jsou jediným zdrojem pro validaci, UI i generování derivátů.
 */

/** Maximální velikost jednoho souboru: 25 MB (T014 § Inputs). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Maximální počet souborů v jedné dávce uploadu (T014 § Validation). */
export const MAX_BATCH_FILES = 20;

/** Maximální délka alt textu (přístupnost; rozumný strop). */
export const ALT_TEXT_MAX_LENGTH = 300;

/**
 * Whitelist povolených MIME typů (T014 § Inputs). Kontroluje se OBSAH souboru
 * (magic bytes), ne jen přípona/hlavička — viz `validation.ts`.
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Delší strana náhledu (thumbnail) v px. */
export const THUMBNAIL_MAX_DIMENSION = 400;
/** Delší strana web-optimalizované varianty v px. */
export const WEB_MAX_DIMENSION = 1600;

/** Varianty souboru servírované přes serve route. */
export const MEDIA_VARIANTS = ["thumbnail", "web", "original"] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

/** Deriváty (veřejně servírovatelné). Originál mezi ně nepatří (jen vlastník). */
export const DERIVATIVE_VARIANTS = ["thumbnail", "web"] as const;

/** Stav média (zrcadlí enum `MediaStatus` v prisma/schema.prisma). */
export const MEDIA_STATUSES = ["active", "deleted"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

/** Přípona souboru pro daný MIME (pro storage klíče a Content-Type při serve). */
export const MIME_EXTENSION: Record<AllowedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Srozumitelná hláška při odmítnutí příliš velkého souboru (sdílená klient/server). */
export function tooLargeMessage(name?: string): string {
  const mb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
  return name
    ? `Soubor „${name}" je příliš velký (max ${mb} MB).`
    : `Soubor je příliš velký (max ${mb} MB).`;
}

/**
 * Serializovatelný pohled na asset pro knihovnu (thumbnail se servíruje routou).
 * Rozměry jsou AKTIVNÍ verze (po případné úpravě, T015); `edited` značí, že asset
 * má aktivní úpravu (jinak je to originál).
 */
export type MediaCardData = {
  id: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string | null;
  edited: boolean;
};

/** Srozumitelná hláška při nepodporovaném typu souboru. */
export function unsupportedTypeMessage(name?: string): string {
  return name
    ? `Soubor „${name}" má nepodporovaný formát (jen JPEG, PNG, WebP).`
    : `Nepodporovaný formát souboru (jen JPEG, PNG, WebP).`;
}
