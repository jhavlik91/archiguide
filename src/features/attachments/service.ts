import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getStorage } from "./storage";
import type { AttachmentContext } from "./rules";
import type { AllowedMimeType, AttachmentVisibility } from "./types";

/**
 * Datová vrstva příloh (T023). Jediné místo, které sahá na `db.attachment` a na
 * storage adaptér. Oprávnění (kdo smí akci provést) řeší queries/actions/route
 * přes permission vrstvu; tady drží invarianty (záznam vzniká až po uloženém
 * souboru, mazání je měkké).
 */

/** Aktivní i smazaná příloha podle ID (serve route musí umět doběhnout odkazy). */
export function getAttachmentById(attachmentId: string) {
  return db.attachment.findUnique({ where: { id: attachmentId } });
}

export type AttachmentRow = NonNullable<
  Awaited<ReturnType<typeof getAttachmentById>>
>;

/** Aktivní přílohy daného kontextu (nejnovější první). Smazané nevrací. */
export function listActiveByContext(context: AttachmentContext) {
  return db.attachment.findMany({
    where: {
      contextType: context.type,
      contextId: context.id,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Přílohy daného kontextu VČETNĚ smazaných (konzument vykreslí placeholder). */
export function listByContextWithDeleted(context: AttachmentContext) {
  return db.attachment.findMany({
    where: { contextType: context.type, contextId: context.id },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateAttachmentInput = {
  ownerUserId: string;
  context: AttachmentContext;
  bytes: Buffer;
  mime: AllowedMimeType;
  fileName: string;
  visibility: AttachmentVisibility;
  sensitive: boolean;
  metadata?: unknown;
};

/**
 * Uloží soubor do storage a AŽ POTÉ založí `Attachment` (žádný osiřelý záznam —
 * T023 § Alternative flows: upload selže uprostřed → nevznikne řádek). Storage
 * klíč je náhodný (UUID prefix), takže tentýž soubor ve dvou kontextech = dva
 * nezávislé záznamy i soubory.
 */
export async function createAttachment(
  input: CreateAttachmentInput,
): Promise<AttachmentRow> {
  const storageKey = `${randomUUID()}/file`;
  await getStorage().put(storageKey, input.bytes, input.mime);

  return db.attachment.create({
    data: {
      ownerUserId: input.ownerUserId,
      contextType: input.context.type,
      contextId: input.context.id,
      storageKey,
      mimeType: input.mime,
      fileName: input.fileName,
      byteSize: input.bytes.byteLength,
      visibility: input.visibility,
      sensitive: input.sensitive,
      metadata:
        input.metadata === undefined ? undefined : (input.metadata as object),
    },
  });
}

/** Změní viditelnost aktivní přílohy. Vrací počet dotčených řádků (0 = neaktivní). */
export async function setVisibility(
  attachmentId: string,
  visibility: AttachmentVisibility,
): Promise<number> {
  const res = await db.attachment.updateMany({
    where: { id: attachmentId, status: "active" },
    data: { visibility },
  });
  return res.count;
}

/**
 * Měkce smaže přílohu (`status = deleted`). Soubor ve storage ZŮSTÁVÁ — mazání je
 * vratné a konzumující kontext má z čeho vykreslit placeholder. Idempotentní.
 */
export async function softDeleteAttachment(
  attachmentId: string,
): Promise<void> {
  await db.attachment.updateMany({
    where: { id: attachmentId, status: "active" },
    data: { status: "deleted" },
  });
}
