import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent, type AnalyticsEvent } from "@/lib/analytics";
import { getBriefById } from "@/features/brief/service";
import { parseBriefContent } from "@/features/brief/content";
import type { BriefContent } from "@/features/brief/types";
import {
  isAuditedAction,
  nextStatus,
  type RequestAction,
} from "./state-machine";
import { buildRequestPublicView } from "./public-view";
import type {
  RequestAuditItem,
  RequestListItem,
  RequestPublicView,
  RequestStatus,
  RequestType,
  RequestVisibility,
  RequestView,
} from "./types";
import type { ParsedRequestInput } from "./validation";

/**
 * Datová vrstva poptávky (T024). Jediné místo sahající na `db.request` a
 * `db.requestAuditEntry`. Nepočítá s oprávněními (ta řeší `actions.ts` přes
 * permission vrstvu) — vynucuje ale doménové invarianty:
 *
 *  - poptávka vzniká jen z briefu, jako `draft` + `private` (least privilege);
 *  - stav se mění VÝHRADNĚ přes stavový automat (`state-machine.ts`); neplatný
 *    přechod se odmítne;
 *  - publikace pořídí SNAPSHOT briefu (`briefSnapshot`) — pozdější změna briefu
 *    už publikovanou poptávku neovlivní (zadani/09 — Request);
 *  - významné přechody se auditují (append-only `RequestAuditEntry`);
 *  - `active` poptávka s prošlým termínem expiruje při čtení (+ denní job).
 */

type RequestRow = Prisma.RequestGetPayload<Record<string, never>>;

/** Analytický event pro každý přechod (dotted konvence jako zbytek analytiky). */
const TRANSITION_EVENTS: Record<RequestAction, AnalyticsEvent> = {
  publish: "request.published",
  start_discussion: "request.discussion_started",
  pause: "request.paused",
  resume: "request.resumed",
  award: "request.awarded",
  close: "request.closed",
  cancel: "request.cancelled",
  expire: "request.expired",
};

function toView(row: RequestRow): RequestView {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    briefId: row.briefId,
    type: row.type as RequestType,
    visibility: row.visibility as RequestView["visibility"],
    status: row.status as RequestStatus,
    title: row.title,
    targetProfessionSlugs: row.targetProfessionSlugs,
    region: row.region,
    budget: row.budget,
    timeline: row.timeline,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    briefSnapshot: row.briefSnapshot
      ? parseBriefContent(row.briefSnapshot)
      : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    editedAfterPublish: row.editedAfterPublish,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Vytvoření z briefu -----------------------------------------------------

/** Předvyplnění poptávky z obsahu briefu (§18 → §20). Uživatel pak potvrdí/upraví. */
function prefillFromBrief(
  title: string,
  content: BriefContent,
): Pick<
  ParsedRequestInput,
  "title" | "targetProfessionSlugs" | "region" | "budget" | "timeline"
> {
  return {
    title,
    targetProfessionSlugs: content.recommendedProfessions.map((p) => p.slug),
    region: content.location?.display ?? "",
    budget: content.budget.known ? content.budget.display : null,
    timeline: content.timing,
  };
}

export type CreateRequestResult =
  | { ok: true; view: RequestView }
  | { ok: false; reason: "brief_not_found" | "corrupt_brief" };

/**
 * Založí `draft` poptávku předvyplněnou z briefu. Jeden brief může mít víc
 * poptávek (jiné profese), proto se NEdeduplikuje. Vlastnictví briefu ověřuje
 * volající (akce) přes `canReadRequest`/brief permissions.
 */
export async function createRequestFromBrief(params: {
  briefId: string;
  ownerUserId: string;
}): Promise<CreateRequestResult> {
  const brief = await getBriefById(params.briefId);
  if (!brief.ok) return { ok: false, reason: "brief_not_found" };

  const prefill = prefillFromBrief(brief.view.title, brief.view.content);

  const created = await db.request.create({
    data: {
      ownerUserId: params.ownerUserId,
      briefId: params.briefId,
      type: "b2c",
      status: "draft",
      visibility: "private",
      title: prefill.title,
      targetProfessionSlugs: prefill.targetProfessionSlugs,
      region: prefill.region,
      budget: prefill.budget,
      timeline: prefill.timeline,
    },
  });
  trackEvent("request.created", {
    requestId: created.id,
    briefId: params.briefId,
  });
  return { ok: true, view: toView(created) };
}

// --- Čtení ------------------------------------------------------------------

export type GetRequestResult =
  { ok: true; view: RequestView } | { ok: false; reason: "not_found" };

/**
 * Načte poptávku. Line-rate kontrola expirace: `active` poptávka s prošlým
 * termínem se při čtení převede na `expired` (+ audit) — uživatel nikdy nevidí
 * „aktivní" poptávku po termínu.
 */
export async function getRequestById(
  requestId: string,
): Promise<GetRequestResult> {
  const row = await db.request.findUnique({ where: { id: requestId } });
  if (!row) return { ok: false, reason: "not_found" };

  const expired = await expireRowIfDue(row);
  return { ok: true, view: toView(expired ?? row) };
}

/** Fakta potřebná k rozhodnutí `canReadRequestPublicView` — bez plného řádku. */
export interface RequestVisibilityMeta {
  ownerUserId: string;
  visibility: RequestVisibility;
  status: RequestStatus;
}

/** Lehký dotaz pro permission vrstvu (T025) — nečte `briefSnapshot` ani texty. */
export async function getRequestVisibilityMeta(
  requestId: string,
): Promise<RequestVisibilityMeta | null> {
  const row = await db.request.findUnique({
    where: { id: requestId },
    select: { ownerUserId: true, visibility: true, status: true },
  });
  if (!row) return null;
  return {
    ownerUserId: row.ownerUserId,
    visibility: row.visibility as RequestVisibility,
    status: row.status as RequestStatus,
  };
}

/** Poptávky vlastníka (dashboard), nejnovější první. Prošlé nejdřív expiruje. */
export async function listRequestsForUser(
  ownerUserId: string,
): Promise<RequestListItem[]> {
  await expireDueRequests({ ownerUserId });
  const rows = await db.request.findMany({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type as RequestType,
    status: r.status as RequestStatus,
    region: r.region,
    targetProfessionSlugs: r.targetProfessionSlugs,
    // Počet reakcí doplní T027; v MVP 0 (slot).
    responseCount: 0,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Auditní historie poptávky (nejnovější první) — pro vlastníka/admina. */
export async function listRequestAudit(
  requestId: string,
): Promise<RequestAuditItem[]> {
  const rows = await db.requestAuditEntry.findMany({
    where: { requestId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    fromStatus: (r.fromStatus as RequestStatus | null) ?? null,
    toStatus: r.toStatus as RequestStatus,
    actorUserId: r.actorUserId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// --- Viditelnost a anonymizace (T025) ---------------------------------------

export type GetPublicRequestViewResult =
  { ok: true; view: RequestPublicView } | { ok: false; reason: "not_found" };

/**
 * Anonymizovaná projekce poptávky (§20.2–20.3). Přístup NEŘEŠÍ (to dělá
 * `canReadRequestPublicView` nad `getRequestVisibilityMeta` na volajícím) —
 * tahle funkce jen sestaví whitelist DTO (`buildRequestPublicView`) z aktuálního
 * řádku. Stejná expirační kontrola jako `getRequestById` (prošlá `active`
 * poptávka se nikdy neukáže jako aktivní).
 */
export async function getPublicRequestView(
  requestId: string,
): Promise<GetPublicRequestViewResult> {
  const row = await db.request.findUnique({ where: { id: requestId } });
  if (!row) return { ok: false, reason: "not_found" };
  const current = (await expireRowIfDue(row)) ?? row;

  const briefContent = current.briefSnapshot
    ? parseBriefContent(current.briefSnapshot)
    : null;

  return {
    ok: true,
    view: buildRequestPublicView(
      {
        id: current.id,
        type: current.type as RequestType,
        status: current.status as RequestStatus,
        title: current.title,
        targetProfessionSlugs: current.targetProfessionSlugs,
        region: current.region,
        budget: current.budget,
        timeline: current.timeline,
        deadline: current.deadline ? current.deadline.toISOString() : null,
        publishedAt: current.publishedAt
          ? current.publishedAt.toISOString()
          : null,
      },
      briefContent,
    ),
  };
}

/**
 * Nastaví viditelnost poptávky (main flow bod 1, alternative flow — změna
 * `public → private` po publikaci). Ortogonální ke stavovému automatu (§ States)
 * — funguje v jakémkoli stavu, žádné omezení na draft/publikováno. Sanitizační
 * kontrolu a potvrzení (main flow bod 4) řeší volající akce PŘED zápisem.
 */
export async function setRequestVisibility(
  requestId: string,
  visibility: RequestVisibility,
): Promise<UpdateRequestResult> {
  const row = await db.request.findUnique({ where: { id: requestId } });
  if (!row) return { ok: false, reason: "not_found" };

  const updated = await db.request.update({
    where: { id: requestId },
    data: { visibility },
  });
  trackEvent("request.visibility_changed", { requestId, visibility });
  return { ok: true, view: toView(updated) };
}

/** Je daný uživatel pozvaný k neveřejné poptávce (`RequestInvite`)? */
export async function isUserInvitedToRequest(
  requestId: string,
  userId: string,
): Promise<boolean> {
  const invite = await db.requestInvite.findUnique({
    where: { requestId_invitedUserId: { requestId, invitedUserId: userId } },
    select: { id: true },
  });
  return invite !== null;
}

export type InviteResult = { ok: true } | { ok: false; reason: "not_found" };

/**
 * Pozve profesionála k neveřejné poptávce. Datový základ pro matching UI
 * (T029) — tady jen idempotentní zápis (opětovné pozvání téhož kandidáta se
 * nerozbije, §Edge cases). Vlastnictví/oprávnění ověří volající.
 */
export async function inviteProfessionalToRequest(params: {
  requestId: string;
  invitedUserId: string;
  invitedByUserId: string;
}): Promise<InviteResult> {
  const row = await db.request.findUnique({
    where: { id: params.requestId },
    select: { id: true },
  });
  if (!row) return { ok: false, reason: "not_found" };

  await db.requestInvite.upsert({
    where: {
      requestId_invitedUserId: {
        requestId: params.requestId,
        invitedUserId: params.invitedUserId,
      },
    },
    create: {
      requestId: params.requestId,
      invitedUserId: params.invitedUserId,
      invitedByUserId: params.invitedByUserId,
    },
    update: {},
  });
  return { ok: true };
}

// --- Editace ----------------------------------------------------------------

export type UpdateRequestResult =
  | { ok: true; view: RequestView }
  | { ok: false; reason: "not_found" | "not_editable" };

/**
 * Úprava DRAFT poptávky (plná editace před publikací). Po publikaci draft edit
 * neběží — na to je `refinePublishedRequest` (jen upřesnění).
 */
export async function updateDraftRequest(
  requestId: string,
  input: ParsedRequestInput,
): Promise<UpdateRequestResult> {
  const row = await db.request.findUnique({ where: { id: requestId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "draft") return { ok: false, reason: "not_editable" };

  const updated = await db.request.update({
    where: { id: requestId },
    data: {
      title: input.title,
      type: input.type,
      targetProfessionSlugs: input.targetProfessionSlugs,
      region: input.region,
      budget: input.budget,
      timeline: input.timeline,
      deadline: input.deadline ? new Date(input.deadline) : null,
    },
  });
  return { ok: true, view: toView(updated) };
}

/**
 * Upřesnění PUBLIKOVANÉ poptávky (main flow §3): jen doplňující pole (rozpočet,
 * termín, časový horizont) — NE změna smyslu (typ/profese/region jsou zamčené).
 * Nastaví `editedAfterPublish` → UI zobrazí poznámku „upraveno". Terminální stav
 * ani draft nelze takto upravit.
 */
export async function refinePublishedRequest(
  requestId: string,
  patch: {
    budget: string | null;
    timeline: string | null;
    deadline: string | null;
  },
): Promise<UpdateRequestResult> {
  const row = await db.request.findUnique({ where: { id: requestId } });
  if (!row) return { ok: false, reason: "not_found" };
  const editable: RequestStatus[] = ["active", "in_discussion", "paused"];
  if (!editable.includes(row.status as RequestStatus)) {
    return { ok: false, reason: "not_editable" };
  }

  const updated = await db.request.update({
    where: { id: requestId },
    data: {
      budget: patch.budget,
      timeline: patch.timeline,
      deadline: patch.deadline ? new Date(patch.deadline) : null,
      editedAfterPublish: true,
    },
  });
  return { ok: true, view: toView(updated) };
}

// --- Stavové přechody -------------------------------------------------------

export type TransitionResult =
  | { ok: true; view: RequestView }
  | { ok: false; reason: "not_found" | "invalid_transition" };

/**
 * Provede stavový přechod přes automat. `null` z `nextStatus` = neplatný přechod
 * → server odmítne (§ Stavová pravidla). Oprávnění ověřuje volající (akce).
 * `actorUserId = null` značí systémový přechod (job/kaskáda).
 *
 * Vedlejší efekty: publikace nastaví `publishedAt` a pořídí `briefSnapshot`;
 * auditovaný přechod zapíše `RequestAuditEntry` v jedné transakci se změnou stavu.
 */
export async function transitionRequest(params: {
  requestId: string;
  action: RequestAction;
  actorUserId: string | null;
}): Promise<TransitionResult> {
  const row = await db.request.findUnique({ where: { id: params.requestId } });
  if (!row) return { ok: false, reason: "not_found" };

  const from = row.status as RequestStatus;
  const to = nextStatus(from, params.action);
  if (to === null) return { ok: false, reason: "invalid_transition" };

  const data: Prisma.RequestUpdateInput = { status: to };
  if (params.action === "publish") {
    data.publishedAt = new Date();
    const snapshot = await briefSnapshotFor(row.briefId);
    if (snapshot) {
      data.briefSnapshot = snapshot as unknown as Prisma.InputJsonValue;
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.request.update({
      where: { id: params.requestId },
      data,
    });
    if (isAuditedAction(params.action)) {
      await tx.requestAuditEntry.create({
        data: {
          requestId: params.requestId,
          actorUserId: params.actorUserId,
          action: params.action,
          fromStatus: from,
          toStatus: to,
        },
      });
    }
    return next;
  });

  trackEvent(TRANSITION_EVENTS[params.action], {
    requestId: params.requestId,
    from,
    to,
  });
  return { ok: true, view: toView(updated) };
}

/** Pořídí snapshot obsahu briefu pro publikaci (nebo `null`, není-li dostupný). */
async function briefSnapshotFor(
  briefId: string | null,
): Promise<BriefContent | null> {
  if (!briefId) return null;
  const brief = await getBriefById(briefId);
  return brief.ok ? brief.view.content : null;
}

// --- Expirace ---------------------------------------------------------------

/** Expiruje jeden řádek, je-li `active` po termínu. Vrací nový řádek, nebo `null`. */
async function expireRowIfDue(row: RequestRow): Promise<RequestRow | null> {
  if (row.status !== "active" || !row.deadline) return null;
  if (row.deadline.getTime() > Date.now()) return null;
  const result = await transitionRequest({
    requestId: row.id,
    action: "expire",
    actorUserId: null,
  });
  if (!result.ok) return null;
  return db.request.findUnique({ where: { id: row.id } });
}

/**
 * Hromadně expiruje `active` poptávky po termínu (denní job; volitelně jen pro
 * jednoho vlastníka při čtení dashboardu). Vrací počet expirovaných.
 */
export async function expireDueRequests(
  scope: { ownerUserId?: string } = {},
): Promise<number> {
  const due = await db.request.findMany({
    where: {
      status: "active",
      deadline: { lt: new Date() },
      ...(scope.ownerUserId ? { ownerUserId: scope.ownerUserId } : {}),
    },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of due) {
    const result = await transitionRequest({
      requestId: id,
      action: "expire",
      actorUserId: null,
    });
    if (result.ok) expired += 1;
  }
  return expired;
}

/**
 * Systémové zrušení všech neterminálních poptávek vlastníka (edge: smazání účtu
 * — zadani/09). Reakce se notifikují v T032 (slot). Vrací počet zrušených.
 */
export async function cancelRequestsForUser(
  ownerUserId: string,
): Promise<number> {
  const open = await db.request.findMany({
    where: {
      ownerUserId,
      status: { in: ["active", "in_discussion", "paused"] },
    },
    select: { id: true },
  });
  let cancelled = 0;
  for (const { id } of open) {
    const result = await transitionRequest({
      requestId: id,
      action: "cancel",
      actorUserId: null,
    });
    if (result.ok) cancelled += 1;
  }
  return cancelled;
}
