import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { makeThumbnail, makeWebVariant, readDimensions, renderEdit } from "./image";
import { getStorage, hashBytes } from "./storage";
import { MIME_EXTENSION, type AllowedMimeType } from "./types";
import type { MediaOwnerRef } from "./rules";
import type { ImageEdit } from "./edit";

/**
 * Datová vrstva médií (T014). Jediné místo, které sahá na `db.mediaAsset` a na
 * storage adaptér. Orchestruje upload (deriváty + uložení + zápis) a měkké mazání;
 * invarianty (právě jeden vlastník, originál se nepřepisuje) drží tady na serveru.
 * Oprávnění (kdo smí akci provést) řeší route/actions přes permission vrstvu.
 */

/** Sloupce vlastníka z polymorfního odkazu (právě jeden vyplněný). */
function ownerColumns(owner: MediaOwnerRef) {
  return owner.type === "user"
    ? { ownerUserId: owner.userId, ownerOrgId: null }
    : { ownerUserId: null, ownerOrgId: owner.orgId };
}

/** WHERE filtr na assety daného vlastníka. */
function ownerWhere(owner: MediaOwnerRef) {
  return owner.type === "user"
    ? { ownerUserId: owner.userId }
    : { ownerOrgId: owner.orgId };
}

// --- Čtení ------------------------------------------------------------------

/** Asset podle ID (i smazaný — serve route musí umět doběhnout odkazy). */
export function getAssetById(assetId: string) {
  return db.mediaAsset.findUnique({ where: { id: assetId } });
}

export type MediaAssetRow = NonNullable<
  Awaited<ReturnType<typeof getAssetById>>
>;

/** Aktivní assety vlastníka (nejnovější první). Smazané nevrací. */
export function listActiveAssets(owner: MediaOwnerRef) {
  return db.mediaAsset.findMany({
    where: { ...ownerWhere(owner), status: "active" },
    orderBy: { createdAt: "desc" },
  });
}

/** Aktivní asset vlastníka se stejným hashem (dedup), nebo `null`. */
function findByHash(owner: MediaOwnerRef, contentHash: string) {
  return db.mediaAsset.findFirst({
    where: { ...ownerWhere(owner), contentHash, status: "active" },
  });
}

// --- Upload -----------------------------------------------------------------

/**
 * Zpracuje nahraný (už zvalidovaný) obrázek: přečte rozměry, vygeneruje deriváty
 * (thumbnail + web, bez EXIF), uloží originál i deriváty do storage a založí
 * `MediaAsset`. **Originál se ukládá beze změny a nikdy se nepřepisuje.** Deriváty
 * jsou samostatné soubory (T014 § Main flow bod 5).
 *
 * Dedup (volitelný, T014 § Edge cases): pokud vlastník už má aktivní asset se
 * stejným hashem, vrátí ho a nová kopie se neukládá.
 */
export async function createAssetFromUpload(
  owner: MediaOwnerRef,
  bytes: Buffer,
  mime: AllowedMimeType,
): Promise<MediaAssetRow> {
  const contentHash = hashBytes(bytes);
  const existing = await findByHash(owner, contentHash);
  if (existing) return existing;

  const [dimensions, thumbnail, web] = await Promise.all([
    readDimensions(bytes),
    makeThumbnail(bytes),
    makeWebVariant(bytes),
  ]);

  const storage = getStorage();
  const prefix = randomUUID();
  const originalKey = `${prefix}/original.${MIME_EXTENSION[mime]}`;
  const thumbnailKey = `${prefix}/thumbnail.webp`;
  const webKey = `${prefix}/web.webp`;

  await Promise.all([
    storage.put(originalKey, bytes, mime),
    storage.put(thumbnailKey, thumbnail.data, thumbnail.mime),
    storage.put(webKey, web.data, web.mime),
  ]);

  return db.mediaAsset.create({
    data: {
      ...ownerColumns(owner),
      mimeType: mime,
      originalKey,
      thumbnailKey,
      webKey,
      width: dimensions.width,
      height: dimensions.height,
      byteSize: bytes.byteLength,
      contentHash,
    },
  });
}

// --- Správa -----------------------------------------------------------------

// --- Úpravy obrázků (T015) --------------------------------------------------

/**
 * Uloží upravenou verzi assetu jako NOVOU aktivní verzi. Deriváty se renderují
 * z ORIGINÁLU (ne z předchozí verze) → opakovaná úprava nedegraduje kvalitu
 * (T015 § Edge cases). Originál i jeho základní deriváty (`thumbnailKey`/`webKey`)
 * zůstávají nedotčené, takže „vrátit originál" je bezeztrátové.
 *
 * Upravené deriváty dostanou vždy nové storage klíče (cache-busting) a předchozí
 * upravené deriváty se uklidí (best-effort).
 */
export async function applyEditToAsset(
  asset: MediaAssetRow,
  edit: ImageEdit,
): Promise<MediaAssetRow> {
  const storage = getStorage();
  const originalBytes = await storage.get(asset.originalKey);
  if (!originalBytes) throw new Error("Originál média není dostupný.");

  const render = await renderEdit(originalBytes, edit);

  const prefix = randomUUID();
  const editedThumbnailKey = `${prefix}/edited-thumbnail.webp`;
  const editedWebKey = `${prefix}/edited-web.webp`;
  await Promise.all([
    storage.put(editedThumbnailKey, render.thumbnail.data, render.thumbnail.mime),
    storage.put(editedWebKey, render.web.data, render.web.mime),
  ]);

  const updated = await db.mediaAsset.update({
    where: { id: asset.id },
    data: {
      editParams: edit,
      editedThumbnailKey,
      editedWebKey,
      editedWidth: render.width,
      editedHeight: render.height,
    },
  });

  await cleanupEditedDerivatives(asset);
  return updated;
}

/**
 * Vrátí asset do podoby originálu: zahodí parametry i upravené deriváty. Základní
 * deriváty z originálu (`thumbnailKey`/`webKey`) se nikdy nemazaly, takže obnovení
 * je okamžité a bezeztrátové (T015 § Main flow bod 3). Idempotentní.
 */
export async function revertAssetToOriginal(
  asset: MediaAssetRow,
): Promise<MediaAssetRow> {
  const updated = await db.mediaAsset.update({
    where: { id: asset.id },
    data: {
      editParams: Prisma.DbNull,
      editedThumbnailKey: null,
      editedWebKey: null,
      editedWidth: null,
      editedHeight: null,
    },
  });
  await cleanupEditedDerivatives(asset);
  return updated;
}

/** Smaže staré upravené deriváty ze storage (best-effort — chyba nesmí shodit akci). */
async function cleanupEditedDerivatives(asset: MediaAssetRow): Promise<void> {
  const storage = getStorage();
  const keys = [asset.editedThumbnailKey, asset.editedWebKey].filter(
    (k): k is string => Boolean(k),
  );
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => {})));
}

/** Uloží alt text assetu (`null` = smazán). */
export async function setAltText(
  assetId: string,
  altText: string | null,
): Promise<void> {
  await db.mediaAsset.update({
    where: { id: assetId },
    data: { altText },
  });
}

/**
 * Měkce smaže asset (`status = deleted`). Originál i deriváty ve storage ZŮSTÁVAJÍ
 * — mazání je vratné a originál musí být obnovitelný (zadani/16 §7). Idempotentní.
 */
export async function softDeleteAsset(assetId: string): Promise<void> {
  await db.mediaAsset.updateMany({
    where: { id: assetId, status: "active" },
    data: { status: "deleted" },
  });
}
