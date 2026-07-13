"use server";

import { randomUUID } from "node:crypto";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění messagingu (access/send/start).
import {
  canAccessConversation,
  canSendToConversation,
  canStartConversation,
} from "./permissions";
import { toMessageView } from "./queries";
import { sendBlockReason } from "./rules";
import {
  createMessage,
  findOrCreateConversation,
  getConversationById,
  getIdentityFacts,
  getUserStatus,
  markRead,
  messageBelongsToConversation,
  setArchived,
} from "./service";
import { type ConversationContext, type MessageView } from "./types";
import {
  archiveSchema,
  conversationTargetSchema,
  sendMessageSchema,
  startConversationSchema,
} from "./validation";

/**
 * Server akce messagingu (T030). Číst i psát smí jen účastník konverzace
 * (`canAccessConversation` / `canSendToConversation`). Chyby se vrací jako
 * výsledek (bez vyhození), aby je UI zobrazil a NIKDY falešně nehlásil odesláno
 * (zadani/16 §8) — jakékoli selhání uložení skončí `error: "failed"`, rozepsaný
 * text zůstává v poli klienta.
 */

export type SendResult =
  | { ok: true; message: MessageView }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "not_found"
        | "validation"
        | "blocked"
        | "failed";
      message: string;
    };

export type StartResult =
  | { ok: true; conversationId: string }
  | {
      ok: false;
      error: "unauthenticated" | "not_found" | "validation" | "failed";
      message: string;
    };

export type SimpleResult = { ok: boolean; message?: string };

// Neexistenci a cizí konverzaci nerozlišujeme (nepotvrzujeme existenci).
const NOT_FOUND = {
  ok: false as const,
  error: "not_found" as const,
  message: "Konverzace nebyla nalezena.",
};

/**
 * Odešle zprávu do existující konverzace. Idempotentní přes `clientToken`
 * (double-click nevytvoří duplikát). Odeslání vůči zrušené/deaktivované
 * protistraně se odmítne s vysvětlením (`blocked`), historie zůstává čitelná.
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

  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "unauthenticated", message: "Přihlaste se prosím." };
  }

  try {
    const conv = await getConversationById(parsed.data.conversationId);
    if (!conv) return NOT_FOUND;

    const participantUserIds = conv.participants.map((p) => p.userId);
    if (!canSendToConversation(actor, { participantUserIds })) return NOT_FOUND;

    const facts = await getIdentityFacts(participantUserIds);
    const otherStatuses = participantUserIds
      .filter((id) => id !== actor.userId)
      .map((id) => facts.get(id)?.status ?? "deleted");
    const blockedReason = sendBlockReason(otherStatuses);
    if (blockedReason) {
      return { ok: false, error: "blocked", message: blockedReason };
    }

    if (parsed.data.replyToId) {
      const belongs = await messageBelongsToConversation(
        parsed.data.replyToId,
        conv.id,
      );
      if (!belongs) {
        return {
          ok: false,
          error: "validation",
          message: "Odpovídaná zpráva nepatří do této konverzace.",
        };
      }
    }

    const { message, created } = await createMessage({
      conversationId: conv.id,
      senderUserId: actor.userId,
      content: parsed.data.content,
      clientToken: parsed.data.clientToken,
      replyToId: parsed.data.replyToId,
    });

    // Analytika bez obsahu zprávy (zadani/14 — pravidla). Jen nově vložená.
    if (created) {
      trackEvent("messaging.message_sent", {
        conversationId: conv.id,
        messageId: message.id,
      });
    }

    return { ok: true, message: toMessageView(message, actor.userId, facts) };
  } catch {
    return {
      ok: false,
      error: "failed",
      message: "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.",
    };
  }
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
async function accessibleConversationId(
  conversationId: string,
): Promise<{ userId: string; id: string } | null> {
  const actor = await getActor();
  if (actor.kind !== "user") return null;
  const conv = await getConversationById(conversationId);
  if (!conv) return null;
  const participantUserIds = conv.participants.map((p) => p.userId);
  if (!canAccessConversation(actor, { participantUserIds })) return null;
  return { userId: actor.userId, id: conv.id };
}

/** Označí konverzaci jako přečtenou (volá klient při otevření vlákna). */
export async function markConversationRead(
  input: unknown,
): Promise<SimpleResult> {
  const parsed = conversationTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const target = await accessibleConversationId(parsed.data.conversationId);
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
  const target = await accessibleConversationId(parsed.data.conversationId);
  if (!target) return { ok: false, message: "Konverzace nebyla nalezena." };
  await setArchived(target.id, target.userId, parsed.data.archived);
  return { ok: true };
}
