import "server-only";

import { registerContextResolver } from "@/lib/attachments";
import { type Actor, isUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { MESSAGE_ATTACHMENT_CONTEXT_TYPE } from "./types";

/**
 * Seam mezi messagingem (T031) a attachment systémem (T023): registruje resolver
 * pro kontext `message`. Attachment systém tak umí odpovědět, zda příloha zprávy
 * existuje a zda je actor účastníkem její konverzace — na tom stojí přístup k
 * `shared_in_context` příloze (stažení přes `/api/attachments/[id]` i výpis ve
 * vlákně). Bez tohoto resolveru je kontext neznámý → fail-closed (nikdo kromě
 * vlastníka přílohu nevidí).
 *
 * Registrace je side-effect importu; zavádí ji `instrumentation.ts` při startu
 * serveru, aby ji znaly i routy, které messaging jinak neimportují (serve route
 * příloh). Import je idempotentní (přeregistrace téhož typu je HMR-safe).
 */
registerContextResolver(
  MESSAGE_ATTACHMENT_CONTEXT_TYPE,
  async (messageId: string, actor: Actor) => {
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        conversation: {
          select: { participants: { select: { userId: true } } },
        },
      },
    });
    if (!message) return { exists: false, isParticipant: false };

    const isParticipant =
      isUser(actor) &&
      message.conversation.participants.some((p) => p.userId === actor.userId);
    return { exists: true, isParticipant };
  },
);
