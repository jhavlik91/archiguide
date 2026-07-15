"use server";

import { randomUUID } from "node:crypto";
import { trackEvent } from "@/lib/analytics";
import { getAttachment } from "@/lib/attachments";
import { softDeleteAttachment } from "@/features/attachments/service";
import { reportContent } from "@/features/moderation/service";
import { isMessageReportReason } from "@/features/moderation/rules";
import { reportMessageSchema } from "@/features/moderation/validation";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění messagingu (access/send/start/report/block).
import {
  canAccessConversation,
  canBlockInConversation,
  canReportInConversation,
  canStartConversation,
} from "./permissions";
import { sendBlockReason } from "./rules";
import { notifyNewMessage, performSend, type SendResult } from "./send";
import {
  createBlock,
  createMessage,
  findOrCreateConversation,
  getConversationById,
  getMessageForModeration,
  getUserStatus,
  markRead,
  removeBlock,
  setArchived,
} from "./service";
import { type ConversationContext } from "./types";
import {
  archiveSchema,
  blockSchema,
  conversationTargetSchema,
  deleteAttachmentSchema,
  sendMessageSchema,
  startConversationSchema,
  unblockUserSchema,
} from "./validation";

/**
 * Server akce messagingu (T030 + T031). Číst i psát smí jen účastník konverzace.
 * Chyby se vrací jako výsledek (bez vyhození), aby je UI zobrazil a NIKDY falešně
 * nehlásil odesláno (zadani/16 §8). Vlastní jádro odeslání (kontroly + atomické
 * vložení) žije v `send.ts`, ať ho sdílí i multipart routa s přílohami.
 */

export type { SendResult } from "./send";

export type StartResult =
  | { ok: true; conversationId: string }
  | {
      ok: false;
      error: "unauthenticated" | "not_found" | "validation" | "failed";
      message: string;
    };

export type SimpleResult = { ok: boolean; message?: string };

export type ReportResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthenticated" | "not_found" | "validation" | "self" | "failed";
      message: string;
    };

/**
 * Odešle textovou zprávu do existující konverzace (bez příloh — ty jdou přes
 * multipart routu `/api/messages`). Idempotentní přes `clientToken`; kontroly,
 * vložení i notifikaci příjemců (T032) sdílí s routou přes `performSend`.
 */
export async function sendMessage(input: unknown): Promise<SendResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      message: parsed.error.issues[0]?.message ?? "Zkontrolujte zprávu.",
    };
  }

  return performSend({
    conversationId: parsed.data.conversationId,
    content: parsed.data.content,
    clientToken: parsed.data.clientToken,
    replyToId: parsed.data.replyToId,
    attachments: [],
  });
}

/**
 * Zahájí konverzaci s příjemcem (z kontextu nebo napřímo), případně rovnou odešle
 * úvodní zprávu. Existující konverzace stejné dvojice ve stejném kontextu se
 * znovupoužije (žádné duplicity). Vrací ID konverzace pro přesměrování.
 */
export async function startConversation(input: unknown): Promise<StartResult> {
  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      message: parsed.error.issues[0]?.message ?? "Zkontrolujte zadané údaje.",
    };
  }

  const actor = await getActor();
  if (!canStartConversation(actor) || actor.kind !== "user") {
    return { ok: false, error: "unauthenticated", message: "Přihlaste se prosím." };
  }

  const recipientId = parsed.data.recipientUserId;
  if (recipientId === actor.userId) {
    return {
      ok: false,
      error: "validation",
      message: "Konverzaci nelze zahájit sám se sebou.",
    };
  }

  const recipient = await getUserStatus(recipientId);
  if (!recipient || recipient.status === "deleted") {
    return { ok: false, error: "not_found", message: "Příjemce neexistuje." };
  }

  const context: ConversationContext | null =
    parsed.data.contextType && parsed.data.contextId
      ? { type: parsed.data.contextType, id: parsed.data.contextId }
      : null;

  try {
    const { conversation, created } = await findOrCreateConversation({
      context,
      participantUserIds: [actor.userId, recipientId],
    });

    if (created) {
      trackEvent("messaging.conversation_started", {
        conversationId: conversation.id,
        context: context?.type ?? "direct",
      });
    }

    // Úvodní zpráva jen když je vyplněná a protistrana je dostupná.
    if (parsed.data.content && !sendBlockReason([recipient.status])) {
      const { created: msgCreated } = await createMessage({
        conversationId: conversation.id,
        senderUserId: actor.userId,
        content: parsed.data.content,
        clientToken: parsed.data.clientToken ?? randomUUID(),
      });
      if (msgCreated) {
        trackEvent("messaging.message_sent", {
          conversationId: conversation.id,
        });
        await notifyNewMessage(conversation.id, actor.userId, [
          actor.userId,
          recipientId,
        ]);
      }
    }

    return { ok: true, conversationId: conversation.id };
  } catch {
    return {
      ok: false,
      error: "failed",
      message: "Konverzaci se nepodařilo zahájit. Zkuste to prosím znovu.",
    };
  }
}

/** Načte accessible konverzaci diváka nebo `null` (neexistuje / není účastník). */
async function accessibleConversation(
  conversationId: string,
): Promise<{ userId: string; id: string; otherUserIds: string[] } | null> {
  const actor = await getActor();
  if (actor.kind !== "user") return null;
  const conv = await getConversationById(conversationId);
  if (!conv) return null;
  const participantUserIds = conv.participants.map((p) => p.userId);
  if (!canAccessConversation(actor, { participantUserIds })) return null;
  return {
    userId: actor.userId,
    id: conv.id,
    otherUserIds: participantUserIds.filter((id) => id !== actor.userId),
  };
}

/** Označí konverzaci jako přečtenou (volá klient při otevření vlákna). */
export async function markConversationRead(
  input: unknown,
): Promise<SimpleResult> {
  const parsed = conversationTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const target = await accessibleConversation(parsed.data.conversationId);
  if (!target) return { ok: false };
  await markRead(target.id, target.userId);
  return { ok: true };
}

/** Archivuje / vrátí z archivu konverzaci pro diváka (per-účastník stav). */
export async function archiveConversation(
  input: unknown,
): Promise<SimpleResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Neplatný požadavek." };
  const target = await accessibleConversation(parsed.data.conversationId);
  if (!target) return { ok: false, message: "Konverzace nebyla nalezena." };
  await setArchived(target.id, target.userId, parsed.data.archived);
  return { ok: true };
}

/**
 * (Od)blokuje protistranu konverzace (T031 § Main flow bod 2). Blokace je vratná;
 * blokovaný nemůže do sdílené konverzace psát a blokující ji nevidí v aktivním
 * inboxu. Cíl (protistranu) odvodíme z konverzace — akce nepracuje se surovým
 * userId, aby nešlo blokovat kohokoli mimo vlastní konverzaci.
 */
export async function setBlock(input: unknown): Promise<SimpleResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Neplatný požadavek." };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, message: "Přihlaste se prosím." };

  const conv = await getConversationById(parsed.data.conversationId);
  if (!conv) return { ok: false, message: "Konverzace nebyla nalezena." };
  const participantUserIds = conv.participants.map((p) => p.userId);
  if (!canBlockInConversation(actor, { participantUserIds })) {
    return { ok: false, message: "Konverzace nebyla nalezena." };
  }

  const otherIds = participantUserIds.filter((id) => id !== actor.userId);
  await Promise.all(
    otherIds.map((id) =>
      parsed.data.blocked
        ? createBlock(actor.userId, id)
        : removeBlock(actor.userId, id),
    ),
  );

  if (parsed.data.blocked) {
    trackEvent("messaging.conversation_blocked", { conversationId: conv.id });
  }
  return { ok: true };
}

/** Odblokuje konkrétního uživatele ze seznamu v nastavení (T031). */
export async function unblockUser(input: unknown): Promise<SimpleResult> {
  const parsed = unblockUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Neplatný požadavek." };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, message: "Přihlaste se prosím." };

  await removeBlock(actor.userId, parsed.data.blockedUserId);
  return { ok: true };
}

/**
 * Nahlásí zprávu do moderační fronty (T031 § Main flow bod 3). Smí jen účastník
 * konverzace a jen cizí zprávu (vlastní nedává smysl). Zakládá se přes sdílený
 * report systém (T036, `reportContent`) — duplicitní nahlášení otevřeného
 * případu se agreguje; moderační workflow řeší admin fronta.
 */
export async function reportMessage(input: unknown): Promise<ReportResult> {
  const parsed = reportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      message: parsed.error.issues[0]?.message ?? "Vyberte důvod nahlášení.",
    };
  }
  // Přijmeme jen důvody nabízené pro zprávy (ostatní patří jiným cílům).
  if (!isMessageReportReason(parsed.data.reason)) {
    return { ok: false, error: "validation", message: "Neplatný důvod nahlášení." };
  }

  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "unauthenticated", message: "Přihlaste se prosím." };
  }

  const message = await getMessageForModeration(parsed.data.messageId);
  // Nerozlišujeme neexistující vs. cizí (nepotvrzujeme existenci).
  if (
    !message ||
    !canReportInConversation(actor, {
      participantUserIds: message.participantUserIds,
    })
  ) {
    return { ok: false, error: "not_found", message: "Zpráva nebyla nalezena." };
  }
  if (message.senderUserId === actor.userId) {
    return { ok: false, error: "self", message: "Vlastní zprávu nelze nahlásit." };
  }

  try {
    const result = await reportContent({
      reporterUserId: actor.userId,
      targetType: "message",
      targetId: parsed.data.messageId,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
    });
    if (!result.ok) {
      // `own_content`/`target_not_found` jsou už ošetřené výše — sem spadnou
      // jen souběhy (zpráva mezitím zanikla apod.).
      return { ok: false, error: "not_found", message: "Zpráva nebyla nalezena." };
    }
    if (!result.deduped) {
      trackEvent("messaging.message_reported", {
        messageId: parsed.data.messageId,
        reason: parsed.data.reason,
      });
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "failed",
      message: "Nahlášení se nepodařilo. Zkuste to prosím znovu.",
    };
  }
}

/**
 * Odstraní vlastní přílohu zprávy (T031 § Main flow bod 5) → měkké smazání, ve
 * vlákně se místo ní zobrazí placeholder. Smazat smí jen vlastník a jen přílohu
 * v kontextu `message` (ne cizí kontexty).
 */
export async function deleteMessageAttachment(
  input: unknown,
): Promise<SimpleResult> {
  const parsed = deleteAttachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Neplatný požadavek." };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, message: "Přihlaste se prosím." };

  const attachment = await getAttachment(parsed.data.attachmentId);
  if (
    !attachment ||
    attachment.contextType !== "message" ||
    attachment.ownerUserId !== actor.userId
  ) {
    return { ok: false, message: "Přílohu nelze odstranit." };
  }

  await softDeleteAttachment(attachment.id);
  return { ok: true };
}
