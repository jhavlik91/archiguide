import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildDedupeKey } from "./rules";
import { type ConversationContext, MESSAGES_PAGE_SIZE } from "./types";

/**
 * Datová vrstva messagingu (T030). Jediné místo, které sahá na `db.conversation`,
 * `db.conversationParticipant` a `db.message`. Drží invarianty: konverzace se
 * neduplikuje (unikátní `dedupeKey`), odeslání je idempotentní (unikátní
 * `conversationId + clientToken`), `lastMessageAt` se udržuje pro řazení inboxu.
 * Oprávnění (kdo smí akci provést) řeší queries/actions přes permission vrstvu.
 */

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const conversationWithParticipants = {
  include: { participants: true },
} satisfies Prisma.ConversationDefaultArgs;

export type ConversationWithParticipants = Prisma.ConversationGetPayload<
  typeof conversationWithParticipants
>;

/**
 * Najde existující konverzaci stejné dvojice ve stejném kontextu, nebo ji založí
 * (T030 § Main flow bod 2). Znovupoužití hlídá unikátní `dedupeKey`; při souběhu
 * prohrávající zápis (P2002) skončí opětovným načtením — nikdy nevzniknou dvě
 * konverzace. `created` odliší nově založenou (pro analytiku `conversation_started`).
 */
export async function findOrCreateConversation(params: {
  context: ConversationContext | null;
  participantUserIds: string[];
}): Promise<{ conversation: ConversationWithParticipants; created: boolean }> {
  const dedupeKey = buildDedupeKey(params.context, params.participantUserIds);

  const existing = await db.conversation.findUnique({
    where: { dedupeKey },
    ...conversationWithParticipants,
  });
  if (existing) return { conversation: existing, created: false };

  try {
    const conversation = await db.conversation.create({
      data: {
        dedupeKey,
        contextType: params.context?.type ?? null,
        contextId: params.context?.id ?? null,
        participants: {
          create: params.participantUserIds.map((userId) => ({ userId })),
        },
      },
      ...conversationWithParticipants,
    });
    return { conversation, created: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await db.conversation.findUnique({
        where: { dedupeKey },
        ...conversationWithParticipants,
      });
      if (raced) return { conversation: raced, created: false };
    }
    throw error;
  }
}

/** Konverzace včetně účastníků podle ID (bez ohledu na oprávnění — to řeší volající). */
export function getConversationById(
  conversationId: string,
): Promise<ConversationWithParticipants | null> {
  return db.conversation.findUnique({
    where: { id: conversationId },
    ...conversationWithParticipants,
  });
}

const messageWithReply = {
  include: {
    replyTo: {
      select: {
        id: true,
        content: true,
        senderUserId: true,
        moderationState: true,
      },
    },
  },
} satisfies Prisma.MessageDefaultArgs;

export type MessageWithReply = Prisma.MessageGetPayload<typeof messageWithReply>;

/**
 * Nejnovější stránka zpráv konverzace ve vzestupném pořadí (nejstarší nahoře pro
 * vykreslení vlákna) + příznak, jestli existují starší zprávy nad rámec stránky.
 * Skryté zprávy (T036) se vrací také — konzument místo obsahu vykreslí placeholder.
 */
export async function getRecentMessages(
  conversationId: string,
): Promise<{ messages: MessageWithReply[]; hasMoreOlder: boolean }> {
  const rows = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_PAGE_SIZE + 1,
    ...messageWithReply,
  });
  const hasMoreOlder = rows.length > MESSAGES_PAGE_SIZE;
  const page = hasMoreOlder ? rows.slice(0, MESSAGES_PAGE_SIZE) : rows;
  return { messages: page.reverse(), hasMoreOlder };
}

export type CreateMessageInput = {
  conversationId: string;
  senderUserId: string;
  content: string;
  clientToken: string;
  replyToId?: string;
};

/**
 * Vloží zprávu idempotentně (T030 § Edge cases — double-click). Opakované
 * odeslání téhož `clientToken` v rámci konverzace vrátí PŮVODNÍ zprávu místo
 * duplikátu (unikát `conversationId + clientToken`). Po vložení posune
 * `lastMessageAt` konverzace a označí odesílateli konverzaci jako přečtenou
 * (vlastní zprávu má implicitně přečtenou).
 */
export async function createMessage(
  input: CreateMessageInput,
): Promise<{ message: MessageWithReply; created: boolean }> {
  const existing = await db.message.findUnique({
    where: {
      conversationId_clientToken: {
        conversationId: input.conversationId,
        clientToken: input.clientToken,
      },
    },
    ...messageWithReply,
  });
  if (existing) return { message: existing, created: false };

  try {
    const message = await db.message.create({
      data: {
        conversationId: input.conversationId,
        senderUserId: input.senderUserId,
        content: input.content,
        clientToken: input.clientToken,
        replyToId: input.replyToId,
      },
      ...messageWithReply,
    });

    await db.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await db.conversationParticipant.updateMany({
      where: {
        conversationId: input.conversationId,
        userId: input.senderUserId,
      },
      data: { lastReadAt: message.createdAt },
    });

    return { message, created: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await db.message.findUnique({
        where: {
          conversationId_clientToken: {
            conversationId: input.conversationId,
            clientToken: input.clientToken,
          },
        },
        ...messageWithReply,
      });
      if (raced) return { message: raced, created: false };
    }
    throw error;
  }
}

/** Ověří, že zpráva patří do dané konverzace (guard pro reply reference). */
export async function messageBelongsToConversation(
  messageId: string,
  conversationId: string,
): Promise<boolean> {
  const found = await db.message.findFirst({
    where: { id: messageId, conversationId },
    select: { id: true },
  });
  return found !== null;
}

/** Konverzace uživatele pro inbox (nejnovější zprávou nahoře). Bez archivovaných. */
export function listInboxParticipations(userId: string) {
  return db.conversationParticipant.findMany({
    where: { userId, archivedAt: null },
    include: {
      conversation: {
        include: {
          participants: true,
          messages: {
            where: { moderationState: "visible" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: { sort: "desc", nulls: "last" } } },
  });
}

export type InboxParticipation = Awaited<
  ReturnType<typeof listInboxParticipations>
>[number];

/** Počet nepřečtených zpráv konverzace pro daného účastníka (viditelné, cizí). */
export function countUnreadForParticipant(
  conversationId: string,
  userId: string,
  lastReadAt: Date | null,
): Promise<number> {
  return db.message.count({
    where: {
      conversationId,
      moderationState: "visible",
      senderUserId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

/** Označí konverzaci jako přečtenou k aktuálnímu času (per-účastník). */
export async function markRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  await db.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
}

/** Nastaví/zruší archivaci konverzace pro daného účastníka (per-účastník stav). */
export async function setArchived(
  conversationId: string,
  userId: string,
  archived: boolean,
): Promise<void> {
  await db.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export type IdentityFactsRow = {
  id: string;
  status: string;
  email: string;
  professionalProfile: { headline: string | null; slug: string | null } | null;
};

/** Identita uživatele pro zobrazení (batch). Vrací mapu userId → fakta. */
export async function getIdentityFacts(
  userIds: string[],
): Promise<Map<string, IdentityFactsRow>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      status: true,
      email: true,
      professionalProfile: { select: { headline: true, slug: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        status: r.status,
        email: r.email,
        professionalProfile: r.professionalProfile,
      },
    ]),
  );
}

/** Existuje aktivní příjemce (pro zahájení konverzace)? Vrací jeho stav účtu. */
export function getUserStatus(
  userId: string,
): Promise<{ id: string; status: string } | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
}
