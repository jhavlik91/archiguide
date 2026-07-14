import "server-only";

import { trackEvent } from "@/lib/analytics";
import { toView as attachmentToView } from "@/lib/attachments";
import { emit } from "@/lib/notifications";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění messagingu (access/send/…).
import { canSendToConversation } from "./permissions";
import { toMessageView } from "./queries";
import { BLOCKED_SEND_MESSAGE, OUTGOING_BLOCK_MESSAGE, sendBlockReason } from "./rules";
import {
  attachmentsForMessages,
  createMessage,
  createMessageWithAttachments,
  getBlockPair,
  getConversationById,
  getIdentityFacts,
  messageBelongsToConversation,
  type PreparedAttachment,
} from "./service";
import { type MessageView } from "./types";

/**
 * Sdílené jádro odeslání zprávy (T030 + přílohy/blokace T031). Používá ho jak
 * textová server akce (`actions.sendMessage`), tak multipart routa s přílohami
 * (`/api/messages`), aby kontroly (účastnictví, dostupnost protistrany, blokace,
 * reply reference), idempotence i notifikace příjemců (T032) žily na JEDNOM
 * místě. Nikdy nevyhazuje kvůli očekávaným stavům — vrací výsledek, aby UI
 * nehlásilo falešně „odesláno".
 */

/**
 * Vyrozumí ostatní účastníky o nové zprávě (T032). Emituje se přes jednotné API
 * (`@/lib/notifications`), je best-effort (nikdy neshodí odeslání) a NIKDY nenese
 * obsah zprávy — jen „nová zpráva" + odkaz do konverzace (T032 § Permissions).
 * Deduplikace přes klíč konverzace: rychlá série zpráv = 1 nepřečtená notifikace
 * s počtem. Odesílatel (původce akce) notifikaci nedostane.
 *
 * Bydlí tady (ne v `actions.ts`), protože zprávu zakládá i multipart routa
 * `/api/messages` — kdyby emit zůstal jen v akci, zpráva s přílohou by příjemci
 * notifikaci nikdy neposlala. `startConversation` si ho importuje pro úvodní zprávu.
 */
export async function notifyNewMessage(
  conversationId: string,
  senderUserId: string,
  participantUserIds: readonly string[],
): Promise<void> {
  const recipients = participantUserIds.filter((id) => id !== senderUserId);
  await Promise.all(
    recipients.map((recipientUserId) =>
      emit({
        eventType: "new_message",
        recipientUserId,
        actorUserId: senderUserId,
        title: "Nová zpráva",
        reason: "Dostáváte upozornění na nové zprávy ve vaší konverzaci.",
        link: `/messages/${conversationId}`,
        // Dedup klíč se odvodí z kontextu (`new_message:conversation:<id>`) —
        // explicitní klíč by se s odvozeným rozešel u dalších emitentů události.
        context: { type: "conversation", id: conversationId },
      }),
    ),
  );
}

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

// Neexistenci a cizí konverzaci nerozlišujeme (nepotvrzujeme existenci).
const NOT_FOUND: SendResult = {
  ok: false,
  error: "not_found",
  message: "Konverzace nebyla nalezena.",
};

export type PerformSendInput = {
  conversationId: string;
  content: string;
  clientToken: string;
  replyToId?: string;
  /** Připravené přílohy (bajty zvalidované + název sanitizovaný ve volajícím). */
  attachments: PreparedAttachment[];
};

/**
 * Ověří práva a stav, pak zprávu (s případnými přílohami) atomicky vloží. Blokace:
 * pokud protistrana zablokovala odesílatele → neutrální „nelze doručit"; pokud
 * odesílatel zablokoval protistranu → vysvětlení s cestou k odblokování. Obojí
 * skončí `error: "blocked"` (text zůstává v poli klienta).
 */
export async function performSend(input: PerformSendInput): Promise<SendResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "unauthenticated", message: "Přihlaste se prosím." };
  }

  try {
    const conv = await getConversationById(input.conversationId);
    if (!conv) return NOT_FOUND;

    const participantUserIds = conv.participants.map((p) => p.userId);
    if (!canSendToConversation(actor, { participantUserIds })) return NOT_FOUND;

    const otherIds = participantUserIds.filter((id) => id !== actor.userId);

    // Blokace: v 1:1 je „other" jeden, ale počítáme obecně přes všechny protistrany.
    const blockPairs = await Promise.all(
      otherIds.map((id) => getBlockPair(actor.userId, id)),
    );
    if (blockPairs.some((b) => b.otherBlockedViewer)) {
      return { ok: false, error: "blocked", message: BLOCKED_SEND_MESSAGE };
    }
    if (blockPairs.some((b) => b.viewerBlockedOther)) {
      return { ok: false, error: "blocked", message: OUTGOING_BLOCK_MESSAGE };
    }

    // Dostupnost protistrany (zrušený / deaktivovaný účet).
    const facts = await getIdentityFacts(participantUserIds);
    const otherStatuses = otherIds.map((id) => facts.get(id)?.status ?? "deleted");
    const blockedReason = sendBlockReason(otherStatuses);
    if (blockedReason) {
      return { ok: false, error: "blocked", message: blockedReason };
    }

    if (input.replyToId) {
      const belongs = await messageBelongsToConversation(input.replyToId, conv.id);
      if (!belongs) {
        return {
          ok: false,
          error: "validation",
          message: "Odpovídaná zpráva nepatří do této konverzace.",
        };
      }
    }

    const { message, created } =
      input.attachments.length > 0
        ? await createMessageWithAttachments({
            conversationId: conv.id,
            senderUserId: actor.userId,
            content: input.content,
            clientToken: input.clientToken,
            replyToId: input.replyToId,
            attachments: input.attachments,
          })
        : await createMessage({
            conversationId: conv.id,
            senderUserId: actor.userId,
            content: input.content,
            clientToken: input.clientToken,
            replyToId: input.replyToId,
          });

    // Analytika bez obsahu zpráv (zadani/14 — pravidla). Jen nově vložená.
    if (created) {
      trackEvent("messaging.message_sent", {
        conversationId: conv.id,
        messageId: message.id,
      });
      if (input.attachments.length > 0) {
        trackEvent("messaging.attachment_sent", {
          conversationId: conv.id,
          messageId: message.id,
          count: input.attachments.length,
        });
      }
      // Notifikace příjemců (T032). Best-effort — `emit` nikdy nevyhodí, takže
      // selhání notifikace neshodí už uloženou zprávu.
      await notifyNewMessage(conv.id, actor.userId, participantUserIds);
    }

    // Přílohy nové zprávy do view (u opakovaného odeslání načte ty existující).
    const attachmentsMap = await attachmentsForMessages([message.id]);
    const attachmentViews = (attachmentsMap.get(message.id) ?? []).map(
      attachmentToView,
    );

    return {
      ok: true,
      message: toMessageView(message, actor.userId, facts, attachmentViews),
    };
  } catch {
    return {
      ok: false,
      error: "failed",
      message: "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.",
    };
  }
}
