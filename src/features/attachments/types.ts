/**
 * Sdílené typy a číselníky attachment systému (T023).
 *
 * Modul je čistý (bez DB / `next/*` / `node:*`), aby šel použít i v klientských
 * komponentách (nahrávací pole, výpis příloh) i na serveru. Hodnoty (whitelist
 * MIME, limit velikosti) jsou jediným zdrojem pro validaci i UI.
 */

/**
 * Viditelnost přílohy. Zrcadlí enum `AttachmentVisibility` v prisma/schema.prisma.
 * Nová příloha je vždy `private` (zadani/16 §6 — least privilege).
 */
export const ATTACHMENT_VISIBILITIES = [
  "private",
  "shared_in_context",
  "public",
] as const;
export type AttachmentVisibility = (typeof ATTACHMENT_VISIBILITIES)[number];

/** Výchozí viditelnost nové přílohy — vždy nejpřísnější. */
export const DEFAULT_VISIBILITY: AttachmentVisibility = "private";

/**
 * Pořadí „otevřenosti" viditelnosti (nižší = soukromější). Slouží k rozhodnutí,
 * jestli změna přílohu ZPŘÍSTUPŇUJE (a u citlivé pak vyžaduje potvrzení).
 */
export const VISIBILITY_RANK: Record<AttachmentVisibility, number> = {
  private: 0,
  shared_in_context: 1,
  public: 2,
};

/** Stav přílohy. Zrcadlí enum `AttachmentStatus` v prisma/schema.prisma. */
export const ATTACHMENT_STATUSES = ["active", "deleted"] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

/**
 * Whitelist povolených MIME typů (T023 § Validation). Kontroluje se OBSAH souboru
 * (magic bytes), ne jen přípona ani klientem deklarovaný `Content-Type`. Držíme se
 * typů spolehlivě rozpoznatelných z obsahu (obrázky + PDF); ZIP-based dokumenty
 * (DOCX/XLSX) nelze bezpečně odlišit od archivu bez skenování obsahu (mimo scope).
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Přípona souboru pro daný MIME (fallback pro sanitizaci názvu bez přípony). */
export const MIME_EXTENSION: Record<AllowedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/**
 * Maximální velikost jedné přílohy v bajtech. Konfigurovatelné přes
 * `ATTACHMENT_MAX_BYTES` (výchozí 25 MB). Čte se lazy, aby test/UI mohly hodnotu
 * přepsat přes env.
 */
export function maxAttachmentBytes(): number {
  const raw = process.env.ATTACHMENT_MAX_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25 * 1024 * 1024;
}

/** Maximální délka názvu souboru po sanitizaci. */
export const FILE_NAME_MAX_LENGTH = 200;

/**
 * Serializovatelný pohled na přílohu pro konzumující kontexty. U smazané přílohy
 * (`deleted: true`) se místo odkazu zobrazí placeholder „příloha byla odstraněna"
 * (T023 § Main flow bod 6) — proto view nese i smazané položky, ne 404.
 */
export type AttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  visibility: AttachmentVisibility;
  sensitive: boolean;
  /** `true` = příloha byla měkce smazána → konzument vykreslí placeholder. */
  deleted: boolean;
  /** Autorizovaná URL pro stažení (proxy). U smazané přílohy `null`. */
  downloadUrl: string | null;
};

/** Autorizovaná (proxy) URL pro stažení přílohy. Jediná cesta k soukromému souboru. */
export function attachmentDownloadUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}`;
}

/** Srozumitelná hláška při odmítnutí příliš velkého souboru (sdílená klient/server). */
export function tooLargeMessage(name?: string): string {
  const mb = Math.round(maxAttachmentBytes() / (1024 * 1024));
  return name
    ? `Soubor „${name}" je příliš velký (max ${mb} MB).`
    : `Soubor je příliš velký (max ${mb} MB).`;
}

/** Srozumitelná hláška při nepodporovaném typu souboru. */
export function unsupportedTypeMessage(name?: string): string {
  return name
    ? `Soubor „${name}" má nepodporovaný formát (jen obrázky a PDF).`
    : `Nepodporovaný formát souboru (jen obrázky a PDF).`;
}
