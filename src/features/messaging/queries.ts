import "server-only";

import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění messagingu (access/send/start).
import { canAccessConversation, canSendToConversation } from "./permissions";
import { buildIdentity, sendBlockReason } from "./rules";
import {
  countUnreadForParticipant,
  getConversationById,
  getIdentityFacts,
  getRecentMessages,
  type IdentityFactsRow,
  type MessageWithReply,
  listInboxParticipations,
} from "./service";
import {
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

/** Sestaví view zprávy z DB řádku a předem načtených identit (sdílené s akcemi). */
export function toMessageView(
  m: MessageWithReply,
  viewerUserId: string,
  facts: FactsMap,
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

  const participations = await listInboxParticipations(actor.userId);

  const otherIds = [
    ...new Set(
      participations
        .flatMap((p) => p.conversation.participants.map((pp) => pp.userId))
        .filter((id) => id !== actor.userId),
    ),
  ];
  const facts = await getIdentityFacts(otherIds);

  return Promise.all(
    participations.map(async (p): Promise<ConversationSummary> => {
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
        lastMessagePreview: last ? toPreview(last.content) : null,
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
  const messageViews = messages.map((m) =>
    toMessageView(m, actor.userId, facts),
  );

  const otherStatuses = otherIds.map((id) => facts.get(id)?.status ?? "deleted");
  const blockedReason = sendBlockReason(otherStatuses);
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
  };
}
