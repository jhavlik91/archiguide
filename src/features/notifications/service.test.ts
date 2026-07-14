import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOrBumpNotification,
  markAllRead,
  markRead,
} from "./service";

/**
 * Integrační test datové vrstvy notifikací (T032) nad in-memory mockem DB.
 * Ověřuje klíčový invariant deduplikace: dokud je notifikace nepřečtená, opakovaný
 * emit se stejným klíčem jen zvýší počet (žádný duplikát); po přečtení vznikne nová.
 */

type Notif = {
  id: string;
  recipientUserId: string;
  eventType: string;
  priority: string;
  state: string;
  title: string;
  reason: string;
  linkPath: string;
  contextType: string | null;
  contextId: string | null;
  dedupeKey: string;
  count: number;
  readAt: Date | null;
  lastEventAt: Date;
  createdAt: Date;
};

let store: Notif[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findFirst: ({
        where,
      }: {
        where: { recipientUserId: string; dedupeKey: string; state: string };
      }) =>
        Promise.resolve(
          store.find(
            (n) =>
              n.recipientUserId === where.recipientUserId &&
              n.dedupeKey === where.dedupeKey &&
              n.state === where.state,
          ) ?? null,
        ),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const n: Notif = {
          id: `notif_${store.length + 1}`,
          recipientUserId: data.recipientUserId as string,
          eventType: data.eventType as string,
          priority: (data.priority as string) ?? "normal",
          state: "unread",
          title: data.title as string,
          reason: data.reason as string,
          linkPath: data.linkPath as string,
          contextType: (data.contextType as string) ?? null,
          contextId: (data.contextId as string) ?? null,
          dedupeKey: data.dedupeKey as string,
          count: 1,
          readAt: null,
          lastEventAt: new Date(),
          createdAt: new Date(),
        };
        store.push(n);
        return Promise.resolve(n);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          count?: { increment: number };
          lastEventAt?: Date;
          priority?: string;
          title?: string;
          reason?: string;
          linkPath?: string;
        };
      }) => {
        const n = store.find((x) => x.id === where.id)!;
        if (data.count) n.count += data.count.increment;
        if (data.lastEventAt) n.lastEventAt = data.lastEventAt;
        if (data.priority) n.priority = data.priority;
        if (data.title) n.title = data.title;
        if (data.reason) n.reason = data.reason;
        if (data.linkPath) n.linkPath = data.linkPath;
        return Promise.resolve(n);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id?: string; recipientUserId: string; state: string };
        data: { state: string; readAt: Date };
      }) => {
        const matched = store.filter(
          (n) =>
            n.recipientUserId === where.recipientUserId &&
            n.state === where.state &&
            (where.id === undefined || n.id === where.id),
        );
        for (const n of matched) {
          n.state = data.state;
          n.readAt = data.readAt;
        }
        return Promise.resolve({ count: matched.length });
      },
    },
  },
}));

afterEach(() => {
  store = [];
});

const base = {
  recipientUserId: "u1",
  eventType: "new_message",
  priority: "normal" as const,
  title: "Nová zpráva",
  reason: "…",
  linkPath: "/messages/c1",
  context: { type: "conversation", id: "c1" },
  dedupeKey: "new_message:c1",
};

describe("createOrBumpNotification (deduplikace)", () => {
  it("5 rychlých emitů se stejným klíčem = 1 nepřečtená notifikace s počtem 5", async () => {
    let last;
    for (let i = 0; i < 5; i++) {
      last = await createOrBumpNotification(base);
    }
    expect(store).toHaveLength(1);
    expect(store[0]!.count).toBe(5);
    expect(last!.created).toBe(false);
  });

  it("po přečtení vznikne nová notifikace (okno = dokud nepřečteno)", async () => {
    const first = await createOrBumpNotification(base);
    expect(first.created).toBe(true);
    await markRead(first.notification.id, "u1");

    const second = await createOrBumpNotification(base);
    expect(second.created).toBe(true);
    expect(store).toHaveLength(2);
  });

  it("bump nesnižuje prioritu, ale zvýší ji", async () => {
    await createOrBumpNotification({ ...base, priority: "low" });
    const bumped = await createOrBumpNotification({ ...base, priority: "urgent" });
    expect(bumped.notification.priority).toBe("urgent");
    // Zpět na nižší už prioritu nesníží.
    const again = await createOrBumpNotification({ ...base, priority: "low" });
    expect(again.notification.priority).toBe("urgent");
  });

  it("jiný příjemce = samostatná notifikace", async () => {
    await createOrBumpNotification(base);
    await createOrBumpNotification({ ...base, recipientUserId: "u2" });
    expect(store).toHaveLength(2);
  });
});

describe("markRead / markAllRead", () => {
  it("markRead cizí notifikaci neoznačí (filtr na příjemce)", async () => {
    const { notification } = await createOrBumpNotification(base);
    const changed = await markRead(notification.id, "someone_else");
    expect(changed).toBe(0);
    expect(store[0]!.state).toBe("unread");
  });

  it("markAllRead označí jen nepřečtené daného příjemce", async () => {
    await createOrBumpNotification({ ...base, dedupeKey: "a" });
    await createOrBumpNotification({ ...base, dedupeKey: "b" });
    await createOrBumpNotification({ ...base, recipientUserId: "u2", dedupeKey: "c" });
    const count = await markAllRead("u1");
    expect(count).toBe(2);
    expect(store.filter((n) => n.state === "unread")).toHaveLength(1);
  });
});
