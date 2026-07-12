import "server-only";

import { trackEvent } from "@/lib/analytics";
import { type Actor } from "@/lib/permissions";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění příloh (attachment.access/manage).
import { canAccessAttachment } from "./permissions";
import { resolveContext } from "./registry";
import { type AttachmentContext } from "./rules";
import {
  createAttachment,
  getAttachmentById,
  listByContextWithDeleted,
  type AttachmentRow,
} from "./service";
import {
  attachmentDownloadUrl,
  DEFAULT_VISIBILITY,
  type AttachmentView,
  type AttachmentVisibility,
} from "./types";
import { sanitizeFileName, validateUploadBytes } from "./validation";

/**
 * Sdílená přístupová vrstva příloh (T023) — jádro veřejného API `lib/attachments.ts`.
 * Konzumující domény sem chodí pro přiložení (`attach`), kontrolu přístupu
 * (`canAccess`) a serializovatelné pohledy; NEPÍŠÍ vlastní přístupovou logiku.
 */

/** Nahravaný soubor pro `attach`. */
export type AttachInput = {
  bytes: Buffer;
  fileName: string;
  /** Výchozí `private` (T023 § Main flow bod 1 — nová příloha je vždy soukromá). */
  visibility?: AttachmentVisibility;
  sensitive?: boolean;
  metadata?: unknown;
};

export type AttachResult =
  | { ok: true; attachment: AttachmentRow }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "unknown_context"
        | "forbidden"
        | "too_large"
        | "unsupported_type";
    };

/**
 * Přiloží soubor do daného kontextu (T023 § Main flow). Ověří, že actor je
 * přihlášený a účastníkem existujícího kontextu (resolver domény), zvaliduje
 * soubor (velikost + typ z obsahu), sanitizuje název a uloží — záznam vzniká až
 * po potvrzeném uploadu. Nová příloha je vždy `private`, není-li řečeno jinak.
 */
export async function attach(
  context: AttachmentContext,
  file: AttachInput,
): Promise<AttachResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, error: "unauthenticated" };

  // Kontext musí existovat a patřit uživateli (účastnictví vyhodnotí doména).
  const participation = await resolveContext(context, actor);
  if (!participation.exists) return { ok: false, error: "unknown_context" };
  if (!participation.isParticipant) return { ok: false, error: "forbidden" };

  const validation = validateUploadBytes(file.bytes);
  if (!validation.ok) return { ok: false, error: validation.error };

  const attachment = await createAttachment({
    ownerUserId: actor.userId,
    context,
    bytes: file.bytes,
    mime: validation.mime,
    fileName: sanitizeFileName(file.fileName, validation.mime),
    visibility: file.visibility ?? DEFAULT_VISIBILITY,
    sensitive: file.sensitive ?? false,
    metadata: file.metadata,
  });

  trackEvent("attachment.uploaded", {
    attachmentId: attachment.id,
    contextType: context.type,
    mime: validation.mime,
    bytes: attachment.byteSize,
    visibility: attachment.visibility,
    sensitive: attachment.sensitive,
  });

  return { ok: true, attachment };
}

/** Minimum faktů o příloze, které `canAccess` potřebuje. */
export type AccessTarget = {
  ownerUserId: string;
  visibility: AttachmentVisibility;
  status: string;
  contextType: string;
  contextId: string;
};

/**
 * Smí actor přílohu vidět/stáhnout? Smazaná (`status !== active`) není dostupná
 * nikomu (konzument místo ní vykreslí placeholder). Pro `shared_in_context` se
 * účastnictví zjistí z resolveru domény; jinak se resolver vůbec nevolá.
 */
export async function canAccess(
  actor: Actor,
  attachment: AccessTarget,
): Promise<boolean> {
  if (attachment.status !== "active") return false;

  let isParticipant = false;
  if (attachment.visibility === "shared_in_context") {
    isParticipant = (
      await resolveContext(
        { type: attachment.contextType, id: attachment.contextId },
        actor,
      )
    ).isParticipant;
  }

  return canAccessAttachment(actor, {
    ownerUserId: attachment.ownerUserId,
    visibility: attachment.visibility,
    isParticipant,
  });
}

/** Serializovatelný pohled na přílohu (smazaná → placeholder bez odkazu). */
export function toView(row: AttachmentRow): AttachmentView {
  const deleted = row.status !== "active";
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    visibility: row.visibility,
    sensitive: row.sensitive,
    deleted,
    downloadUrl: deleted ? null : attachmentDownloadUrl(row.id),
  };
}

/**
 * Pohledy na přílohy kontextu pro konzumující doménu VČETNĚ smazaných — smazané
 * nesou `deleted: true`, aby se místo rozbitého odkazu vykreslil placeholder
 * (T023 § Edge cases). Filtrování dle `canAccess` (kdo co uvidí) řeší konzument
 * podle svého actora.
 */
export async function listContextViews(
  context: AttachmentContext,
): Promise<AttachmentView[]> {
  const rows = await listByContextWithDeleted(context);
  return rows.map(toView);
}

/** Příloha podle ID (i smazaná) — pro serve route a správu. */
export function getAttachment(
  attachmentId: string,
): Promise<AttachmentRow | null> {
  return getAttachmentById(attachmentId);
}
