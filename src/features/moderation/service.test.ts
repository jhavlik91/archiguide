import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Integrační test datové vrstvy moderace (T036) nad in-memory mockem DB.
 * Pokrývá klíčové invarianty z acceptance criteria:
 *  - duplicitní nahlášení (i od RŮZNÝCH uživatelů) stejného otevřeného případu
 *    se agreguje (žádný nový `Report`, jen přibude `ReportSubmission`),
 *  - reporter nemůže nahlásit vlastní obsah,
 *  - moderační akce vždy zapíše auditní záznam s důvodem a hide reálně skryje
 *    zprávu (zapíše do `Message.moderationState`),
 *  - vyřešený případ nejde vyřešit podruhé bez platného přechodu.
 */

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  note: string | null;
  state: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type SubmissionRow = {
  id: string;
  reportId: string;
  reporterUserId: string;
  reason: string;
  note: string | null;
  createdAt: Date;
};
type ActionRow = {
  id: string;
  reportId: string;
  moderatorUserId: string | null;
  actionType: string;
  reason: string;
  createdAt: Date;
};
type FlagRow = {
  targetType: string;
  targetId: string;
  state: string;
  updatedByUserId: string | null;
};
type MessageRow = {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  createdAt: Date;
  moderationState: string;
};

let reports: ReportRow[] = [];
let submissions: SubmissionRow[] = [];
let actions: ActionRow[] = [];
let flags: FlagRow[] = [];
let messages: MessageRow[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    senderUserId: "sender-1",
    content: "ahoj",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    moderationState: "visible",
  },
];

let reportSeq = 0;
let subSeq = 0;
let actionSeq = 0;

function findUniqueSubmission(reportId: string, reporterUserId: string) {
  return submissions.find(
    (s) => s.reportId === reportId && s.reporterUserId === reporterUserId,
  );
}

const dbMockMethods = {
  message: {
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(messages.find((m) => m.id === where.id) ?? null),
    findMany: ({
      where,
    }: {
      where: {
        conversationId: string;
        createdAt?: { lt?: Date; gt?: Date };
      };
    }) =>
      Promise.resolve(
        messages.filter(
          (m) =>
            m.conversationId === where.conversationId &&
            (!where.createdAt?.lt || m.createdAt < where.createdAt.lt) &&
            (!where.createdAt?.gt || m.createdAt > where.createdAt.gt),
        ),
      ),
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: { moderationState: string };
    }) => {
      const m = messages.find((x) => x.id === where.id);
      if (!m) throw new Error("not found");
      m.moderationState = data.moderationState;
      return Promise.resolve(m);
    },
  },
  professionalProfile: { findUnique: () => Promise.resolve(null) },
  portfolioProject: { findUnique: () => Promise.resolve(null) },
  request: { findUnique: () => Promise.resolve(null) },
  report: {
    findFirst: ({
      where,
    }: {
      where: { targetType: string; targetId: string; state: { in: string[] } };
    }) => {
      const found = reports
        .filter(
          (r) =>
            r.targetType === where.targetType &&
            r.targetId === where.targetId &&
            where.state.in.includes(r.state),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return Promise.resolve(found[0] ?? null);
    },
    findUnique: ({
      where,
      include,
    }: {
      where: { id: string };
      include?: { submissions?: unknown; actions?: unknown };
    }) => {
      const row = reports.find((r) => r.id === where.id);
      if (!row) return Promise.resolve(null);
      if (!include) return Promise.resolve(row);
      return Promise.resolve({
        ...row,
        ...(include.submissions
          ? {
              submissions: submissions
                .filter((s) => s.reportId === row.id)
                .slice()
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
            }
          : {}),
        ...(include.actions
          ? {
              actions: actions
                .filter((a) => a.reportId === row.id)
                .slice()
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
            }
          : {}),
      });
    },
    findMany: ({
      where,
      orderBy,
    }: {
      where: { state?: string; targetType?: string; reason?: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }) => {
      let rows = reports.filter(
        (r) =>
          (!where.state || r.state === where.state) &&
          (!where.targetType || r.targetType === where.targetType) &&
          (!where.reason || r.reason === where.reason),
      );
      rows = rows
        .slice()
        .sort((a, b) =>
          orderBy?.createdAt === "desc"
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime(),
        );
      return Promise.resolve(
        rows.map((r) => ({
          ...r,
          _count: {
            submissions: submissions.filter((s) => s.reportId === r.id).length,
          },
        })),
      );
    },
    create: ({
      data,
    }: {
      data: {
        targetType: string;
        targetId: string;
        reason: string;
        note: string | null;
      };
    }) => {
      reportSeq += 1;
      const row: ReportRow = {
        id: `report-${reportSeq}`,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        note: data.note,
        state: "open",
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      reports.push(row);
      return Promise.resolve(row);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: { state?: string; resolvedAt?: Date };
    }) => {
      const row = reports.find((r) => r.id === where.id);
      if (!row) throw new Error("not found");
      if (data.state) row.state = data.state;
      if (data.resolvedAt) row.resolvedAt = data.resolvedAt;
      row.updatedAt = new Date();
      return Promise.resolve(row);
    },
  },
  reportSubmission: {
    create: ({
      data,
    }: {
      data: {
        reportId: string;
        reporterUserId: string;
        reason: string;
        note: string | null;
      };
    }) => {
      if (findUniqueSubmission(data.reportId, data.reporterUserId)) {
        throw new MockKnownRequestError("P2002");
      }
      subSeq += 1;
      const row: SubmissionRow = {
        id: `sub-${subSeq}`,
        reportId: data.reportId,
        reporterUserId: data.reporterUserId,
        reason: data.reason,
        note: data.note,
        createdAt: new Date(),
      };
      submissions.push(row);
      return Promise.resolve(row);
    },
  },
  moderationAction: {
    create: ({
      data,
    }: {
      data: {
        reportId: string;
        moderatorUserId: string | null;
        actionType: string;
        reason: string;
      };
    }) => {
      actionSeq += 1;
      const row: ActionRow = {
        id: `action-${actionSeq}`,
        reportId: data.reportId,
        moderatorUserId: data.moderatorUserId,
        actionType: data.actionType,
        reason: data.reason,
        createdAt: new Date(),
      };
      actions.push(row);
      return Promise.resolve(row);
    },
  },
  moderationFlag: {
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { targetType_targetId: { targetType: string; targetId: string } };
      create: FlagRow;
      update: { state: string; updatedByUserId: string | null };
    }) => {
      const key = where.targetType_targetId;
      const existing = flags.find(
        (f) => f.targetType === key.targetType && f.targetId === key.targetId,
      );
      if (existing) {
        existing.state = update.state;
        existing.updatedByUserId = update.updatedByUserId;
        return Promise.resolve(existing);
      }
      flags.push(create);
      return Promise.resolve(create);
    },
    findUnique: ({
      where,
    }: {
      where: { targetType_targetId: { targetType: string; targetId: string } };
    }) => {
      const key = where.targetType_targetId;
      return Promise.resolve(
        flags.find(
          (f) => f.targetType === key.targetType && f.targetId === key.targetId,
        ) ?? null,
      );
    },
  },
};

type DbMock = typeof dbMockMethods & {
  $transaction: (fn: (tx: DbMock) => Promise<unknown>) => Promise<unknown>;
};

const dbMock = dbMockMethods as DbMock;
dbMock.$transaction = (fn) => fn(dbMock);

const { MockKnownRequestError } = vi.hoisted(() => ({
  MockKnownRequestError: class extends Error {
    code: string;
    constructor(code: string) {
      super("Unique constraint violation");
      this.code = code;
    }
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: MockKnownRequestError },
}));
vi.mock("@/features/notifications/emit", () => ({
  emit: vi.fn().mockResolvedValue({ status: "skipped", reason: "channel_off" }),
}));

const { reportContent, listReports, applyModerationAction } =
  await import("./service");
const { emit } = await import("@/features/notifications/emit");

afterEach(() => {
  reports = [];
  submissions = [];
  actions = [];
  flags = [];
  messages = [
    {
      id: "msg-1",
      conversationId: "conv-1",
      senderUserId: "sender-1",
      content: "ahoj",
      createdAt: new Date("2026-01-01T10:00:00Z"),
      moderationState: "visible",
    },
  ];
  vi.clearAllMocks();
});

describe("reportContent", () => {
  it("založí nový případ pro dosud nenahlášený cíl", async () => {
    const result = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-a",
      reason: "harassment",
      note: null,
    });
    expect(result).toEqual({ ok: true, reportId: "report-1", deduped: false });
    expect(submissions).toHaveLength(1);
  });

  it("odmítne nahlášení neexistujícího cíle", async () => {
    const result = await reportContent({
      targetType: "message",
      targetId: "does-not-exist",
      reporterUserId: "reporter-a",
      reason: "spam",
      note: null,
    });
    expect(result).toEqual({ ok: false, reason: "target_not_found" });
  });

  it("odmítne nahlášení vlastního obsahu", async () => {
    const result = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "sender-1",
      reason: "spam",
      note: null,
    });
    expect(result).toEqual({ ok: false, reason: "own_content" });
  });

  it("duplicitní nahlášení RŮZNÝMI uživateli se agreguje do jednoho případu", async () => {
    const first = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-a",
      reason: "spam",
      note: null,
    });
    const second = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-b",
      reason: "harassment",
      note: null,
    });
    expect(reports).toHaveLength(1);
    expect(second).toMatchObject({ ok: true, deduped: true });
    if (first.ok && second.ok) expect(second.reportId).toBe(first.reportId);

    const queue = await listReports({});
    expect(queue).toHaveLength(1);
    expect(queue[0]!.reporterCount).toBe(2);
  });

  it("opakované nahlášení TÝMŽ uživatelem je idempotentní (žádný nový záznam)", async () => {
    await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-a",
      reason: "spam",
      note: null,
    });
    const second = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-a",
      reason: "spam",
      note: "znovu",
    });
    expect(second.ok).toBe(true);
    expect(reports).toHaveLength(1);
    expect(submissions).toHaveLength(1);
  });

  it("nový report na cíl s už VYŘEŠENÝM případem založí nový případ (ne agregaci)", async () => {
    const first = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-a",
      reason: "spam",
      note: null,
    });
    if (!first.ok) throw new Error("expected ok");
    await applyModerationAction({
      reportId: first.reportId,
      moderatorUserId: "mod-1",
      actionType: "no_action",
      reason: "Neopodstatněné nahlášení.",
    });

    const second = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-b",
      reason: "spam",
      note: null,
    });
    expect(second).toMatchObject({ ok: true, deduped: false });
    expect(reports).toHaveLength(2);
  });
});

describe("applyModerationAction", () => {
  async function fileReport() {
    const result = await reportContent({
      targetType: "message",
      targetId: "msg-1",
      reporterUserId: "reporter-a",
      reason: "harassment",
      note: null,
    });
    if (!result.ok) throw new Error("expected ok");
    return result.reportId;
  }

  it("content_hide → případ 'actioned', zpráva skryta, auditní záznam s důvodem", async () => {
    const reportId = await fileReport();
    const result = await applyModerationAction({
      reportId,
      moderatorUserId: "mod-1",
      actionType: "content_hide",
      reason: "Obtěžující obsah vůči druhé straně konverzace.",
    });
    expect(result).toEqual({ ok: true, state: "actioned" });
    expect(messages[0]!.moderationState).toBe("hidden");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionType: "content_hide",
      reason: "Obtěžující obsah vůči druhé straně konverzace.",
      moderatorUserId: "mod-1",
    });
  });

  it("no_action → případ 'dismissed', obsah zůstává viditelný", async () => {
    const reportId = await fileReport();
    const result = await applyModerationAction({
      reportId,
      moderatorUserId: "mod-1",
      actionType: "no_action",
      reason: "Report neopodstatněný.",
    });
    expect(result).toEqual({ ok: true, state: "dismissed" });
    expect(messages[0]!.moderationState).toBe("visible");
  });

  it("nejde vyřešit podruhé (žádný platný přechod z 'actioned'/'dismissed')", async () => {
    const reportId = await fileReport();
    await applyModerationAction({
      reportId,
      moderatorUserId: "mod-1",
      actionType: "no_action",
      reason: "První posouzení.",
    });
    const second = await applyModerationAction({
      reportId,
      moderatorUserId: "mod-1",
      actionType: "content_hide",
      reason: "Druhý pokus.",
    });
    expect(second).toEqual({ ok: false, reason: "invalid_transition" });
    // Druhá akce se nezapsala (žádný neplatný audit záznam bez efektu).
    expect(actions).toHaveLength(1);
  });

  it("neexistující report vrátí not_found", async () => {
    const result = await applyModerationAction({
      reportId: "missing",
      moderatorUserId: "mod-1",
      actionType: "warning",
      reason: "x".repeat(10),
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("notifikuje reportery (obecně) a při zásahu i nahlášeného (s důvodem)", async () => {
    const reportId = await fileReport();
    await applyModerationAction({
      reportId,
      moderatorUserId: "mod-1",
      actionType: "content_hide",
      reason: "Skryto kvůli obtěžování.",
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "report_resolved",
        recipientUserId: "reporter-a",
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "moderation_action_taken",
        recipientUserId: "sender-1",
        reason: "Skryto kvůli obtěžování.",
      }),
    );
  });
});
