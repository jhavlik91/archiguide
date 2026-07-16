import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integrační test datové vrstvy reakce (T027) nad in-memory mockem DB (stejný
 * princip jako `requests/service.test.ts`). Pokrývá acceptance kritéria:
 *  - druhá reakce téhož profesionála na tutéž poptávku je odmítnuta,
 *  - přiložit lze jen vlastní `published` portfolio projekty,
 *  - přijetí reakce spustí přechod poptávky `start_discussion` (T024 slot).
 */

type ResponseRow = {
  id: string;
  requestId: string;
  authorUserId: string | null;
  authorOrgId: string | null;
  status: string;
  message: string;
  priceModel: string | null;
  priceNote: string | null;
  availability: string | null;
  rejectionReason: string | null;
  viewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PortfolioItemRow = { id: string; responseId: string; portfolioProjectId: string };

type PortfolioProjectRow = {
  id: string;
  ownerUserId: string | null;
  ownerOrgId: string | null;
  status: string;
  title: string;
};

let responseRows: ResponseRow[] = [];
let portfolioItemRows: PortfolioItemRow[] = [];
let portfolioProjectRows: PortfolioProjectRow[] = [];
let auditRows: unknown[] = [];
let requestRows: { id: string; ownerUserId: string }[] = [];

function withPortfolioItems(row: ResponseRow) {
  return {
    ...row,
    portfolioItems: portfolioItemRows
      .filter((i) => i.responseId === row.id)
      .map((i) => ({
        portfolioProject: portfolioProjectRows.find(
          (p) => p.id === i.portfolioProjectId,
        )!,
      })),
  };
}

const { transitionRequestMock } = vi.hoisted(() => ({
  transitionRequestMock: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("@/lib/notifications", () => ({
  emit: vi.fn(() => Promise.resolve({ status: "skipped", reason: "channel_off" })),
}));

vi.mock("@/features/requests/service", () => ({
  transitionRequest: transitionRequestMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    request: {
      findUnique: ({ where, select }: { where: { id: string }; select?: unknown }) => {
        const row = requestRows.find((r) => r.id === where.id) ?? null;
        if (!row) return Promise.resolve(null);
        void select;
        return Promise.resolve(row);
      },
    },
    professionalProfile: {
      findUnique: () => Promise.resolve(null),
    },
    organization: {
      findUnique: () => Promise.resolve(null),
    },
    portfolioProject: {
      findMany: ({
        where,
      }: {
        where: {
          id: { in: string[] };
          status: string;
          ownerUserId?: string;
          ownerOrgId?: string;
        };
      }) => {
        const rows = portfolioProjectRows.filter(
          (p) =>
            where.id.in.includes(p.id) &&
            p.status === where.status &&
            (where.ownerUserId === undefined || p.ownerUserId === where.ownerUserId) &&
            (where.ownerOrgId === undefined || p.ownerOrgId === where.ownerOrgId),
        );
        return Promise.resolve(rows.map((r) => ({ id: r.id })));
      },
    },
    requestResponse: {
      findFirst: ({
        where,
      }: {
        where: { requestId: string; authorUserId?: string; authorOrgId?: string };
      }) => {
        const row =
          responseRows.find(
            (r) =>
              r.requestId === where.requestId &&
              (where.authorUserId === undefined || r.authorUserId === where.authorUserId) &&
              (where.authorOrgId === undefined || r.authorOrgId === where.authorOrgId),
          ) ?? null;
        return Promise.resolve(row ? withPortfolioItems(row) : null);
      },
      findUnique: ({ where }: { where: { id: string } }) => {
        const row = responseRows.find((r) => r.id === where.id) ?? null;
        return Promise.resolve(row ? withPortfolioItems(row) : null);
      },
      findMany: ({ where }: { where?: { requestId?: string; authorUserId?: string } }) => {
        const rows = responseRows.filter(
          (r) =>
            (where?.requestId === undefined || r.requestId === where.requestId) &&
            (where?.authorUserId === undefined || r.authorUserId === where.authorUserId),
        );
        return Promise.resolve(rows.map(withPortfolioItems));
      },
      create: ({
        data,
      }: {
        data: Omit<ResponseRow, "id" | "createdAt" | "updatedAt"> & {
          portfolioItems?: { create: { portfolioProjectId: string }[] };
        };
      }) => {
        const { portfolioItems, ...rest } = data;
        const row: ResponseRow = {
          id: `resp_${responseRows.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...rest,
        };
        responseRows.push(row);
        for (const item of portfolioItems?.create ?? []) {
          portfolioItemRows.push({
            id: `pi_${portfolioItemRows.length + 1}`,
            responseId: row.id,
            portfolioProjectId: item.portfolioProjectId,
          });
        }
        return Promise.resolve(withPortfolioItems(row));
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ResponseRow>;
      }) => {
        const row = responseRows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        row.updatedAt = new Date();
        return Promise.resolve(withPortfolioItems(row));
      },
    },
    requestResponsePortfolioItem: {
      deleteMany: ({ where }: { where: { responseId: string } }) => {
        portfolioItemRows = portfolioItemRows.filter(
          (i) => i.responseId !== where.responseId,
        );
        return Promise.resolve({ count: 0 });
      },
    },
    requestResponseAuditEntry: {
      create: ({ data }: { data: unknown }) => {
        auditRows.push(data);
        return Promise.resolve(data);
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (await import("@/lib/db")).db as any;
      return fn(db);
    },
  },
}));

import {
  createResponse,
  getResponseForAuthor,
  listResponsesForRequest,
  transitionResponse,
} from "./service";

function seedRequest(id = "req_1", ownerUserId = "u-owner") {
  requestRows.push({ id, ownerUserId });
  return { id, ownerUserId };
}

function seedResponse(overrides: Partial<ResponseRow> = {}): ResponseRow {
  const row: ResponseRow = {
    id: `resp_${responseRows.length + 1}`,
    requestId: "req_1",
    authorUserId: "u-author",
    authorOrgId: null,
    status: "sent",
    message: "Zájem o spolupráci.",
    priceModel: null,
    priceNote: null,
    availability: null,
    rejectionReason: null,
    viewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  responseRows.push(row);
  return row;
}

beforeEach(() => {
  responseRows = [];
  portfolioItemRows = [];
  portfolioProjectRows = [];
  auditRows = [];
  requestRows = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

const baseInput = {
  message: "Rád bych na projektu spolupracoval.",
  priceModel: null,
  priceNote: null,
  availability: null,
  portfolioProjectIds: [] as string[],
};

describe("createResponse", () => {
  it("založí reakci rovnou jako `sent`", async () => {
    seedRequest();
    const result = await createResponse({
      requestId: "req_1",
      author: { type: "user", userId: "u-author" },
      actorUserId: "u-author",
      input: baseInput,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.view.status).toBe("sent");
  });

  it("odmítne druhou reakci téhož profesionála na tutéž poptávku (duplicate)", async () => {
    seedRequest();
    seedResponse();
    const result = await createResponse({
      requestId: "req_1",
      author: { type: "user", userId: "u-author" },
      actorUserId: "u-author",
      input: baseInput,
    });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("odmítne poptávku, která neexistuje", async () => {
    const result = await createResponse({
      requestId: "missing",
      author: { type: "user", userId: "u-author" },
      actorUserId: "u-author",
      input: baseInput,
    });
    expect(result).toEqual({ ok: false, reason: "request_not_found" });
  });

  it("přiložit lze jen vlastní `published` portfolio projekty", async () => {
    seedRequest();
    portfolioProjectRows.push({
      id: "proj_draft",
      ownerUserId: "u-author",
      ownerOrgId: null,
      status: "draft",
      title: "Nedokončený projekt",
    });
    portfolioProjectRows.push({
      id: "proj_foreign",
      ownerUserId: "u-someone-else",
      ownerOrgId: null,
      status: "published",
      title: "Cizí projekt",
    });

    const draftResult = await createResponse({
      requestId: "req_1",
      author: { type: "user", userId: "u-author" },
      actorUserId: "u-author",
      input: { ...baseInput, portfolioProjectIds: ["proj_draft"] },
    });
    expect(draftResult).toEqual({ ok: false, reason: "invalid_portfolio_items" });

    const foreignResult = await createResponse({
      requestId: "req_1",
      author: { type: "user", userId: "u-author" },
      actorUserId: "u-author",
      input: { ...baseInput, portfolioProjectIds: ["proj_foreign"] },
    });
    expect(foreignResult).toEqual({ ok: false, reason: "invalid_portfolio_items" });
  });

  it("přijme vlastní publikovaný projekt a uloží ho k reakci", async () => {
    seedRequest();
    portfolioProjectRows.push({
      id: "proj_ok",
      ownerUserId: "u-author",
      ownerOrgId: null,
      status: "published",
      title: "Rodinný dům",
    });
    const result = await createResponse({
      requestId: "req_1",
      author: { type: "user", userId: "u-author" },
      actorUserId: "u-author",
      input: { ...baseInput, portfolioProjectIds: ["proj_ok"] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.view.portfolioItems).toEqual([
        { id: "proj_ok", title: "Rodinný dům", slug: undefined },
      ]);
    }
  });
});

describe("transitionResponse", () => {
  it("neplatný přechod vrátí invalid_transition", async () => {
    const row = seedResponse({ status: "draft" });
    const result = await transitionResponse({
      responseId: row.id,
      action: "shortlist",
      actorUserId: "u-owner",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_transition" });
  });

  it("reject uloží volitelný důvod odmítnutí", async () => {
    const row = seedResponse({ status: "viewed" });
    const result = await transitionResponse({
      responseId: row.id,
      action: "reject",
      actorUserId: "u-owner",
      rejectionReason: "Hledáme jinou specializaci.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.view.status).toBe("rejected");
      expect(result.view.rejectionReason).toBe("Hledáme jinou specializaci.");
    }
  });

  it("accept posune i poptávku do jednání (start_discussion)", async () => {
    const row = seedResponse({ status: "shortlisted" });
    const result = await transitionResponse({
      responseId: row.id,
      action: "accept",
      actorUserId: "u-owner",
    });
    expect(result.ok).toBe(true);
    expect(transitionRequestMock).toHaveBeenCalledWith({
      requestId: row.requestId,
      action: "start_discussion",
      actorUserId: "u-owner",
    });
  });
});

describe("listResponsesForRequest / getResponseForAuthor", () => {
  it("nastaví `viewed` u dosud `sent` reakcí při čtení vlastníkem", async () => {
    seedResponse({ status: "sent" });
    const list = await listResponsesForRequest("req_1", "u-owner");
    expect(list).toHaveLength(1);
    expect(list[0]!.status).toBe("viewed");
  });

  it("getResponseForAuthor najde reakci konkrétního autora", async () => {
    seedResponse({ authorUserId: "u-author" });
    const found = await getResponseForAuthor("req_1", { type: "user", userId: "u-author" });
    expect(found?.status).toBe("sent");
    const notFound = await getResponseForAuthor("req_1", { type: "user", userId: "u-other" });
    expect(notFound).toBeNull();
  });
});
