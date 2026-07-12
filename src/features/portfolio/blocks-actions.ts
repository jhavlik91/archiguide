"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
// Import zároveň registruje oprávnění portfolia i seamy bloků (viz blocks-service).
import { getEditableProject } from "./queries";
import { saveDraftBlocks } from "./blocks-service";
import {
  isPortfolioBlockKind,
  savePortfolioBlocksSchema,
} from "./blocks";

/**
 * Server akce obsahových bloků (T013). Autosave posílá celý dokument; akce ověří
 * editační právo (přes `getEditableProject`), zvaliduje payload a uloží. Chyby se
 * VRACÍ (nevyhazují), aby editor uměl zobrazit stav „chyba" a data si podržel
 * v lokálním bufferu k opakování — nikdy nehlásit falešný úspěch (T013 § Main flow).
 */

export type SavePortfolioBlocksResult =
  | { ok: true; version: number; conflict: boolean }
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation";
      message: string;
    };

export async function savePortfolioBlocks(
  input: unknown,
): Promise<SavePortfolioBlocksResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return {
      ok: false,
      error: "unauthenticated",
      message: "Přihlaste se prosím.",
    };
  }

  const parsed = savePortfolioBlocksSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      message: parsed.error.issues[0]?.message ?? "Neplatná data bloků.",
    };
  }

  // Neexistující i nedostupné dílo hlásíme stejně (neprozrazovat cizí draft).
  const editable = await getEditableProject(parsed.data.projectId);
  if (!editable) {
    return {
      ok: false,
      error: "forbidden",
      message: "K úpravě tohoto díla nemáte oprávnění.",
    };
  }

  const result = await saveDraftBlocks(
    parsed.data.projectId,
    parsed.data.baseVersion,
    parsed.data.blocks,
  );

  // Náhled/veřejná verze se mění až publikací; stačí revalidovat editor.
  revalidatePath(`/portfolio/${parsed.data.projectId}`);
  return { ok: true, version: result.version, conflict: result.conflict };
}

/**
 * Zaznamená přidání bloku (analytika `portfolio.block_added` s typem). Volá se
 * z editoru „fire-and-forget"; při chybě jen tiše skončí (nesmí blokovat editaci).
 */
export async function logPortfolioBlockAdded(
  projectId: string,
  blockType: string,
): Promise<void> {
  const actor = await getActor();
  if (actor.kind !== "user" || !isPortfolioBlockKind(blockType)) return;
  trackEvent("portfolio.block_added", {
    userId: actor.userId,
    projectId,
    blockType,
  });
}

/** Zaznamená použití náhledu (analytika `portfolio.preview_used`). */
export async function logPortfolioPreviewUsed(projectId: string): Promise<void> {
  const actor = await getActor();
  if (actor.kind !== "user") return;
  trackEvent("portfolio.preview_used", { userId: actor.userId, projectId });
}
