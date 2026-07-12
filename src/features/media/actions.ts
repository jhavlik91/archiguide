"use server";

import { revalidatePath } from "next/cache";
import { trackEvent } from "@/lib/analytics";
// Import zároveň registruje oprávnění médií (media.upload/manage/view).
import "./permissions";
import {
  getImageEditorContext,
  getManageableAsset,
  toMediaCard,
  type ImageEditorContext,
} from "./queries";
import {
  applyEditToAsset,
  revertAssetToOriginal,
  setAltText,
  softDeleteAsset,
} from "./service";
import { collectUsages } from "./usage";
import { decideDelete } from "./rules";
import type { MediaUsage } from "./usage";
import { checkCrop, isNeutralEdit, normalizeEdit } from "./edit";
import type { MediaCardData } from "./types";
import { altTextSchema, assetTargetSchema } from "./validation";

/**
 * Server akce médií (T014). Každá akce ověří oprávnění přes čtecí/permission
 * vrstvu (`getManageableAsset`) a teprve pak volá service. Chyby se vrací jako
 * výsledek (bez vyhození), aby je knihovna uměla zobrazit. Upload NENÍ server
 * akce (běží přes multipart route handler `/api/media/upload`).
 */

export type MediaActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation" | "not_found" | "in_use";
      message: string;
      /** U `in_use`: kde je asset použitý (blok mazání s odkazy). */
      usages?: MediaUsage[];
    };

const NOT_FOUND_MESSAGE = "Soubor nebyl nalezen.";
const NOT_FOUND: MediaActionResult = {
  ok: false,
  error: "not_found",
  message: NOT_FOUND_MESSAGE,
};

function invalid(message = "Zkontrolujte zadané údaje."): MediaActionResult {
  return { ok: false, error: "validation", message };
}

/** Uloží/změní alt text assetu. */
export async function saveAltText(input: unknown): Promise<MediaActionResult> {
  const parsed = altTextSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const asset = await getManageableAsset(parsed.data.assetId);
  if (!asset) return NOT_FOUND;

  await setAltText(parsed.data.assetId, parsed.data.altText);
  revalidatePath("/media");
  return { ok: true };
}

/**
 * Smaže asset (měkce). Použití v PUBLIKOVANÉM obsahu mazání blokuje a vrací
 * seznam míst, kde je asset použitý (T014 § Edge cases). Použití jen v draftu
 * projde (varování řeší UI z vráceného stavu). Originál zůstává obnovitelný.
 */
export async function deleteMediaAsset(
  input: unknown,
): Promise<MediaActionResult> {
  const parsed = assetTargetSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const asset = await getManageableAsset(parsed.data.assetId);
  if (!asset) return NOT_FOUND;

  const usages = await collectUsages(parsed.data.assetId);
  const decision = decideDelete(usages);
  if (decision.kind === "blocked") {
    return {
      ok: false,
      error: "in_use",
      message:
        "Soubor je použitý v publikovaném obsahu. Nejdřív ho odeberte z uvedených míst.",
      usages: decision.usages,
    };
  }

  await softDeleteAsset(parsed.data.assetId);
  revalidatePath("/media");
  return { ok: true };
}

// --- Úpravy obrázků (T015) --------------------------------------------------

export type EditContextResult =
  | { ok: true; context: ImageEditorContext }
  | { ok: false; error: "not_found"; message: string };

/** Načte kontext editoru pro asset (jen vlastník / org editor+). */
export async function loadImageEditor(input: unknown): Promise<EditContextResult> {
  const notFound = { ok: false, error: "not_found", message: NOT_FOUND_MESSAGE } as const;
  const parsed = assetTargetSchema.safeParse(input);
  if (!parsed.success) return notFound;

  const context = await getImageEditorContext(parsed.data.assetId);
  if (!context) return notFound;
  return { ok: true, context };
}

export type EditResult =
  | { ok: true; asset: MediaCardData }
  | {
      ok: false;
      error: "validation" | "not_found";
      message: string;
    };

/**
 * Uloží úpravu obrázku jako novou aktivní verzi (T015). Deriváty se renderují
 * z originálu; originál zůstává zachovaný. Neutrální úprava (žádná změna) se uloží
 * jako „vrátit originál". Vrací aktualizovanou kartu pro překreslení knihovny.
 */
export async function applyImageEdit(input: unknown): Promise<EditResult> {
  const parsed = assetTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", message: "Zkontrolujte zadané údaje." };
  }

  const asset = await getManageableAsset(parsed.data.assetId);
  if (!asset) return { ok: false, error: "not_found", message: NOT_FOUND_MESSAGE };

  const edit = normalizeEdit((input as { edit?: unknown }).edit);
  const crop = checkCrop(asset.width, asset.height, edit);
  if (!crop.ok) return { ok: false, error: "validation", message: crop.message };

  // Úprava zpět na neutrální = originál → nedělej zbytečný derivát, jen vrať originál.
  const updated = isNeutralEdit(edit)
    ? await revertAssetToOriginal(asset)
    : await applyEditToAsset(asset, edit);

  trackEvent("media.edited", {
    assetId: asset.id,
    rotate: edit.rotate,
    crop: edit.crop,
    reverted: isNeutralEdit(edit),
  });
  revalidatePath("/media");
  return { ok: true, asset: toMediaCard(updated) };
}

/** Vrátí asset do podoby originálu (T015 § Main flow bod 3). */
export async function revertImageEdit(input: unknown): Promise<EditResult> {
  const parsed = assetTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", message: "Zkontrolujte zadané údaje." };
  }

  const asset = await getManageableAsset(parsed.data.assetId);
  if (!asset) return { ok: false, error: "not_found", message: NOT_FOUND_MESSAGE };

  const updated = await revertAssetToOriginal(asset);
  trackEvent("media.edited", { assetId: asset.id, reverted: true });
  revalidatePath("/media");
  return { ok: true, asset: toMediaCard(updated) };
}
