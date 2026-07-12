import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import type { AttachmentVisibility } from "./types";

/**
 * Integrační test sdílené přístupové vrstvy (T023): `attach` + `canAccess` nad
 * in-memory storage a zmockovanou DB. Pokrývá akceptační kritéria:
 *  - nová příloha je vždy `private`,
 *  - přiložení do neexistujícího / cizího kontextu se odmítne,
 *  - `canAccess` respektuje viditelnost × účastnictví a smazanou přílohu nevydá.
 */

type Row = {
  id: string;
  ownerUserId: string;
  contextType: string;
  contextId: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
  byteSize: number;
  visibility: string;
  sensitive: boolean;
  metadata: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

let store: Row[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    attachment: {
      create: ({ data }: { data: Partial<Row> }) => {
        const row = { ...(data as Row) };
        row.id ??= `att_${store.length + 1}`;
        row.status ??= "active";
        row.createdAt ??= new Date();
        row.updatedAt ??= new Date();
        if (row.metadata === undefined) row.metadata = null;
        store.push(row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(store.find((r) => r.id === where.id) ?? null),
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; status?: string };
        data: Partial<Row>;
      }) => {
        let count = 0;
        for (const r of store) {
          if (
            r.id === where.id &&
            (!where.status || r.status === where.status)
          ) {
            Object.assign(r, data);
            count++;
          }
        }
        return Promise.resolve({ count });
      },
    },
  },
}));

let currentActor: Actor = VISITOR;
vi.mock("@/lib/session", () => ({
  getActor: () => Promise.resolve(currentActor),
}));

import { __setStorageForTests, type AttachmentStorage } from "./storage";
import { attach, canAccess } from "./access";
import { __resetResolversForTests, registerContextResolver } from "./registry";

const files = new Map<string, Buffer>();
const memStorage: AttachmentStorage = {
  put: (k, d) => {
    files.set(k, d);
    return Promise.resolve();
  },
  get: (k) => Promise.resolve(files.get(k) ?? null),
  delete: (k) => {
    files.delete(k);
    return Promise.resolve();
  },
};

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

const user: Actor = {
  kind: "user",
  userId: "u1",
  roles: ["client"],
  activeContext: "client",
};
const other: Actor = {
  kind: "user",
  userId: "u2",
  roles: ["professional"],
  activeContext: "professional",
};

beforeEach(() => {
  store = [];
  files.clear();
  __setStorageForTests(memStorage);
  __resetResolversForTests();
  currentActor = user;
  // Kontext `brief`: existuje jen `b1`; účastníci jsou u1 a u2.
  registerContextResolver("brief", async (id, actor) => ({
    exists: id === "b1",
    isParticipant:
      actor.kind === "user" && (actor.userId === "u1" || actor.userId === "u2"),
  }));
});

afterEach(() => {
  __setStorageForTests(undefined);
  __resetResolversForTests();
});

describe("attach", () => {
  it("nová příloha je vždy private a soubor je ve storage", async () => {
    const res = await attach(
      { type: "brief", id: "b1" },
      { bytes: PDF, fileName: "x.pdf" },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.attachment.visibility).toBe("private");
    expect(res.attachment.ownerUserId).toBe("u1");
    expect(files.get(res.attachment.storageKey)).toEqual(PDF);
  });

  it("nepřihlášený nemůže přikládat", async () => {
    currentActor = VISITOR;
    const res = await attach(
      { type: "brief", id: "b1" },
      { bytes: PDF, fileName: "x.pdf" },
    );
    expect(res).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("neexistující kontext → unknown_context (a žádný záznam ani soubor)", async () => {
    const res = await attach(
      { type: "brief", id: "nope" },
      { bytes: PDF, fileName: "x.pdf" },
    );
    expect(res).toEqual({ ok: false, error: "unknown_context" });
    expect(store).toHaveLength(0);
    expect(files.size).toBe(0);
  });

  it("neúčastník kontextu → forbidden", async () => {
    currentActor = {
      kind: "user",
      userId: "u3",
      roles: ["client"],
      activeContext: "client",
    };
    const res = await attach(
      { type: "brief", id: "b1" },
      { bytes: PDF, fileName: "x.pdf" },
    );
    expect(res).toEqual({ ok: false, error: "forbidden" });
  });

  it("nepodporovaný typ → unsupported_type", async () => {
    const res = await attach(
      { type: "brief", id: "b1" },
      { bytes: Buffer.from([0x00, 0x01]), fileName: "x.bin" },
    );
    expect(res).toEqual({ ok: false, error: "unsupported_type" });
  });
});

describe("canAccess", () => {
  async function makeAttachment(
    visibility: AttachmentVisibility,
    sensitive = false,
  ) {
    const res = await attach(
      { type: "brief", id: "b1" },
      { bytes: PDF, fileName: "x.pdf", sensitive },
    );
    if (!res.ok) throw new Error("attach selhal");
    const row = res.attachment;
    row.visibility = visibility; // simulace pozdější změny viditelnosti
    return row;
  }

  it("vlastník má přístup i k private", async () => {
    const a = await makeAttachment("private");
    expect(await canAccess(user, a)).toBe(true);
    expect(await canAccess(other, a)).toBe(false);
  });

  it("shared_in_context: účastník ano, cizí ne", async () => {
    const a = await makeAttachment("shared_in_context");
    expect(await canAccess(other, a)).toBe(true); // u2 je účastník
    currentActor = other;
    expect(
      await canAccess(
        {
          kind: "user",
          userId: "u9",
          roles: ["client"],
          activeContext: "client",
        },
        a,
      ),
    ).toBe(false);
  });

  it("public vidí i návštěvník", async () => {
    const a = await makeAttachment("public");
    expect(await canAccess(VISITOR, a)).toBe(true);
  });

  it("smazaná příloha není dostupná nikomu", async () => {
    const a = await makeAttachment("public");
    a.status = "deleted";
    expect(await canAccess(user, a)).toBe(false);
    expect(await canAccess(VISITOR, a)).toBe(false);
  });
});
