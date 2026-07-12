import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import sharp from "sharp";
import type { MediaStorage } from "./storage";
import { __setStorageForTests } from "./storage";
import { NEUTRAL_EDIT, type ImageEdit } from "./edit";

/**
 * Acceptance (T015): „opakovaná úprava vychází z originálu, ne z derivátu".
 * `db` je zmockovaná (bez reálné DB), storage je in-memory a zaznamenává, které
 * klíče se ČETLY — dokazujeme, že každý render sáhne na `originalKey`, nikdy na
 * upravený derivát. Tím je zaručeno, že se kvalita opakovanou úpravou nedegraduje.
 */

const updateMock = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { mediaAsset: { update: (args: unknown) => updateMock(args) } },
}));

// Importujeme až po vi.mock, aby service dostal zmockované `db`.
const { applyEditToAsset, revertAssetToOriginal } = await import("./service");
type Row = Awaited<ReturnType<typeof applyEditToAsset>>;

/** In-memory storage, které zaznamenává čtené i smazané klíče. */
class RecordingStorage implements MediaStorage {
  readonly data = new Map<string, Buffer>();
  readonly reads: string[] = [];
  readonly deletes: string[] = [];
  async put(key: string, buf: Buffer): Promise<void> {
    this.data.set(key, buf);
  }
  async get(key: string): Promise<Buffer | null> {
    this.reads.push(key);
    return this.data.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    this.deletes.push(key);
    this.data.delete(key);
  }
}

let storage: RecordingStorage;

async function baseRow(): Promise<Row> {
  const original = await sharp({
    create: { width: 200, height: 120, channels: 3, background: { r: 120, g: 120, b: 120 } },
  })
    .png()
    .toBuffer();
  storage.data.set("orig/original.png", original);
  return {
    id: "asset-1",
    ownerUserId: "user-1",
    ownerOrgId: null,
    mimeType: "image/png",
    originalKey: "orig/original.png",
    thumbnailKey: "orig/thumbnail.webp",
    webKey: "orig/web.webp",
    width: 200,
    height: 120,
    byteSize: 1000,
    contentHash: "hash",
    altText: null,
    editParams: null,
    editedThumbnailKey: null,
    editedWebKey: null,
    editedWidth: null,
    editedHeight: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  storage = new RecordingStorage();
  __setStorageForTests(storage);
  // update vrátí sloučený řádek (jako Prisma), ať navazuje druhá úprava. Prisma
  // `DbNull` na vstupu se v načteném řádku projeví jako `null`.
  updateMock.mockImplementation(({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
    const merged = { ...currentRow, ...data, id: where.id };
    if ((merged.editParams as unknown) === Prisma.DbNull) merged.editParams = null;
    return Promise.resolve(merged);
  });
});

let currentRow: Row;
const edit = (over: Partial<ImageEdit>): ImageEdit => ({ ...NEUTRAL_EDIT, ...over });

describe("applyEditToAsset", () => {
  it("uloží novou aktivní verzi z originálu a nechá originál i základní deriváty", async () => {
    currentRow = await baseRow();
    const updated = await applyEditToAsset(currentRow, edit({ brightness: 1.2 }));

    expect(storage.reads).toEqual(["orig/original.png"]);
    expect(updated.editedThumbnailKey).toBeTruthy();
    expect(updated.editedWebKey).toBeTruthy();
    expect(updated.editParams).toMatchObject({ brightness: 1.2 });
    // Originál i základní deriváty zůstávají nedotčené.
    expect(storage.data.has("orig/original.png")).toBe(true);
    expect(updated.originalKey).toBe("orig/original.png");
    expect(updated.thumbnailKey).toBe("orig/thumbnail.webp");
  });

  it("opakovaná úprava vychází z ORIGINÁLU, ne z předchozího derivátu", async () => {
    currentRow = await baseRow();
    const first = (await applyEditToAsset(currentRow, edit({ brightness: 1.2 }))) as Row;
    currentRow = first;
    storage.reads.length = 0; // reset před druhou úpravou

    const second = (await applyEditToAsset(first, edit({ rotate: 90 }))) as Row;

    // Druhá úprava četla jen originál — nikdy upravený derivát.
    expect(storage.reads).toEqual(["orig/original.png"]);
    expect(storage.reads).not.toContain(first.editedWebKey);
    expect(storage.reads).not.toContain(first.editedThumbnailKey);
    // Rotace 90° prohodí rozměry (z 200×120 → 120×200).
    expect(second.editedWidth).toBe(120);
    expect(second.editedHeight).toBe(200);
    // Předchozí upravené deriváty se uklidily.
    expect(storage.deletes).toContain(first.editedThumbnailKey);
    expect(storage.deletes).toContain(first.editedWebKey);
  });
});

describe("revertAssetToOriginal", () => {
  it("zahodí parametry i upravené deriváty (bezeztrátově)", async () => {
    currentRow = await baseRow();
    const edited = (await applyEditToAsset(currentRow, edit({ brightness: 1.2 }))) as Row;
    currentRow = edited;

    const reverted = await revertAssetToOriginal(edited);

    expect(reverted.editParams).toBeNull();
    expect(reverted.editedThumbnailKey).toBeNull();
    expect(reverted.editedWebKey).toBeNull();
    expect(storage.deletes).toContain(edited.editedThumbnailKey);
    // Základní deriváty z originálu se nikdy nemazaly.
    expect(storage.deletes).not.toContain("orig/web.webp");
  });
});
