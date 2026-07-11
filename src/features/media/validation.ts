import { z } from "zod";
import {
  ALLOWED_MIME_TYPES,
  ALT_TEXT_MAX_LENGTH,
  MAX_FILE_BYTES,
  type AllowedMimeType,
} from "./types";

/**
 * Validace vstupů médií (T014). Dvě roviny:
 *  1. Zod schémata pro metadata (alt text, cíl uploadu, cíl akce).
 *  2. Detekce typu z OBSAHU souboru (magic bytes) — whitelist se NEsmí opírat
 *     jen o příponu ani o klientem deklarovaný `Content-Type` (T014 § Validation).
 *
 * Modul je čistý (bez DB / `sharp`), aby ho šlo pokrýt unit testy i sdílet.
 */

/** Detekuje formát obrázku podle magic bytes. Vrací MIME z whitelistu, nebo `null`. */
export function sniffImageMime(bytes: Uint8Array): AllowedMimeType | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Je typ (podle obsahu) na whitelistu? */
export function isAllowedMime(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export type FileValidation =
  | { ok: true; mime: AllowedMimeType }
  | { ok: false; error: "too_large" | "unsupported_type" };

/**
 * Zvaliduje jeden nahraný soubor podle bajtů: velikost + typ z obsahu.
 * Deklarovaný `Content-Type` se ignoruje — rozhoduje sniff (`sniffImageMime`).
 */
export function validateUploadBytes(bytes: Uint8Array): FileValidation {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: "too_large" };
  }
  const mime = sniffImageMime(bytes);
  if (!mime) return { ok: false, error: "unsupported_type" };
  return { ok: true, mime };
}

// --- Zod schémata -----------------------------------------------------------

/** Alt text: prázdné → `null` (smazání), jinak ořízne a omezí délku. */
export const altTextSchema = z.object({
  assetId: z.string().min(1),
  altText: z
    .string()
    .trim()
    .max(ALT_TEXT_MAX_LENGTH, `Alt text je příliš dlouhý (max ${ALT_TEXT_MAX_LENGTH} znaků).`)
    .transform((v) => (v.length === 0 ? null : v)),
});
export type AltTextInput = z.infer<typeof altTextSchema>;

/** Cíl akce nad jedním assetem (mazání). */
export const assetTargetSchema = z.object({
  assetId: z.string().min(1),
});
export type AssetTargetInput = z.infer<typeof assetTargetSchema>;

/**
 * Cíl uploadu: bez `ownerOrgId` vzniká asset vlastněný uživatelem; s ním
 * firemní asset (vyžaduje org editor+ — ověří route handler).
 */
export const uploadTargetSchema = z.object({
  ownerOrgId: z.string().min(1).optional(),
});
export type UploadTargetInput = z.infer<typeof uploadTargetSchema>;
