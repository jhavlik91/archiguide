import { describe, expect, it } from "vitest";
import {
  altTextSchema,
  isAllowedMime,
  sniffImageMime,
  validateUploadBytes,
} from "./validation";
import { MAX_FILE_BYTES } from "./types";

/** Sestaví bajty s daným prefixem magic bytes (zbytek nuly). */
function withHeader(header: number[], length = 32): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(header, 0);
  return bytes;
}

const JPEG = withHeader([0xff, 0xd8, 0xff, 0xe0]);
const PNG = withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = (() => {
  const b = new Uint8Array(32);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return b;
})();

describe("sniffImageMime", () => {
  it("rozpozná JPEG, PNG i WebP podle magic bytes", () => {
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(PNG)).toBe("image/png");
    expect(sniffImageMime(WEBP)).toBe("image/webp");
  });

  it("neznámý / textový obsah odmítne (null)", () => {
    expect(sniffImageMime(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
    expect(sniffImageMime(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull();
  });

  it("nespoléhá na deklarovaný typ — přejmenované PDF na .jpg neprojde", () => {
    // Obsah je PDF, i kdyby přípona/Content-Type tvrdily obrázek.
    const fakePdf = new TextEncoder().encode("%PDF-1.7 fake image");
    expect(sniffImageMime(fakePdf)).toBeNull();
  });
});

describe("isAllowedMime", () => {
  it("whitelist obsahuje jen JPEG/PNG/WebP", () => {
    expect(isAllowedMime("image/jpeg")).toBe(true);
    expect(isAllowedMime("image/gif")).toBe(false);
    expect(isAllowedMime("application/pdf")).toBe(false);
  });
});

describe("validateUploadBytes", () => {
  it("přijme obrázek v limitu", () => {
    const res = validateUploadBytes(PNG);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mime).toBe("image/png");
  });

  it("odmítne příliš velký soubor (nad 25 MB)", () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff], 0);
    const res = validateUploadBytes(big);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("too_large");
  });

  it("odmítne nepodporovaný formát", () => {
    const res = validateUploadBytes(new Uint8Array([0x00, 0x11, 0x22, 0x33]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("unsupported_type");
  });
});

describe("altTextSchema", () => {
  it("prázdný text → null (smazání alt textu)", () => {
    const parsed = altTextSchema.safeParse({ assetId: "a1", altText: "  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.altText).toBeNull();
  });

  it("ořízne okraje a zachová text", () => {
    const parsed = altTextSchema.safeParse({ assetId: "a1", altText: "  Vila  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.altText).toBe("Vila");
  });
});
