import { z } from "zod";
import {
  ALLOWED_MIME_TYPES,
  ATTACHMENT_VISIBILITIES,
  FILE_NAME_MAX_LENGTH,
  MIME_EXTENSION,
  maxAttachmentBytes,
  type AllowedMimeType,
} from "./types";

/**
 * Validace vstupů attachment systému (T023). Tři roviny:
 *  1. Detekce typu z OBSAHU souboru (magic bytes) — whitelist se NEsmí opírat
 *     jen o příponu ani o klientem deklarovaný `Content-Type`.
 *  2. Sanitizace názvu souboru (žádné cesty, řídicí znaky, rozumná délka).
 *  3. Zod schémata pro metadata akcí (kontext, změna viditelnosti, cíl akce).
 *
 * Modul je čistý (bez DB / storage), aby ho šlo pokrýt unit testy i sdílet.
 */

/** Detekuje formát souboru podle magic bytes. Vrací MIME z whitelistu, nebo `null`. */
export function sniffMime(bytes: Uint8Array): AllowedMimeType | null {
  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
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
  // GIF: "GIF87a" / "GIF89a"
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
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
  // PDF: "%PDF-"
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return null;
}

/** Je typ (podle obsahu) na whitelistu? */
export function isAllowedMime(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Sanitizuje název souboru pro bezpečné uložení a zobrazení:
 *  - zahodí cestu (`/`, `\`) i traversal (`..`) — bereme jen basename,
 *  - odstraní řídicí znaky (kódy < 0x20 a 0x7f DEL),
 *  - ořízne délku (zachová příponu),
 *  - prázdný / degenerovaný název nahradí `soubor.<ext>` podle MIME.
 */
export function sanitizeFileName(raw: string, mime?: AllowedMimeType): string {
  const fallbackExt = mime ? MIME_EXTENSION[mime] : "bin";
  // Jen basename — utne jakoukoli adresářovou cestu (i Windows `\`).
  const base = raw.split(/[/\\]/).pop() ?? "";
  // Řídicí znaky filtrujeme po kódových bodech (bez regex escapů kvůli
  // přenositelnosti zdroje).
  const withoutControls = Array.from(base)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("");
  const cleaned = withoutControls
    .replace(/^\.+/, "") // vedoucí tečky (skryté soubory / „..")
    .trim();

  if (cleaned.length === 0) return `soubor.${fallbackExt}`;
  if (cleaned.length <= FILE_NAME_MAX_LENGTH) return cleaned;

  // Zkrácení se zachováním přípony.
  const dot = cleaned.lastIndexOf(".");
  if (dot > 0) {
    const ext = cleaned.slice(dot);
    const stem = cleaned.slice(0, FILE_NAME_MAX_LENGTH - ext.length);
    return stem + ext;
  }
  return cleaned.slice(0, FILE_NAME_MAX_LENGTH);
}

export type FileValidation =
  | { ok: true; mime: AllowedMimeType }
  | { ok: false; error: "too_large" | "unsupported_type" };

/**
 * Zvaliduje jeden nahraný soubor podle bajtů: velikost + typ z obsahu.
 * Deklarovaný `Content-Type` se ignoruje — rozhoduje sniff (`sniffMime`).
 */
export function validateUploadBytes(bytes: Uint8Array): FileValidation {
  if (bytes.byteLength > maxAttachmentBytes()) {
    return { ok: false, error: "too_large" };
  }
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, error: "unsupported_type" };
  return { ok: true, mime };
}

// --- Zod schémata -----------------------------------------------------------

/** Kontext přílohy (typ domény + ID entity). */
export const contextSchema = z.object({
  contextType: z.string().min(1).max(64),
  contextId: z.string().min(1),
});
export type ContextInput = z.infer<typeof contextSchema>;

/** Cíl akce nad jednou přílohou (mazání). */
export const attachmentTargetSchema = z.object({
  attachmentId: z.string().min(1),
});
export type AttachmentTargetInput = z.infer<typeof attachmentTargetSchema>;

/**
 * Změna viditelnosti přílohy. `confirm` je explicitní potvrzení pro zpřístupnění
 * citlivé přílohy (server si sám ověří, zda je potvrzení potřeba).
 */
export const changeVisibilitySchema = z.object({
  attachmentId: z.string().min(1),
  visibility: z.enum(ATTACHMENT_VISIBILITIES),
  confirm: z.boolean().optional(),
});
export type ChangeVisibilityInput = z.infer<typeof changeVisibilitySchema>;
