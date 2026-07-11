"use server";

import { revalidatePath } from "next/cache";
// Import zároveň registruje oprávnění médií (media.upload/manage/view).
import "./permissions";
import { getManageableAsset } from "./queries";
import { setAltText, softDeleteAsset } from "./service";
import { collectUsages } from "./usage";
import { decideDelete } from "./rules";
import type { MediaUsage } from "./usage";
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

const NOT_FOUND: MediaActionResult = {
  ok: false,
  error: "not_found",
  message: "Soubor nebyl nalezen.",
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
