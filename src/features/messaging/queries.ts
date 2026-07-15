import "server-only";

import { type AttachmentView } from "@/features/attachments/types";
import { toView as attachmentToView } from "@/lib/attachments";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění messagingu (access/send/start).
import { canAccessConversation, canSendToConversation } from "./permissions";
import { BLOCKED_SEND_MESSAGE, OUTGOING_BLOCK_MESSAGE, buildIdentity, sendBlockReason } from "./rules";
import {
  attachmentsForMessages,
  countUnreadForParticipant,
  getBlockPair,
  getConversationById,
  getIdentityFacts,
  getRecentMessages,
  type IdentityFactsRow,
  listBlockedUserIds,
  listBlocksByUser,
  type MessageWithReply,
  listInboxParticipations,
} from "./service";
import {
  type BlockedUserSummary,
  type ConversationContextView,
  type ConversationDetail,
  type ConversationSummary,
  type MessageView,
  type ParticipantIdentity,
  contextLabel,
  toPreview,
} from "./types";

/**
 * Čtecí vrstva messagingu (T030) pro stránky. Vynucuje viditelnost (číst smí jen
 * účastník — `canAccessConversation`) a sestavuje serializovatelné view modely
 * včetně placeholder identit (zrušený účet) a skrytých zpráv (T036 → placeholder).
 * Neexistenci a cizí konverzaci navenek nerozlišujeme (obojí → `null` → 404).
 */

type FactsMap = Map<string, IdentityFactsRow>;

/** Sestaví zobrazovanou identitu z předem načtených faktů (chybí → placeholder). */
function identityFrom(userId: string, facts: FactsMap): ParticipantIdentity {
  const f = facts.get(userId);
  if (!f) {
    return { userId, label: "Zrušený účet", href: null, deleted: true };
  }
  return buildIdentity({
    userId,
    status: f.status,
    email: f.email,
    headline: f.professionalProfile?.headline ?? null,
    slug: f.professionalProfile?.slug ?? null,
  });
}

/** Popisek kontextu pro hlavičku (`null` = přímá konverzace bez kontextu). */
function contextView(
  contextType: string | null,
): ConversationContextView | null {
  const label = contextLabel(contextType);
  return label && contextType ? { type: contextType, label } : null;
}

/** Sestaví view zprávy z DB řádku, předem načtených identit a příloh (sdílené s akcemi). */
export function toMessageView(
  m: MessageWithReply,
  viewerUserId: string,
  facts: FactsMap,
  attachments: AttachmentView[] = [],
): MessageView {
  const hidden = m.moderationState !== "visible";
  const replyTo = m.replyTo
    ? {
        id: m.replyTo.id,
        authorLabel: identityFrom(m.replyTo.senderUserId, facts).label,
        excerpt:
          m.replyTo.moderationState === "visible"
            ? toPreview(m.replyTo.content, 80)
            : "Skrytá zpráva",
      }
    : null;

  return {
    id: m.id,
    conversationId: m.conversationId,
    // Obsah skryté zprávy se nikdy neposílá do klienta (T036).
    content: hidden ? null : m.content,
    hidden,
    sender: identityFrom(m.senderUserId, facts),
    mine: m.senderUserId === viewerUserId,
    createdAt: m.createdAt.toISOString(),
    clientToken: m.clientToken,
    replyTo,
    // Přílohy skryté zprávy se nezobrazují (moderační skrytí zakrývá i obsah).
    attachments: hidden ? [] : attachments,
  };
}

/**
 * Inbox přihlášeného uživatele: konverzace seřazené podle poslední zprávy, s
 * náhledem poslední (viditelné) zprávy a počítadlem nepřečtených. Archivované
 * konverzace se nevrací (`listInboxParticipations`).
 */
export async function getInbox(): Promise<ConversationSummary[]> {
  const actor = await getActor();
  if (actor.kind !== "user") return [];

  const [participations, blockedIds] = await Promise.all([
    listInboxParticipations(actor.userId),
    listBlockedUserIds(actor.userId),
  ]);

  // Konverzace s protistranou, kterou divák zablokoval, se v aktivním inboxu
  // nezobrazuje (T031 § Main flow bod 2 — blokující ji nevidí).
  const visible = participations.filter((p) => {
    const other = p.conversation.participants.find(
      (pp) => pp.userId !== actor.userId,
    );
    return !(other && blockedIds.has(other.userId));
  });

  const otherIds = [
    ...new Set(
      visible
        .flatMap((p) => p.conversation.participants.map((pp) => pp.userId))
        .filter((id) => id !== actor.userId),
    ),
  ];
  const facts = await getIdentityFacts(otherIds);

  return Promise.all(
    visible.map(async (p): Promise<ConversationSummary> => {
      const conv = p.conversation;
      const otherPart = conv.participants.find(
        (pp) => pp.userId !== actor.userId,
      );
      const last = conv.messages[0] ?? null;
      const unreadCount = await countUnreadForParticipant(
        conv.id,
        actor.userId,
        p.lastReadAt,
      );
      return {
        id: conv.id,
        other: identityFrom(otherPart?.userId ?? "", facts),
        context: contextView(conv.contextType),
        // Prázdný obsah = zpráva jen s přílohou → náhled „Příloha".
        lastMessagePreview: last ? toPreview(last.content) || "Příloha" : null,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
        unreadCount,
        archived: p.archivedAt !== null,
      };
    }),
  );
}

/**
 * Detail konverzace pro vlákno. Vrací `null`, pokud neexistuje NEBO divák není
 * účastník (nerozlišujeme — nepotvrzujeme existenci cizí konverzace). Součástí je
 * i rozhodnutí, zda smí divák psát (`canSend` + `blockedReason` u nedostupné
 * protistrany).
 */
export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetail | null> {
  const actor = await getActor();
  if (actor.kind !== "user") return null;

  const conv = await getConversationById(conversationId);
  if (!conv) return null;

  const participantUserIds = conv.participants.map((p) => p.userId);
  if (!canAccessConversation(actor, { participantUserIds })) return null;

  const facts = await getIdentityFacts(participantUserIds);
  const otherIds = participantUserIds.filter((id) => id !== actor.userId);
  const other = identityFrom(otherIds[0] ?? "", facts);

  const { messages, hasMoreOlder } = await getRecentMessages(conversationId);

  // Přílohy všech zobrazených zpráv jedním dotazem (batch), pak per zpráva do view.
  const attachmentsMap = await attachmentsForMessages(messages.map((m) => m.id));
  const messageViews = messages.map((m) =>
    toMessageView(
      m,
      actor.userId,
      facts,
      (attachmentsMap.get(m.id) ?? []).map(attachmentToView),
    ),
  );

  // Blokace mezi divákem a protistranou (v 1:1 je „other" jeden).
  const otherId = otherIds[0];
  const block = otherId
    ? await getBlockPair(actor.userId, otherId)
    : { viewerBlockedOther: false, otherBlockedViewer: false };

  const otherStatuses = otherIds.map((id) => facts.get(id)?.status ?? "deleted");
  const availabilityReason = sendBlockReason(otherStatuses);

  // Priorita hlášek: nedostupný účet > blokace odesílatele > vlastní blokace.
  const blockedReason = availabilityReason
    ? availabilityReason
    : block.otherBlockedViewer
      ? BLOCKED_SEND_MESSAGE
      : block.viewerBlockedOther
        ? OUTGOING_BLOCK_MESSAGE
        : null;

  const canSend =
    canSendToConversation(actor, { participantUserIds }) &&
    blockedReason === null;

  return {
    id: conv.id,
    viewerUserId: actor.userId,
    other,
    context: contextView(conv.contextType),
    messages: messageViews,
    hasMoreOlder,
    canSend,
    blockedReason,
    blockedByMe: block.viewerBlockedOther,
  };
}

/**
 * Seznam uživatelů, které přihlášený zablokoval (pro nastavení — T031). Odblokování
 * je vratná akce. Popisky se skládají stejně jako identity ve vlákně (titulek
 * profilu / handle / „Zrušený účet").
 */
export async function getBlockedUsers(): Promise<BlockedUserSummary[]> {
  const actor = await getActor();
  if (actor.kind !== "user") return [];

  const blocks = await listBlocksByUser(actor.userId);
  const facts = await getIdentityFacts(blocks.map((b) => b.blockedUserId));

  return blocks.map((b) => ({
    userId: b.blockedUserId,
    label: identityFrom(b.blockedUserId, facts).label,
    blockedAt: b.createdAt.toISOString(),
  }));
}
