import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getStorage } from "@/features/attachments/storage";
import type { AllowedMimeType } from "@/features/attachments/types";
import { buildDedupeKey } from "./rules";
import {
  type ConversationContext,
  MESSAGE_ATTACHMENT_CONTEXT_TYPE,
  MESSAGES_PAGE_SIZE,
} from "./types";

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

/** Připravená příloha k odeslání se zprávou (bajty už zvalidované + sanitizované). */
export type PreparedAttachment = {
  bytes: Buffer;
  mime: AllowedMimeType;
  fileName: string;
};

/**
 * Vloží zprávu SPOLU s přílohami atomicky (T031 § Alternative flows — zpráva s
 * přílohou je atomická). Nejprve uloží soubory do storage (mimo transakci), pak
 * v jedné DB transakci založí zprávu i `Attachment` řádky (kontext `message` +
 * ID zprávy, viditelnost `shared_in_context`). Selže-li transakce, uklidí právě
 * uložené bloby a chybu propaguje — nevznikne ani osiřelá příloha, ani polovičatá
 * zpráva. Idempotence přes `clientToken`: opakované odeslání vrátí PŮVODNÍ zprávu
 * (i s jejími přílohami) a nové soubory nepřidává.
 */
export async function createMessageWithAttachments(
  input: CreateMessageInput & { attachments: PreparedAttachment[] },
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

  // Soubory ulož předem; klíče si drž pro úklid při selhání transakce.
  const stored = await Promise.all(
    input.attachments.map(async (a) => {
      const storageKey = `${randomUUID()}/file`;
      await getStorage().put(storageKey, a.bytes, a.mime);
      return { ...a, storageKey };
    }),
  );

  try {
    const message = await db.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderUserId: input.senderUserId,
          content: input.content,
          clientToken: input.clientToken,
          replyToId: input.replyToId,
        },
        ...messageWithReply,
      });

      if (stored.length > 0) {
        await tx.attachment.createMany({
          data: stored.map((s) => ({
            ownerUserId: input.senderUserId,
            contextType: MESSAGE_ATTACHMENT_CONTEXT_TYPE,
            contextId: created.id,
            storageKey: s.storageKey,
            mimeType: s.mime,
            fileName: s.fileName,
            byteSize: s.bytes.byteLength,
            visibility: "shared_in_context",
          })),
        });
      }

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      await tx.conversationParticipant.updateMany({
        where: {
          conversationId: input.conversationId,
          userId: input.senderUserId,
        },
        data: { lastReadAt: created.createdAt },
      });

      return created;
    });

    return { message, created: true };
  } catch (error) {
    // Úklid uložených blobů, ať po selhání nezůstanou osiřelé soubory.
    await Promise.allSettled(
      stored.map((s) => getStorage().delete(s.storageKey)),
    );
    // Souběžný duplikát (stejný clientToken) → vrať existující zprávu.
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

/**
 * Aktivní i smazané přílohy pro sadu zpráv (kontext `message`), seskupené podle
 * `contextId` (= ID zprávy). Smazané se vrací také — konzument z nich vykreslí
 * placeholder (T023 § Edge cases). Nejstarší první (pořadí přiložení).
 */
export async function attachmentsForMessages(
  messageIds: string[],
): Promise<Map<string, AttachmentRowForMessage[]>> {
  const map = new Map<string, AttachmentRowForMessage[]>();
  if (messageIds.length === 0) return map;

  const rows = await db.attachment.findMany({
    where: {
      contextType: MESSAGE_ATTACHMENT_CONTEXT_TYPE,
      contextId: { in: messageIds },
    },
    orderBy: { createdAt: "asc" },
  });
  for (const row of rows) {
    const list = map.get(row.contextId) ?? [];
    list.push(row);
    map.set(row.contextId, list);
  }
  return map;
}

export type AttachmentRowForMessage = Awaited<
  ReturnType<typeof db.attachment.findMany>
>[number];

/**
 * Zpráva pro moderační akci (T031 report): odesílatel + účastníci její konverzace.
 * `null`, pokud zpráva neexistuje. Umožní ověřit, že reporter je účastník a že
 * nenahlašuje vlastní zprávu — bez odhalení cizí konverzace.
 */
export async function getMessageForModeration(
  messageId: string,
): Promise<{
  senderUserId: string;
  conversationId: string;
  participantUserIds: string[];
} | null> {
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: {
      senderUserId: true,
      conversationId: true,
      conversation: { select: { participants: { select: { userId: true } } } },
    },
  });
  if (!message) return null;
  return {
    senderUserId: message.senderUserId,
    conversationId: message.conversationId,
    participantUserIds: message.conversation.participants.map((p) => p.userId),
  };
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

// --- Blokace (T031) ---------------------------------------------------------

/** Zablokuje `blocked` uživatelem `blocker` (idempotentní — dvojice je unikát). */
export async function createBlock(
  blockerUserId: string,
  blockedUserId: string,
): Promise<void> {
  await db.block.upsert({
    where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
    create: { blockerUserId, blockedUserId },
    update: {},
  });
}

/** Odblokuje (smaže řádek). Idempotentní — neexistující blokace nevadí. */
export async function removeBlock(
  blockerUserId: string,
  blockedUserId: string,
): Promise<void> {
  await db.block.deleteMany({ where: { blockerUserId, blockedUserId } });
}

/**
 * Blokační vztah mezi dvojicí (obousměrně) v jednom dotazu. Vrací, zda `viewer`
 * blokuje `other` a zda `other` blokuje `viewer` — z toho se odvodí, kdo smí psát.
 */
export async function getBlockPair(
  viewerUserId: string,
  otherUserId: string,
): Promise<{ viewerBlockedOther: boolean; otherBlockedViewer: boolean }> {
  const rows = await db.block.findMany({
    where: {
      OR: [
        { blockerUserId: viewerUserId, blockedUserId: otherUserId },
        { blockerUserId: otherUserId, blockedUserId: viewerUserId },
      ],
    },
    select: { blockerUserId: true },
  });
  return {
    viewerBlockedOther: rows.some((r) => r.blockerUserId === viewerUserId),
    otherBlockedViewer: rows.some((r) => r.blockerUserId === otherUserId),
  };
}

/** Množina userId, které `viewer` zablokoval (pro filtr inboxu). */
export async function listBlockedUserIds(
  viewerUserId: string,
): Promise<Set<string>> {
  const rows = await db.block.findMany({
    where: { blockerUserId: viewerUserId },
    select: { blockedUserId: true },
  });
  return new Set(rows.map((r) => r.blockedUserId));
}

/** Blokace založené uživatelem (pro nastavení), nejnovější první. */
export function listBlocksByUser(
  blockerUserId: string,
): Promise<{ blockedUserId: string; createdAt: Date }[]> {
  return db.block.findMany({
    where: { blockerUserId },
    orderBy: { createdAt: "desc" },
    select: { blockedUserId: true, createdAt: true },
  });
}
