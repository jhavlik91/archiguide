"use server";

import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění příloh (attachment.access/manage).
import { canManageAttachment } from "./permissions";
import {
  getAttachmentById,
  setVisibility,
  softDeleteAttachment,
} from "./service";
import { requiresSensitiveConfirmation } from "./rules";
import { attachmentTargetSchema, changeVisibilitySchema } from "./validation";

/**
 * Server akce příloh (T023). Správu (změna viditelnosti, mazání) smí jen vlastník
 * (`canManageAttachment`). Chyby se vrací jako výsledek (bez vyhození), aby je UI
 * uměl zobrazit. Upload NENÍ server akce (běží přes multipart route handler nebo
 * `attach()` z konzumující domény).
 */

export type AttachmentActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation" | "not_found";
      message: string;
    }
  // Zpřístupnění citlivé přílohy vyžaduje explicitní potvrzení (T023 § Main flow bod 4).
  | { ok: false; error: "needs_confirmation"; message: string };

const NOT_FOUND: AttachmentActionResult = {
  ok: false,
  error: "not_found",
  message: "Příloha nebyla nalezena.",
};

function invalid(
  message = "Zkontrolujte zadané údaje.",
): AttachmentActionResult {
  return { ok: false, error: "validation", message };
}

/**
 * Vrátí přílohu, kterou actor smí spravovat (aktivní + vlastník), jinak `null`.
 * Neexistenci vs. cizí přílohu navenek nerozlišujeme (nepotvrzujeme existenci).
 */
async function getManageable(attachmentId: string) {
  const [actor, attachment] = await Promise.all([
    getActor(),
    getAttachmentById(attachmentId),
  ]);
  if (actor.kind !== "user") return { actor, attachment: null as null };
  if (!attachment || attachment.status !== "active") {
    return { actor, attachment: null as null };
  }
  if (!canManageAttachment(actor, { ownerUserId: attachment.ownerUserId })) {
    return { actor, attachment: null as null };
  }
  return { actor, attachment };
}

/**
 * Změní viditelnost přílohy (vědomá akce). Zpřístupnění citlivé přílohy
 * (`sensitive`) k širšímu okruhu vyžaduje `confirm: true` — jinak vrátí
 * `needs_confirmation`, aby UI zobrazilo varování před zveřejněním.
 */
export async function changeAttachmentVisibility(
  input: unknown,
): Promise<AttachmentActionResult> {
  const parsed = changeVisibilitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const { attachment } = await getManageable(parsed.data.attachmentId);
  if (!attachment) return NOT_FOUND;

  const { visibility: next, confirm } = parsed.data;
  if (next === attachment.visibility) return { ok: true }; // beze změny

  if (
    requiresSensitiveConfirmation(
      attachment.visibility,
      next,
      attachment.sensitive,
    ) &&
    confirm !== true
  ) {
    return {
      ok: false,
      error: "needs_confirmation",
      message:
        "Příloha je označená jako citlivá. Zpřístupnění může odhalit osobní údaje — potvrďte zveřejnění.",
    };
  }

  await setVisibility(attachment.id, next);
  trackEvent("attachment.visibility_changed", {
    attachmentId: attachment.id,
    from: attachment.visibility,
    to: next,
    sensitive: attachment.sensitive,
  });
  return { ok: true };
}

/** Měkce smaže přílohu (jen vlastník). Konzumující kontext pak zobrazí placeholder. */
export async function deleteAttachment(
  input: unknown,
): Promise<AttachmentActionResult> {
  const parsed = attachmentTargetSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const { attachment } = await getManageable(parsed.data.attachmentId);
  if (!attachment) return NOT_FOUND;

  await softDeleteAttachment(attachment.id);
  return { ok: true };
}
