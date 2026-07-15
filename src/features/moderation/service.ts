import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { emit } from "@/features/notifications/emit";
import {
  HIDING_ACTIONS,
  INTERVENING_ACTIONS,
  OPEN_REPORT_STATES,
  type ContentModerationState,
  type ModerationActionType,
  type ModerationActionView,
  type ReportDetailView,
  type ReportListItem,
  type ReportReason,
  type ReportState,
  type ReportSubmissionView,
  type ReportTargetType,
  REPORT_QUEUE_MAX_ITEMS,
  type TargetPreview,
} from "./types";
import { type ReportAction, nextReportState } from "./state-machine";

/**
 * Datová vrstva moderace (T036). Jediné místo sahající na `db.report`,
 * `db.reportSubmission`, `db.moderationAction` a `db.moderationFlag`. Cíl je
 * polymorfní a BEZ FK — existenci a vlastníka ověřuje malý dispatcher
 * (`lookupTarget`) nad reálnými tabulkami cílových domén (čtení napříč
 * doménami je v porovnání s "cizí modely se nemění" v pořádku — jde o SELECT,
 * ne o migraci cizího modelu). Zápis do cizí domény je JEDINÁ výjimka:
 * `Message.moderationState` — pole, které si T030 samo připravilo přesně pro
 * tento účel (viz komentář u modelu `Message` v `schema.prisma`).
 */

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// --- Existence a vlastnictví cíle -------------------------------------------

type TargetLookup = { exists: boolean; ownerUserId: string | null };

/**
 * Ověří existenci cíle a vrátí jeho vlastníka (pro validaci "reporter nemůže
 * nahlásit vlastní obsah" a pro notifikaci nahlášeného). `review` zatím nemá
 * vlastní model (T037 je `rfd`) — existenci ani vlastníka nelze ověřit, report
 * se přesto přijme (nikdy neblokujeme nahlášení kvůli chybějící navazující
 * doméně; T037 při svém vzniku doplní ověření).
 */
async function lookupTarget(
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetLookup> {
  switch (targetType) {
    case "message": {
      const row = await db.message.findUnique({
        where: { id: targetId },
        select: { senderUserId: true },
      });
      return row
        ? { exists: true, ownerUserId: row.senderUserId }
        : { exists: false, ownerUserId: null };
    }
    case "profile": {
      const row = await db.professionalProfile.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return row
        ? { exists: true, ownerUserId: row.userId }
        : { exists: false, ownerUserId: null };
    }
    case "portfolio_project": {
      const row = await db.portfolioProject.findUnique({
        where: { id: targetId },
        select: { ownerUserId: true, deletedAt: true },
      });
      if (!row || row.deletedAt) return { exists: false, ownerUserId: null };
      // Org-owned portfolio nemá jednoho "vlastníka-uživatele" — self-report
      // check se v tom případě neuplatní (viz T036 § Out of scope; org
      // členství neřešíme, nejde o bezpečnostní hranici, jen UX pojistku).
      return { exists: true, ownerUserId: row.ownerUserId };
    }
    case "request": {
      const row = await db.request.findUnique({
        where: { id: targetId },
        select: { ownerUserId: true },
      });
      return row
        ? { exists: true, ownerUserId: row.ownerUserId }
        : { exists: false, ownerUserId: null };
    }
    case "review":
      return { exists: true, ownerUserId: null };
  }
}

/** Cesta na veřejnou stránku cíle (pro notifikaci reportera / odkaz ve frontě). */
async function targetHref(
  targetType: ReportTargetType,
  targetId: string,
): Promise<string | null> {
  switch (targetType) {
    case "message": {
      const row = await db.message.findUnique({
        where: { id: targetId },
        select: { conversationId: true },
      });
      return row ? `/messages/${row.conversationId}` : null;
    }
    case "profile": {
      const row = await db.professionalProfile.findUnique({
        where: { id: targetId },
        select: { slug: true },
      });
      return row?.slug ? `/profesional/${row.slug}` : null;
    }
    case "portfolio_project": {
      const row = await db.portfolioProject.findUnique({
        where: { id: targetId },
        select: { slug: true },
      });
      return row?.slug ? `/projekt/${row.slug}` : null;
    }
    case "request":
      return `/requests/${targetId}`;
    case "review":
      return null;
  }
}

/**
 * E-maily uživatelů pro admin UI (reporter/moderátor/nahlášený — identita jinak
 * nese jen `userId`). Nikdy se nevrací klientovi mimo chráněnou admin sekci.
 */
export async function resolveUserEmails(
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const rows = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true },
  });
  return new Map(rows.map((r) => [r.id, r.email]));
}

// --- Nahlášení ---------------------------------------------------------------

export type ReportContentResult =
  | { ok: true; reportId: string; deduped: boolean }
  | { ok: false; reason: "target_not_found" | "own_content" };

/**
 * Podá nahlášení (T036 § Main flow bod 2). Duplicitní nahlášení STÁLE
 * OTEVŘENÉHO případu (bez ohledu na to, jestli je reporter stejný, nebo jde o
 * koordinovaný nálet víc uživatelů) se PŘIPOJÍ jako další `ReportSubmission` —
 * nový `Report` vznikne jen pro cíl bez nevyřešeného případu (§ Alternative
 * flows, § Edge cases).
 */
export async function reportContent(params: {
  targetType: ReportTargetType;
  targetId: string;
  reporterUserId: string;
  reason: ReportReason;
  note: string | null;
}): Promise<ReportContentResult> {
  const target = await lookupTarget(params.targetType, params.targetId);
  if (!target.exists) return { ok: false, reason: "target_not_found" };
  if (target.ownerUserId && target.ownerUserId === params.reporterUserId) {
    return { ok: false, reason: "own_content" };
  }

  const existing = await db.report.findFirst({
    where: {
      targetType: params.targetType,
      targetId: params.targetId,
      state: { in: [...OPEN_REPORT_STATES] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    try {
      await db.reportSubmission.create({
        data: {
          reportId: existing.id,
          reporterUserId: params.reporterUserId,
          reason: params.reason,
          note: params.note,
        },
      });
    } catch (error) {
      // Týž uživatel už tento (stále otevřený) případ nahlásil — no-op
      // (unikát [reportId, reporterUserId]; "ne nový záznam").
      if (!isUniqueViolation(error)) throw error;
    }
    return { ok: true, reportId: existing.id, deduped: true };
  }

  const created = await db.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        note: params.note,
      },
    });
    await tx.reportSubmission.create({
      data: {
        reportId: report.id,
        reporterUserId: params.reporterUserId,
        reason: params.reason,
        note: params.note,
      },
    });
    return report;
  });

  trackEvent("report_created", {
    reportId: created.id,
    targetType: params.targetType,
  });
  return { ok: true, reportId: created.id, deduped: false };
}

// --- Fronta ------------------------------------------------------------------

function toListItem(
  row: Prisma.ReportGetPayload<{
    include: { _count: { select: { submissions: true } } };
  }>,
): ReportListItem {
  return {
    id: row.id,
    targetType: row.targetType as ReportTargetType,
    targetId: row.targetId,
    reason: row.reason as ReportReason,
    state: row.state as ReportState,
    reporterCount: row._count.submissions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ReportQueueFilters = {
  state?: ReportState;
  targetType?: ReportTargetType;
  reason?: ReportReason;
};

/** Moderační fronta (T036 § Main flow bod 4): filtry, řazení dle stáří (nejstarší první). */
export async function listReports(
  filters: ReportQueueFilters = {},
): Promise<ReportListItem[]> {
  const rows = await db.report.findMany({
    where: {
      state: filters.state,
      targetType: filters.targetType,
      reason: filters.reason,
    },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "asc" },
    take: REPORT_QUEUE_MAX_ITEMS,
  });
  return rows.map(toListItem);
}

/** Historie reportů na tentýž cíl (kontext opakovaných problémů). */
async function listReportsForTarget(
  targetType: ReportTargetType,
  targetId: string,
  excludeReportId: string,
): Promise<ReportListItem[]> {
  const rows = await db.report.findMany({
    where: { targetType, targetId, id: { not: excludeReportId } },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toListItem);
}

/**
 * Historie případů, ve kterých daný uživatel figuruje jako (jeden z)
 * reporterů — moderátor ji vidí kvůli falešným/šikanózním reportům
 * (§ Edge cases).
 */
async function listReportsByReporter(
  reporterUserId: string,
  excludeReportId: string,
): Promise<ReportListItem[]> {
  const rows = await db.report.findMany({
    where: {
      id: { not: excludeReportId },
      submissions: { some: { reporterUserId } },
    },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map(toListItem);
}

// --- Náhled nahlášeného obsahu -----------------------------------------------

const MESSAGE_CONTEXT_SIZE = 2;

/**
 * Náhled nahlášeného obsahu s NEZBYTNÝM kontextem (T036 § Main flow bod 4).
 * U zprávy je to nahlášená zpráva + pár bezprostředních sousedů, NIKDY celá
 * konverzace (acceptance criteria — moderátor u nahlášené zprávy nevidí celou
 * konverzaci).
 */
async function loadTargetPreview(
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetPreview> {
  switch (targetType) {
    case "message": {
      const message = await db.message.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          conversationId: true,
          senderUserId: true,
          content: true,
          createdAt: true,
        },
      });
      if (!message) return { kind: "unavailable" };

      const [before, after] = await Promise.all([
        db.message.findMany({
          where: {
            conversationId: message.conversationId,
            createdAt: { lt: message.createdAt },
          },
          orderBy: { createdAt: "desc" },
          take: MESSAGE_CONTEXT_SIZE,
          select: {
            id: true,
            senderUserId: true,
            content: true,
            createdAt: true,
          },
        }),
        db.message.findMany({
          where: {
            conversationId: message.conversationId,
            createdAt: { gt: message.createdAt },
          },
          orderBy: { createdAt: "asc" },
          take: MESSAGE_CONTEXT_SIZE,
          select: {
            id: true,
            senderUserId: true,
            content: true,
            createdAt: true,
          },
        }),
      ]);

      return {
        kind: "message",
        messageId: message.id,
        conversationId: message.conversationId,
        senderUserId: message.senderUserId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        context: [...before.reverse(), ...after].map((m) => ({
          id: m.id,
          senderUserId: m.senderUserId,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    }
    case "profile": {
      const row = await db.professionalProfile.findUnique({
        where: { id: targetId },
        select: { userId: true, headline: true, slug: true },
      });
      if (!row) return { kind: "unavailable" };
      return {
        kind: "profile",
        ownerUserId: row.userId,
        title: row.headline ?? "Profil bez titulku",
        href: row.slug ? `/profesional/${row.slug}` : null,
      };
    }
    case "portfolio_project": {
      const row = await db.portfolioProject.findUnique({
        where: { id: targetId },
        select: { ownerUserId: true, title: true, slug: true },
      });
      if (!row) return { kind: "unavailable" };
      return {
        kind: "portfolio_project",
        ownerUserId: row.ownerUserId,
        title: row.title,
        href: row.slug ? `/projekt/${row.slug}` : null,
      };
    }
    case "request": {
      const row = await db.request.findUnique({
        where: { id: targetId },
        select: { ownerUserId: true, title: true },
      });
      if (!row) return { kind: "unavailable" };
      return {
        kind: "request",
        ownerUserId: row.ownerUserId,
        title: row.title,
        href: `/requests/${targetId}`,
      };
    }
    case "review":
      return { kind: "unavailable" };
  }
}

/** Aktuální moderační stav cíle (nezávislý na stavu konkrétního případu). */
async function getTargetModerationState(
  targetType: ReportTargetType,
  targetId: string,
): Promise<ContentModerationState> {
  const flag = await db.moderationFlag.findUnique({
    where: { targetType_targetId: { targetType, targetId } },
    select: { state: true },
  });
  return (flag?.state as ContentModerationState | undefined) ?? "visible";
}

// --- Detail ------------------------------------------------------------------

export type GetReportDetailResult =
  { ok: true; view: ReportDetailView } | { ok: false; reason: "not_found" };

/**
 * Načte detail případu pro admin frontu. Otevření detailu moderátorem POSOUVÁ
 * nový (`open`) případ do `triaged` (line-rate přechod — stejný vzorec jako
 * expirace poptávky při čtení, `features/requests/service.ts`); přechod se
 * NEAUDITUJE jako moderační akce (jde o bookkeeping fronty, ne rozhodnutí).
 */
export async function getReportDetail(
  reportId: string,
): Promise<GetReportDetailResult> {
  const row = await db.report.findUnique({
    where: { id: reportId },
    include: {
      submissions: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return { ok: false, reason: "not_found" };

  const report =
    row.state === "open"
      ? await db.report.update({
          where: { id: row.id },
          data: { state: "triaged" },
          include: {
            submissions: { orderBy: { createdAt: "asc" } },
            actions: { orderBy: { createdAt: "asc" } },
          },
        })
      : row;

  const targetType = report.targetType as ReportTargetType;
  const firstReporterUserId = report.submissions[0]?.reporterUserId ?? null;

  const [preview, targetModerationState, targetHistory, firstReporterHistory] =
    await Promise.all([
      loadTargetPreview(targetType, report.targetId),
      getTargetModerationState(targetType, report.targetId),
      listReportsForTarget(targetType, report.targetId, report.id),
      firstReporterUserId
        ? listReportsByReporter(firstReporterUserId, report.id)
        : Promise.resolve([]),
    ]);

  const submissions: ReportSubmissionView[] = report.submissions.map((s) => ({
    id: s.id,
    reporterUserId: s.reporterUserId,
    reason: s.reason as ReportReason,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
  }));
  const actions: ModerationActionView[] = report.actions.map((a) => ({
    id: a.id,
    moderatorUserId: a.moderatorUserId,
    actionType: a.actionType as ModerationActionType,
    reason: a.reason,
    createdAt: a.createdAt.toISOString(),
  }));

  return {
    ok: true,
    view: {
      id: report.id,
      targetType,
      targetId: report.targetId,
      reason: report.reason as ReportReason,
      note: report.note,
      state: report.state as ReportState,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
      submissions,
      actions,
      preview,
      targetModerationState,
      targetHistory,
      firstReporterHistory,
    },
  };
}

// --- Moderační akce ------------------------------------------------------------

export type ApplyActionResult =
  | { ok: true; state: ReportState }
  | { ok: false; reason: "not_found" | "invalid_transition" };

/**
 * Provede moderační akci nad reportem (T036 § Main flow bod 5). Vyřeší případ
 * (`resolve` → `actioned` pro zásahy, `dismiss` → `dismissed` pro "bez akce")
 * a VŽDY zapíše auditní záznam s důvodem (acceptance criteria). Skrytí obsahu
 * zapíše i do vlastního `ModerationFlag` (a pro zprávy navíc do jejich
 * existujícího `moderationState`). Notifikuje reportery i nahlášeného
 * (best-effort, mimo transakci — stejný vzorec jako `notifications/emit.ts`).
 */
export async function applyModerationAction(params: {
  reportId: string;
  moderatorUserId: string;
  actionType: ModerationActionType;
  reason: string;
}): Promise<ApplyActionResult> {
  const report = await db.report.findUnique({
    where: { id: params.reportId },
    include: { submissions: { orderBy: { createdAt: "asc" } } },
  });
  if (!report) return { ok: false, reason: "not_found" };

  const currentState = report.state as ReportState;
  const stateAction: ReportAction = INTERVENING_ACTIONS.includes(
    params.actionType,
  )
    ? "resolve"
    : "dismiss";
  const nextState = nextReportState(currentState, stateAction);
  if (!nextState) return { ok: false, reason: "invalid_transition" };

  const targetType = report.targetType as ReportTargetType;
  const targetId = report.targetId;
  const hides = HIDING_ACTIONS.includes(params.actionType);

  await db.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: { state: nextState, resolvedAt: new Date() },
    });
    await tx.moderationAction.create({
      data: {
        reportId: report.id,
        moderatorUserId: params.moderatorUserId,
        actionType: params.actionType,
        reason: params.reason,
      },
    });

    if (hides) {
      await tx.moderationFlag.upsert({
        where: { targetType_targetId: { targetType, targetId } },
        create: {
          targetType,
          targetId,
          state: "hidden",
          updatedByUserId: params.moderatorUserId,
        },
        update: { state: "hidden", updatedByUserId: params.moderatorUserId },
      });
      if (targetType === "message") {
        await tx.message.update({
          where: { id: targetId },
          data: { moderationState: "hidden" },
        });
      }
    }
  });

  trackEvent(
    nextState === "actioned" ? "report_actioned" : "report_dismissed",
    {
      reportId: report.id,
      actionType: params.actionType,
    },
  );

  await notifyResolution({
    reportId: report.id,
    targetType,
    targetId,
    reporterUserIds: [
      ...new Set(report.submissions.map((s) => s.reporterUserId)),
    ],
    actionType: params.actionType,
    reason: params.reason,
    intervened: nextState === "actioned",
  });

  return { ok: true, state: nextState };
}

/**
 * Obnoví viditelnost dříve skrytého cíle (T036 § States — `hidden → visible`).
 * Samostatná akce nezávislá na konkrétním reportu (skrytí mohlo vzniknout z
 * dávno uzavřeného případu).
 */
export async function restoreTargetVisibility(params: {
  targetType: ReportTargetType;
  targetId: string;
  moderatorUserId: string;
}): Promise<void> {
  await db.moderationFlag.upsert({
    where: {
      targetType_targetId: {
        targetType: params.targetType,
        targetId: params.targetId,
      },
    },
    create: {
      targetType: params.targetType,
      targetId: params.targetId,
      state: "visible",
      updatedByUserId: params.moderatorUserId,
    },
    update: { state: "visible", updatedByUserId: params.moderatorUserId },
  });
  if (params.targetType === "message") {
    await db.message
      .update({
        where: { id: params.targetId },
        data: { moderationState: "visible" },
      })
      .catch(() => {
        // Zpráva mezitím mohla zaniknout (kaskáda smazaného účtu) — obnovení
        // stavu cíle je i tak platné (ModerationFlag výše se zapsal).
      });
  }
}

/** Zpětná vazba reporterům a nahlášenému (T036 § Main flow bod 6, best-effort). */
async function notifyResolution(params: {
  reportId: string;
  targetType: ReportTargetType;
  targetId: string;
  reporterUserIds: string[];
  actionType: ModerationActionType;
  reason: string;
  intervened: boolean;
}): Promise<void> {
  const href =
    (await targetHref(params.targetType, params.targetId)) ?? "/notifications";

  // Reporteři: obecná zpětná vazba BEZ detailu akce.
  await Promise.all(
    params.reporterUserIds.map((reporterUserId) =>
      emit({
        eventType: "report_resolved",
        recipientUserId: reporterUserId,
        title: "Vaše nahlášení bylo vyřešeno",
        reason: "Nahlásili jste obsah, který moderátor posoudil.",
        link: href,
        context: { type: "report", id: params.reportId },
      }),
    ),
  );

  // Nahlášený: jen při skutečném zásahu, S důvodem (bez detailu pro reportery).
  if (!params.intervened) return;
  const target = await lookupTarget(params.targetType, params.targetId);
  if (!target.ownerUserId) return;

  await emit({
    eventType: "moderation_action_taken",
    recipientUserId: target.ownerUserId,
    title: "Moderátor zasáhl proti vašemu obsahu",
    reason: params.reason,
    link: href,
    context: { type: "report", id: params.reportId },
  });
}
