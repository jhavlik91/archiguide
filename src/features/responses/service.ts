import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent, type AnalyticsEvent } from "@/lib/analytics";
import { emit } from "@/lib/notifications";
import { getMembershipRole } from "@/features/organizations/service";
import { roleAtLeast } from "@/features/organizations/rules";
import { transitionRequest } from "@/features/requests/service";
import type { RequestStatus } from "@/features/requests";
import {
  isAuditedResponseAction,
  nextResponseStatus,
  type ResponseAction,
} from "./state-machine";
import type {
  ResponseAuditItem,
  ResponseAuthorRef,
  ResponseAuthorSummary,
  ResponseListItemForAuthor,
  ResponseListItemForOwner,
  ResponseStatus,
  ResponseView,
} from "./types";
import type { ParsedResponseInput } from "./validation";

/**
 * Datová vrstva reakce na poptávku (T027). Jediné místo sahající na
 * `db.requestResponse` a `db.requestResponseAuditEntry`. Nepočítá s oprávněními
 * (ta řeší `actions.ts` přes permission vrstvu) — vynucuje ale doménové
 * invarianty:
 *
 *  - reakce vzniká rovnou jako `sent` (formulář = jediný krok, main flow bod 2);
 *  - stav se mění VÝHRADNĚ přes stavový automat (`state-machine.ts`);
 *  - `viewed` se nastaví automaticky při prvním načtení seznamu vlastníkem
 *    (`listResponsesForRequest`), ne samostatnou akcí;
 *  - přijetí reakce posune poptávku do `in_discussion` (best-effort — druhá
 *    přijatá reakce na tutéž poptávku už jen no-opne, T024 § Edge cases —
 *    „klient přijme více nabídek");
 *  - významné přechody se auditují (append-only `RequestResponseAuditEntry`).
 */

const responseInclude = {
  portfolioItems: {
    include: {
      portfolioProject: { select: { id: true, title: true, slug: true } },
    },
  },
} satisfies Prisma.RequestResponseInclude;

type ResponseRow = Prisma.RequestResponseGetPayload<{
  include: typeof responseInclude;
}>;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Autor z polymorfních sloupců. CHECK v migraci zaručuje právě jeden vyplněný. */
export function authorRefOf(row: {
  authorUserId: string | null;
  authorOrgId: string | null;
}): ResponseAuthorRef {
  if (row.authorUserId) return { type: "user", userId: row.authorUserId };
  return { type: "organization", orgId: row.authorOrgId! };
}

function toView(row: ResponseRow): ResponseView {
  return {
    id: row.id,
    requestId: row.requestId,
    author: authorRefOf(row),
    status: row.status as ResponseStatus,
    message: row.message,
    priceModel: row.priceModel,
    priceNote: row.priceNote,
    availability: row.availability,
    rejectionReason: row.rejectionReason,
    viewedAt: row.viewedAt ? row.viewedAt.toISOString() : null,
    portfolioItems: row.portfolioItems.map((item) => ({
      id: item.portfolioProject.id,
      title: item.portfolioProject.title,
      slug: item.portfolioProject.slug,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Firemní členství (stejný vzor jako `features/portfolio/queries.ts`) ----

export type OrgMembership = { isMember: boolean; isEditor: boolean };

let orgMembershipResolver: (
  orgId: string,
  userId: string,
) => Promise<OrgMembership> = async (orgId, userId) => {
  const role = await getMembershipRole(orgId, userId);
  return { isMember: role !== null, isEditor: roleAtLeast(role, "editor") };
};

/** Testy si můžou zjištění firemní role actora podvrhnout. */
export function __setOrgMembershipResolver(
  resolver: (orgId: string, userId: string) => Promise<OrgMembership>,
): void {
  orgMembershipResolver = resolver;
}

/** Firemní role actora v organizaci (přes resolver, ať jde v testech podvrhnout). */
export function resolveOrgMembership(
  orgId: string,
  userId: string,
): Promise<OrgMembership> {
  return orgMembershipResolver(orgId, userId);
}

// --- Autor: zobrazované jméno -------------------------------------------------

/** Zobrazované jméno autora — headline profesionála, nebo název firmy. */
async function resolveAuthorSummary(
  author: ResponseAuthorRef,
): Promise<ResponseAuthorSummary> {
  if (author.type === "user") {
    const profile = await db.professionalProfile.findUnique({
      where: { userId: author.userId },
      select: { headline: true },
    });
    return { ref: author, displayName: profile?.headline?.trim() || "Profesionál" };
  }
  const org = await db.organization.findUnique({
    where: { id: author.orgId },
    select: { name: true },
  });
  return { ref: author, displayName: org?.name ?? "Firma" };
}

// --- Založení reakce ---------------------------------------------------------

export type CreateResponseResult =
  | { ok: true; view: ResponseView }
  | {
      ok: false;
      reason: "request_not_found" | "duplicate" | "invalid_portfolio_items";
    };

/** Ověří, že všechny ID patří AUTOROVI a jsou `published` (§ Validation). */
async function validatePortfolioOwnership(
  author: ResponseAuthorRef,
  portfolioProjectIds: string[],
): Promise<boolean> {
  if (portfolioProjectIds.length === 0) return true;
  const rows = await db.portfolioProject.findMany({
    where: {
      id: { in: portfolioProjectIds },
      status: "published",
      ...(author.type === "user"
        ? { ownerUserId: author.userId }
        : { ownerOrgId: author.orgId }),
    },
    select: { id: true },
  });
  return rows.length === portfolioProjectIds.length;
}

/**
 * Založí reakci rovnou jako `sent` (main flow bod 2 — jeden formulář, žádný
 * samostatný draft krok v MVP). Jedna reakce per autor per poptávka — DB
 * unikát je poslední pojistka, zde nejdřív přátelský pre-check.
 */
export async function createResponse(params: {
  requestId: string;
  author: ResponseAuthorRef;
  actorUserId: string;
  input: ParsedResponseInput;
}): Promise<CreateResponseResult> {
  const request = await db.request.findUnique({
    where: { id: params.requestId },
    select: { id: true, ownerUserId: true },
  });
  if (!request) return { ok: false, reason: "request_not_found" };

  const existing = await db.requestResponse.findFirst({
    where: {
      requestId: params.requestId,
      ...(params.author.type === "user"
        ? { authorUserId: params.author.userId }
        : { authorOrgId: params.author.orgId }),
    },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "duplicate" };

  const portfolioOk = await validatePortfolioOwnership(
    params.author,
    params.input.portfolioProjectIds,
  );
  if (!portfolioOk) return { ok: false, reason: "invalid_portfolio_items" };

  try {
    const created = await db.requestResponse.create({
      data: {
        requestId: params.requestId,
        authorUserId: params.author.type === "user" ? params.author.userId : null,
        authorOrgId:
          params.author.type === "organization" ? params.author.orgId : null,
        status: "sent",
        message: params.input.message,
        priceModel: params.input.priceModel,
        priceNote: params.input.priceNote,
        availability: params.input.availability,
        portfolioItems: {
          create: params.input.portfolioProjectIds.map((id) => ({
            portfolioProjectId: id,
          })),
        },
      },
      include: responseInclude,
    });

    trackEvent("response_sent", {
      requestId: params.requestId,
      responseId: created.id,
    });

    // Best-effort (T032): vlastník poptávky se dozví o nové reakci.
    await emit({
      eventType: "new_response",
      recipientUserId: request.ownerUserId,
      actorUserId: params.actorUserId,
      title: "Nová reakce na poptávku",
      reason: "Profesionál zareagoval na vaši poptávku.",
      link: `/requests/${params.requestId}`,
      context: { type: "request", id: params.requestId },
    });

    return { ok: true, view: toView(created) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

// --- Editace (dokud `sent`) --------------------------------------------------

export type UpdateResponseResult =
  | { ok: true; view: ResponseView }
  | {
      ok: false;
      reason: "not_found" | "not_editable" | "invalid_portfolio_items";
    };

/**
 * Upraví reakci, dokud je `sent` (main flow bod 4 — „editovatelná dokud
 * `sent`, pak jen withdraw"). Přepíše přiložené portfolio položky vcelku
 * (nahraď vše, stejný princip jako `PortfolioBlock` v T013).
 */
export async function updateResponse(
  responseId: string,
  author: ResponseAuthorRef,
  input: ParsedResponseInput,
): Promise<UpdateResponseResult> {
  const row = await db.requestResponse.findUnique({ where: { id: responseId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "sent") return { ok: false, reason: "not_editable" };

  const portfolioOk = await validatePortfolioOwnership(
    author,
    input.portfolioProjectIds,
  );
  if (!portfolioOk) return { ok: false, reason: "invalid_portfolio_items" };

  const updated = await db.$transaction(async (tx) => {
    await tx.requestResponsePortfolioItem.deleteMany({
      where: { responseId },
    });
    return tx.requestResponse.update({
      where: { id: responseId },
      data: {
        message: input.message,
        priceModel: input.priceModel,
        priceNote: input.priceNote,
        availability: input.availability,
        portfolioItems: {
          create: input.portfolioProjectIds.map((id) => ({
            portfolioProjectId: id,
          })),
        },
      },
      include: responseInclude,
    });
  });

  return { ok: true, view: toView(updated) };
}

// --- Přiložitelné portfolio projekty ------------------------------------------

export interface PortfolioItemOption {
  id: string;
  title: string;
}

/** Vlastní `published` portfolio projekty autora — nabídka k přiložení (main flow bod 2). */
export async function listOwnPublishedPortfolioItems(
  author: ResponseAuthorRef,
): Promise<PortfolioItemOption[]> {
  return db.portfolioProject.findMany({
    where: {
      status: "published",
      ...(author.type === "user"
        ? { ownerUserId: author.userId }
        : { ownerOrgId: author.orgId }),
    },
    select: { id: true, title: true },
    orderBy: { publishedAt: "desc" },
  });
}

// --- Čtení --------------------------------------------------------------------

export interface ResponseWithRequestMeta {
  view: ResponseView;
  requestOwnerUserId: string;
  requestStatus: RequestStatus;
}

/** Načte reakci + fakta o poptávce (pro permission vrstvu volajícího). */
export async function getResponseById(
  responseId: string,
): Promise<ResponseWithRequestMeta | null> {
  const row = await db.requestResponse.findUnique({
    where: { id: responseId },
    include: { ...responseInclude, request: { select: { ownerUserId: true, status: true } } },
  });
  if (!row) return null;
  return {
    view: toView(row),
    requestOwnerUserId: row.request.ownerUserId,
    requestStatus: row.request.status as RequestStatus,
  };
}

/** Reakce autora (uživatele) na danou poptávku, pokud existuje. */
export async function getResponseForAuthor(
  requestId: string,
  author: ResponseAuthorRef,
): Promise<ResponseView | null> {
  const row = await db.requestResponse.findFirst({
    where: {
      requestId,
      ...(author.type === "user"
        ? { authorUserId: author.userId }
        : { authorOrgId: author.orgId }),
    },
    include: responseInclude,
  });
  return row ? toView(row) : null;
}

/**
 * Reakce na poptávce pro VLASTNÍKA (main flow bod 5). Nastaví `viewed` u
 * dosud `sent` reakcí — jen při prvním zobrazení VLASTNÍKEM (main flow bod 3).
 * Detail smí číst i admin (`canReadRequest`) — jeho čtení ale „zobrazení
 * vlastníkem" není, takže přechod (ani notifikaci autorovi) nespouští.
 */
export async function listResponsesForRequest(
  requestId: string,
  viewerUserId: string,
): Promise<ResponseListItemForOwner[]> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { ownerUserId: true },
  });
  const rows = await db.requestResponse.findMany({
    where: { requestId },
    include: responseInclude,
    orderBy: { createdAt: "desc" },
  });

  const isOwner = request !== null && request.ownerUserId === viewerUserId;
  const current = isOwner
    ? await Promise.all(rows.map((row) => markViewedIfDue(row, viewerUserId)))
    : rows;

  return Promise.all(
    current.map(async (row) => ({
      ...toView(row),
      authorSummary: await resolveAuthorSummary(authorRefOf(row)),
    })),
  );
}

/** Reakce podané daným uživatelem (dashboard „moje reakce", main flow bod 7). */
export async function listResponsesForAuthorUser(
  userId: string,
): Promise<ResponseListItemForAuthor[]> {
  const rows = await db.requestResponse.findMany({
    where: { authorUserId: userId },
    include: { ...responseInclude, request: { select: { title: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    ...toView(row),
    requestTitle: row.request.title,
    requestStatus: row.request.status,
  }));
}

/** Auditní historie reakce (nejnovější první). */
export async function listResponseAudit(
  responseId: string,
): Promise<ResponseAuditItem[]> {
  const rows = await db.requestResponseAuditEntry.findMany({
    where: { responseId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    fromStatus: (r.fromStatus as ResponseStatus | null) ?? null,
    toStatus: r.toStatus as ResponseStatus,
    actorUserId: r.actorUserId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// --- Stavové přechody ---------------------------------------------------------

export type TransitionResponseResult =
  | { ok: true; view: ResponseView }
  | { ok: false; reason: "not_found" | "invalid_transition" };

/** Notifikační eventy pro přechody iniciované vlastníkem (T032 katalog). */
const OWNER_TRANSITION_NOTIFICATIONS: Partial<Record<ResponseAction, string>> = {
  mark_viewed: "response_viewed",
  shortlist: "shortlisted",
  accept: "response_accepted",
  reject: "response_rejected",
};

const NOTIFY_COPY: Partial<Record<ResponseAction, { title: string; reason: string }>> = {
  mark_viewed: {
    title: "Reakce zobrazena",
    reason: "Vlastník poptávky zobrazil vaši reakci.",
  },
  shortlist: {
    title: "Reakce na užším seznamu",
    reason: "Vlastník poptávky zařadil vaši reakci na užší seznam.",
  },
  accept: {
    title: "Reakce přijata",
    reason: "Vlastník poptávky přijal vaši reakci.",
  },
  reject: {
    title: "Reakce odmítnuta",
    reason: "Vlastník poptávky odmítl vaši reakci.",
  },
};

/** Analytické eventy pro přechody (§ Analytics — jména dle tasku). */
const TRANSITION_EVENTS: Partial<Record<ResponseAction, AnalyticsEvent>> = {
  mark_viewed: "response_viewed",
  shortlist: "response_shortlisted",
  accept: "response_accepted",
  reject: "response_rejected",
};

/**
 * Provede stavový přechod přes automat. `null` z `nextResponseStatus` =
 * neplatný přechod → server odmítne. Oprávnění ověřuje volající (akce).
 */
export async function transitionResponse(params: {
  responseId: string;
  action: ResponseAction;
  actorUserId: string | null;
  rejectionReason?: string | null;
}): Promise<TransitionResponseResult> {
  const row = await db.requestResponse.findUnique({
    where: { id: params.responseId },
    include: responseInclude,
  });
  if (!row) return { ok: false, reason: "not_found" };

  const from = row.status as ResponseStatus;
  const to = nextResponseStatus(from, params.action);
  if (to === null) return { ok: false, reason: "invalid_transition" };

  const data: Prisma.RequestResponseUpdateInput = { status: to };
  if (params.action === "mark_viewed") data.viewedAt = new Date();
  if (params.action === "reject" && params.rejectionReason !== undefined) {
    data.rejectionReason = params.rejectionReason;
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.requestResponse.update({
      where: { id: params.responseId },
      data,
      include: responseInclude,
    });
    if (isAuditedResponseAction(params.action)) {
      await tx.requestResponseAuditEntry.create({
        data: {
          responseId: params.responseId,
          actorUserId: params.actorUserId,
          action: params.action,
          fromStatus: from,
          toStatus: to,
        },
      });
    }
    return next;
  });

  const event = TRANSITION_EVENTS[params.action];
  if (event) {
    trackEvent(event, { responseId: params.responseId, from, to });
  }

  if (params.action === "accept") {
    // Přijetí reakce posune poptávku do jednání (main flow bod 5, napojení na
    // T024 přechody). Best-effort a NIKDY nevyhodí: `transitionRequest` vrací
    // `{ ok: false }` (nevyhazuje) na neplatný přechod — druhá přijatá reakce
    // na tutéž poptávku (poptávka už `in_discussion`) prostě no-opne (zadani/09
    // — „klient přijme více nabídek"). Vlastník pak `awarded` zvolí sám
    // existujícím tlačítkem na detailu poptávky (T024).
    await transitionRequest({
      requestId: row.requestId,
      action: "start_discussion",
      actorUserId: params.actorUserId,
    });
  }

  const notifyEvent = OWNER_TRANSITION_NOTIFICATIONS[params.action];
  const author = authorRefOf(row);
  if (notifyEvent && author.type === "user") {
    const copy = NOTIFY_COPY[params.action]!;
    await emit({
      eventType: notifyEvent,
      recipientUserId: author.userId,
      actorUserId: params.actorUserId ?? undefined,
      title: copy.title,
      reason: copy.reason,
      link: `/poptavka/${row.requestId}`,
      context: { type: "request_response", id: row.id },
    });
  }

  return { ok: true, view: toView(updated) };
}

/** Nastaví `viewed`, je-li reakce dosud `sent` (main flow bod 3). Idempotentní. */
async function markViewedIfDue(
  row: ResponseRow,
  viewerUserId: string,
): Promise<ResponseRow> {
  if (row.status !== "sent") return row;
  const result = await transitionResponse({
    responseId: row.id,
    action: "mark_viewed",
    actorUserId: viewerUserId,
  });
  if (!result.ok) return row;
  const fresh = await db.requestResponse.findUnique({
    where: { id: row.id },
    include: responseInclude,
  });
  return fresh ?? row;
}
