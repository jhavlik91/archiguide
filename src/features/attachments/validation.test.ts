import { afterEach, describe, expect, it } from "vitest";
import {
  isAllowedMime,
  sanitizeFileName,
  sniffMime,
  validateUploadBytes,
} from "./validation";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

describe("sniffMime", () => {
  it("rozpozná typy z whitelistu podle obsahu", () => {
    expect(sniffMime(JPEG)).toBe("image/jpeg");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(GIF)).toBe("image/gif");
    expect(sniffMime(WEBP)).toBe("image/webp");
    expect(sniffMime(PDF)).toBe("application/pdf");
  });

  it("odmítne neznámý obsah (i když má nebezpečnou příponu)", () => {
    // Spustitelný „MZ..." ani prázdný buffer nesmí projít.
    expect(sniffMime(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(sniffMime(new Uint8Array([]))).toBeNull();
  });

  it("isAllowedMime hlídá whitelist", () => {
    expect(isAllowedMime("application/pdf")).toBe(true);
    expect(isAllowedMime("application/x-msdownload")).toBe(false);
  });
});

describe("validateUploadBytes", () => {
  afterEach(() => {
    delete process.env.ATTACHMENT_MAX_BYTES;
  });

  it("přijme validní soubor a vrátí typ z obsahu", () => {
    expect(validateUploadBytes(PDF)).toEqual({
      ok: true,
      mime: "application/pdf",
    });
  });

  it("odmítne nepodporovaný typ", () => {
    expect(validateUploadBytes(new Uint8Array([0x00, 0x01]))).toEqual({
      ok: false,
      error: "unsupported_type",
    });
  });

  it("odmítne příliš velký soubor (limit konfigurovatelný)", () => {
    process.env.ATTACHMENT_MAX_BYTES = "4";
    expect(validateUploadBytes(PDF)).toEqual({ ok: false, error: "too_large" });
  });
});

describe("sanitizeFileName", () => {
  it("zahodí cestu i traversal (bere jen basename)", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\a\\tajne.pdf")).toBe("tajne.pdf");
    expect(sanitizeFileName("/var/www/soubor.png")).toBe("soubor.png");
  });

  it("odstraní řídicí znaky, zachová běžnou mezeru", () => {
    // Tab (0x09) i DEL (0x7f) jsou řídicí znaky → pryč.
    const withControls =
      "a" + String.fromCharCode(9) + "b" + String.fromCharCode(0x7f) + ".png";
    expect(sanitizeFileName(withControls)).toBe("ab.png");
    // Běžná mezera uvnitř názvu zůstává.
    expect(sanitizeFileName("muj soubor.png")).toBe("muj soubor.png");
    expect(sanitizeFileName("...skryty.pdf")).toBe("skryty.pdf");
  });

  it("prázdný/degenerovaný název nahradí fallbackem dle MIME", () => {
    expect(sanitizeFileName("", "application/pdf")).toBe("soubor.pdf");
    expect(sanitizeFileName("///", "image/png")).toBe("soubor.png");
  });

  it("zkrátí příliš dlouhý název a zachová příponu", () => {
    const long = "a".repeat(500) + ".pdf";
    const out = sanitizeFileName(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});
