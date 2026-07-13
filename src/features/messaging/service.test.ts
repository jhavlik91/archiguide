import { afterEach, describe, expect, it, vi } from "vitest";
import { createMessage, findOrCreateConversation } from "./service";

/**
 * Integrační test datové vrstvy messagingu (T030) nad in-memory mockem DB.
 * Pokrývá dva klíčové invarianty:
 *  - konverzace stejné dvojice ve stejném kontextu se NEDUPLIKUJE (dedupeKey),
 *  - odeslání je idempotentní přes `clientToken` (double-click → jedna zpráva).
 */

type Conv = {
  id: string;
  dedupeKey: string;
  contextType: string | null;
  contextId: string | null;
  lastMessageAt: Date | null;
  participants: { id: string; userId: string; conversationId: string }[];
};

type Msg = {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  clientToken: string;
  replyToId: string | null;
  moderationState: string;
  createdAt: Date;
  replyTo: null;
};

let convs: Conv[] = [];
let msgs: Msg[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    conversation: {
      findUnique: ({ where }: { where: { dedupeKey?: string; id?: string } }) =>
        Promise.resolve(
          convs.find(
            (c) =>
              (where.dedupeKey && c.dedupeKey === where.dedupeKey) ||
              (where.id && c.id === where.id),
          ) ?? null,
        ),
      create: ({
        data,
      }: {
        data: {
          dedupeKey: string;
          contextType: string | null;
          contextId: string | null;
          participants: { create: { userId: string }[] };
        };
      }) => {
        const id = `conv_${convs.length + 1}`;
        const conv: Conv = {
          id,
          dedupeKey: data.dedupeKey,
          contextType: data.contextType,
          contextId: data.contextId,
          lastMessageAt: null,
          participants: data.participants.create.map((p, i) => ({
            id: `${id}_p${i}`,
            userId: p.userId,
            conversationId: id,
          })),
        };
        convs.push(conv);
        return Promise.resolve(conv);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { lastMessageAt: Date };
      }) => {
        const c = convs.find((x) => x.id === where.id);
        if (c) c.lastMessageAt = data.lastMessageAt;
        return Promise.resolve(c);
      },
    },
    message: {
      findUnique: ({
        where,
      }: {
        where: { conversationId_clientToken: { conversationId: string; clientToken: string } };
      }) => {
        const key = where.conversationId_clientToken;
        return Promise.resolve(
          msgs.find(
            (m) =>
              m.conversationId === key.conversationId &&
              m.clientToken === key.clientToken,
          ) ?? null,
        );
      },
      create: ({
        data,
      }: {
        data: {
          conversationId: string;
          senderUserId: string;
          content: string;
          clientToken: string;
          replyToId?: string;
        };
      }) => {
        // Vynucení unikátu (conversationId, clientToken) jako v DB.
        if (
          msgs.some(
            (m) =>
              m.conversationId === data.conversationId &&
              m.clientToken === data.clientToken,
          )
        ) {
          const err = Object.assign(new Error("Unique"), { code: "P2002" });
          throw err;
        }
        const msg: Msg = {
          id: `msg_${msgs.length + 1}`,
          conversationId: data.conversationId,
          senderUserId: data.senderUserId,
          content: data.content,
          clientToken: data.clientToken,
          replyToId: data.replyToId ?? null,
          moderationState: "visible",
          createdAt: new Date(),
          replyTo: null,
        };
        msgs.push(msg);
        return Promise.resolve(msg);
      },
    },
    conversationParticipant: {
      updateMany: () => Promise.resolve({ count: 1 }),
    },
  },
}));

// P2002 detekce v service porovnává instanceof Prisma.PrismaClientKnownRequestError;
// pro test stačí, aby create nikdy nespadl duplicitně (findUnique-first ho předběhne).
vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

afterEach(() => {
  convs = [];
  msgs = [];
});

describe("findOrCreateConversation", () => {
  it("stejná dvojice ve stejném kontextu se znovupoužije (žádný duplikát)", async () => {
    const context = { type: "request", id: "r1" };
    const first = await findOrCreateConversation({
      context,
      participantUserIds: ["a", "b"],
    });
    expect(first.created).toBe(true);

    // Opačné pořadí účastníků → stále tatáž konverzace.
    const second = await findOrCreateConversation({
      context,
      participantUserIds: ["b", "a"],
    });
    expect(second.created).toBe(false);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(convs).toHaveLength(1);
  });

  it("jiný kontext = jiná konverzace", async () => {
    await findOrCreateConversation({
      context: { type: "request", id: "r1" },
      participantUserIds: ["a", "b"],
    });
    const other = await findOrCreateConversation({
      context: { type: "request", id: "r2" },
      participantUserIds: ["a", "b"],
    });
    expect(other.created).toBe(true);
    expect(convs).toHaveLength(2);
  });
});

describe("createMessage", () => {
  it("stejný clientToken nevytvoří duplikát (double-click)", async () => {
    const { conversation } = await findOrCreateConversation({
      context: null,
      participantUserIds: ["a", "b"],
    });

    const token = "tok-1";
    const first = await createMessage({
      conversationId: conversation.id,
      senderUserId: "a",
      content: "ahoj",
      clientToken: token,
    });
    const second = await createMessage({
      conversationId: conversation.id,
      senderUserId: "a",
      content: "ahoj",
      clientToken: token,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.message.id).toBe(first.message.id);
    expect(msgs).toHaveLength(1);
  });

  it("posune lastMessageAt konverzace po odeslání", async () => {
    const { conversation } = await findOrCreateConversation({
      context: null,
      participantUserIds: ["a", "b"],
    });
    await createMessage({
      conversationId: conversation.id,
      senderUserId: "a",
      content: "ahoj",
      clientToken: "tok-2",
    });
    expect(convs[0]!.lastMessageAt).not.toBeNull();
  });
});
