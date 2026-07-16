import "server-only";

import { Prisma, type Review } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { emit } from "@/lib/notifications";
import { reportContent } from "@/features/moderation/service";
import { isPubliclyVisible, nextReviewStatus } from "./state-machine";
import type {
  EligibleReviewItem,
  ReviewAggregate,
  ReviewCriterion,
  ReviewRatings,
  ReviewStatus,
  ReviewTargetRef,
  ReviewTargetSummary,
  ReviewView,
} from "./types";
import { REVIEW_CRITERIA, REVIEW_EDIT_WINDOW_HOURS } from "./types";
import type { ParsedReviewInput } from "./validation";

/**
 * Datová vrstva hodnocení (T037). Jediné místo sahající na `db.review`.
 * Nepočítá s oprávněními (ta řeší `actions.ts` přes permission vrstvu) —
 * vynucuje ale doménové invarianty:
 *
 *  - recenzi lze založit jen nad `accepted` interakcí, kterou vlastní
 *    recenzent (§ Preconditions);
 *  - jedna recenze per interakce (DB unikát na `evidenceResponseId` je
 *    poslední pojistka nad TOCTOU race);
 *  - stav se mění VÝHRADNĚ přes stavový automat (`state-machine.ts`);
 *  - skrytá recenze se vyřadí z průměru i veřejného výpisu.
 */

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Cíl z polymorfních sloupců. CHECK v migraci zaručuje právě jeden vyplněný. */
function targetRefOf(row: {
  targetUserId: string | null;
  targetOrgId: string | null;
}): ReviewTargetRef {
  if (row.targetUserId)
    return { type: "professional", userId: row.targetUserId };
  return { type: "organization", orgId: row.targetOrgId! };
}

/** Cíl recenze = autor accepted reakce (RequestResponse.author*). */
function targetRefFromResponse(response: {
  authorUserId: string | null;
  authorOrgId: string | null;
}): ReviewTargetRef {
  if (response.authorUserId) {
    return { type: "professional", userId: response.authorUserId };
  }
  return { type: "organization", orgId: response.authorOrgId! };
}

function ratingsOf(row: Review): ReviewRatings {
  return {
    communication: row.ratingCommunication,
    quality: row.ratingQuality,
    timeliness: row.ratingTimeliness,
    transparency: row.ratingTransparency,
    professionalism: row.ratingProfessionalism,
  };
}

async function resolveReviewerDisplayName(
  reviewerUserId: string | null,
): Promise<string> {
  if (!reviewerUserId) return "Bývalý uživatel";
  const profile = await db.professionalProfile.findUnique({
    where: { userId: reviewerUserId },
    select: { headline: true },
  });
  return profile?.headline?.trim() || "Klient";
}

async function toView(row: Review): Promise<ReviewView> {
  return {
    id: row.id,
    reviewerUserId: row.reviewerUserId,
    reviewerDisplayName: await resolveReviewerDisplayName(row.reviewerUserId),
    target: targetRefOf(row),
    evidenceResponseId: row.evidenceResponseId,
    ratings: ratingsOf(row),
    text: row.text,
    status: row.status as ReviewStatus,
    replyText: row.replyText,
    repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
    disputeReason: row.disputeReason,
    disputedAt: row.disputedAt ? row.disputedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Zobrazované jméno cíle — headline profesionála, nebo název firmy. */
async function resolveTargetSummary(
  target: ReviewTargetRef,
): Promise<ReviewTargetSummary> {
  if (target.type === "professional") {
    const profile = await db.professionalProfile.findUnique({
      where: { userId: target.userId },
      select: { headline: true },
    });
    return {
      ref: target,
      displayName: profile?.headline?.trim() || "Profesionál",
    };
  }
  const org = await db.organization.findUnique({
    where: { id: target.orgId },
    select: { name: true },
  });
  return { ref: target, displayName: org?.name ?? "Firma" };
}

/** Admini/vlastníci firmy — příjemci notifikace o hodnocení firmy (best-effort). */
async function listOrgAdminUserIds(orgId: string): Promise<string[]> {
  const rows = await db.organizationMember.findMany({
    where: { orgId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Notifikuje cíl recenze (profesionál, nebo admini/owneři firmy). Best-effort. */
async function notifyTarget(params: {
  target: ReviewTargetRef;
  eventType: "review_received" | "review_reply";
  title: string;
  reason: string;
  link: string;
  contextId: string;
}): Promise<void> {
  const recipientUserIds =
    params.target.type === "professional"
      ? [params.target.userId]
      : await listOrgAdminUserIds(params.target.orgId);

  await Promise.all(
    recipientUserIds.map((recipientUserId) =>
      emit({
        eventType: params.eventType,
        recipientUserId,
        title: params.title,
        reason: params.reason,
        link: params.link,
        context: { type: "review", id: params.contextId },
      }),
    ),
  );
}

// --- Eligibilita ---------------------------------------------------------

export type EligibilityResult =
  | {
      ok: true;
      requestId: string;
      requestOwnerUserId: string;
      requestTitle: string;
      target: ReviewTargetRef;
    }
  | {
      ok: false;
      reason: "response_not_found" | "not_accepted" | "already_reviewed";
    };

/**
 * Ověří eligibilitu recenze nad danou interakcí (§ Preconditions — „reakce
 * profesionála ve stavu accepted"). Volá se před `canCreateReview` (permission
 * subject) i znovu v `createReview` (obrana proti TOCTOU race).
 */
export async function checkEligibility(
  responseId: string,
): Promise<EligibilityResult> {
  const response = await db.requestResponse.findUnique({
    where: { id: responseId },
    include: {
      request: { select: { id: true, ownerUserId: true, title: true } },
      review: { select: { id: true } },
    },
  });
  if (!response) return { ok: false, reason: "response_not_found" };
  if (response.status !== "accepted")
    return { ok: false, reason: "not_accepted" };
  if (response.review) return { ok: false, reason: "already_reviewed" };

  return {
    ok: true,
    requestId: response.request.id,
    requestOwnerUserId: response.request.ownerUserId,
    requestTitle: response.request.title,
    target: targetRefFromResponse(response),
  };
}

/**
 * Nabídka k ohodnocení (main flow bod 2 — „systém nabídne hodnocení po
 * accepted, a při uzavření poptávky"). Vrací accepted interakce vlastníka bez
 * recenze; UI (CTA na detailu poptávky) se zobrazuje bez ohledu na aktuální
 * stav poptávky, dokud recenze chybí — pokrývá i moment uzavření.
 */
export async function listEligibleReviews(
  reviewerUserId: string,
): Promise<EligibleReviewItem[]> {
  const rows = await db.requestResponse.findMany({
    where: {
      status: "accepted",
      review: null,
      request: { ownerUserId: reviewerUserId },
    },
    include: { request: { select: { id: true, title: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return Promise.all(
    rows.map(async (row) => ({
      responseId: row.id,
      requestId: row.request.id,
      requestTitle: row.request.title,
      target: await resolveTargetSummary(targetRefFromResponse(row)),
      acceptedAt: row.updatedAt.toISOString(),
    })),
  );
}

// --- Založení recenze ------------------------------------------------------

export type CreateReviewResult =
  | { ok: true; view: ReviewView }
  | {
      ok: false;
      reason:
        | "response_not_found"
        | "not_accepted"
        | "already_reviewed"
        | "duplicate";
    };

/** Založí recenzi nad accepted interakcí (main flow bod 1–2). Vzniká rovnou `published`. */
export async function createReview(params: {
  evidenceResponseId: string;
  reviewerUserId: string;
  input: ParsedReviewInput;
}): Promise<CreateReviewResult> {
  const eligibility = await checkEligibility(params.evidenceResponseId);
  if (!eligibility.ok) return eligibility;
  if (eligibility.requestOwnerUserId !== params.reviewerUserId) {
    return { ok: false, reason: "not_accepted" };
  }

  const target = eligibility.target;

  try {
    const created = await db.review.create({
      data: {
        reviewerUserId: params.reviewerUserId,
        targetUserId: target.type === "professional" ? target.userId : null,
        targetOrgId: target.type === "organization" ? target.orgId : null,
        evidenceResponseId: params.evidenceResponseId,
        ratingCommunication: params.input.ratings.communication,
        ratingQuality: params.input.ratings.quality,
        ratingTimeliness: params.input.ratings.timeliness,
        ratingTransparency: params.input.ratings.transparency,
        ratingProfessionalism: params.input.ratings.professionalism,
        text: params.input.text,
        status: "published",
      },
    });

    trackEvent("review_submitted", {
      reviewId: created.id,
      evidenceResponseId: params.evidenceResponseId,
    });

    await notifyTarget({
      target,
      eventType: "review_received",
      title: "Nové hodnocení",
      reason: "Klient vás ohodnotil po dokončené spolupráci.",
      link: await targetPublicLink(target),
      contextId: created.id,
    });

    return { ok: true, view: await toView(created) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

/** Odkaz na veřejnou stránku cíle (pro notifikaci) — fallback na správu, chybí-li slug. */
async function targetPublicLink(target: ReviewTargetRef): Promise<string> {
  if (target.type === "professional") {
    const profile = await db.professionalProfile.findUnique({
      where: { userId: target.userId },
      select: { slug: true },
    });
    return profile?.slug ? `/profesional/${profile.slug}` : "/profile";
  }
  const org = await db.organization.findUnique({
    where: { id: target.orgId },
    select: { slug: true },
  });
  return org?.slug ? `/firma/${org.slug}` : "/organizations";
}

// --- Editace (24h okno) -----------------------------------------------------

export type UpdateReviewResult =
  | { ok: true; view: ReviewView }
  | { ok: false; reason: "not_found" | "not_editable" };

/** Je recenze ještě editovatelná (main flow bod 3 — 24h od odeslání, jen `published`)? */
export function isReviewEditable(review: {
  status: ReviewStatus;
  createdAt: Date;
}): boolean {
  if (review.status !== "published") return false;
  const ageMs = Date.now() - review.createdAt.getTime();
  return ageMs <= REVIEW_EDIT_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Upraví recenzi, dokud je v 24h okně (main flow bod 3). Vždy z originálu. */
export async function updateReview(
  reviewId: string,
  reviewerUserId: string,
  input: ParsedReviewInput,
): Promise<UpdateReviewResult> {
  const row = await db.review.findUnique({ where: { id: reviewId } });
  if (!row || row.reviewerUserId !== reviewerUserId) {
    return { ok: false, reason: "not_found" };
  }
  if (!isReviewEditable(row)) return { ok: false, reason: "not_editable" };

  const updated = await db.review.update({
    where: { id: reviewId },
    data: {
      ratingCommunication: input.ratings.communication,
      ratingQuality: input.ratings.quality,
      ratingTimeliness: input.ratings.timeliness,
      ratingTransparency: input.ratings.transparency,
      ratingProfessionalism: input.ratings.professionalism,
      text: input.text,
    },
  });

  return { ok: true, view: await toView(updated) };
}

// --- Čtení -------------------------------------------------------------------

export interface ReviewWithMeta {
  view: ReviewView;
  reviewerUserId: string | null;
}

export async function getReviewById(
  reviewId: string,
): Promise<ReviewWithMeta | null> {
  const row = await db.review.findUnique({ where: { id: reviewId } });
  if (!row) return null;
  return { view: await toView(row), reviewerUserId: row.reviewerUserId };
}

export async function getReviewForResponse(
  responseId: string,
): Promise<ReviewView | null> {
  const row = await db.review.findUnique({
    where: { evidenceResponseId: responseId },
  });
  return row ? toView(row) : null;
}

type RatedRow = Pick<
  Review,
  | "status"
  | "ratingCommunication"
  | "ratingQuality"
  | "ratingTimeliness"
  | "ratingTransparency"
  | "ratingProfessionalism"
>;

function ratingFor(row: RatedRow, criterion: ReviewCriterion): number {
  switch (criterion) {
    case "communication":
      return row.ratingCommunication;
    case "quality":
      return row.ratingQuality;
    case "timeliness":
      return row.ratingTimeliness;
    case "transparency":
      return row.ratingTransparency;
    case "professionalism":
      return row.ratingProfessionalism;
  }
}

function computeAggregate(rows: readonly RatedRow[]): ReviewAggregate {
  const visible = rows.filter((r) =>
    isPubliclyVisible(r.status as ReviewStatus),
  );
  if (visible.length === 0) {
    return {
      count: 0,
      overallAverage: null,
      criteriaAverages: Object.fromEntries(
        REVIEW_CRITERIA.map((c) => [c, null]),
      ) as Record<ReviewCriterion, number | null>,
    };
  }

  const criteriaAverages = Object.fromEntries(
    REVIEW_CRITERIA.map((c) => {
      const sum = visible.reduce((acc, r) => acc + ratingFor(r, c), 0);
      return [c, Math.round((sum / visible.length) * 10) / 10];
    }),
  ) as Record<ReviewCriterion, number | null>;

  const overallSum = REVIEW_CRITERIA.reduce(
    (acc, c) => acc + (criteriaAverages[c] ?? 0),
    0,
  );
  const overallAverage =
    Math.round((overallSum / REVIEW_CRITERIA.length) * 10) / 10;

  return { count: visible.length, overallAverage, criteriaAverages };
}

/**
 * Veřejný výpis recenzí cíle + agregát (T008/T010 slot). Skrytá se vyřadí
 * z průměru i výpisu (§ acceptance criteria); `disputed` zůstává (main flow
 * bod 6 — „recenze zůstává viditelná s příznakem").
 */
export async function getReviewsForTarget(target: ReviewTargetRef): Promise<{
  aggregate: ReviewAggregate;
  reviews: ReviewView[];
}> {
  const rows = await db.review.findMany({
    where:
      target.type === "professional"
        ? { targetUserId: target.userId }
        : { targetOrgId: target.orgId },
    orderBy: { createdAt: "desc" },
  });

  const aggregate = computeAggregate(rows);
  const visibleRows = rows.filter((r) =>
    isPubliclyVisible(r.status as ReviewStatus),
  );
  const reviews = await Promise.all(visibleRows.map((r) => toView(r)));

  return { aggregate, reviews };
}

// --- Právo na reakci (§36.3) -------------------------------------------------

export type ReplyResult =
  | { ok: true; view: ReviewView }
  | { ok: false; reason: "not_found" | "already_replied" };

/** Připojí JEDNU veřejnou odpověď hodnoceného (main flow bod 5). */
export async function addReply(
  reviewId: string,
  text: string,
): Promise<ReplyResult> {
  const row = await db.review.findUnique({ where: { id: reviewId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.replyText !== null) return { ok: false, reason: "already_replied" };

  const updated = await db.review.update({
    where: { id: reviewId },
    data: { replyText: text, repliedAt: new Date() },
  });

  if (updated.reviewerUserId) {
    await emit({
      eventType: "review_reply",
      recipientUserId: updated.reviewerUserId,
      title: "Odpověď na vaše hodnocení",
      reason: "Hodnocený reagoval na vaši recenzi.",
      link: "/notifications",
      context: { type: "review", id: reviewId },
    });
  }

  return { ok: true, view: await toView(updated) };
}

// --- Spor (main flow bod 6) --------------------------------------------------

export type DisputeResult =
  | { ok: true; view: ReviewView }
  | { ok: false; reason: "not_found" | "invalid_transition" };

/**
 * Formální spor hodnoceného (main flow bod 6). Recenze zůstává viditelná
 * s příznakem `disputed`; případ jde do moderační fronty T036
 * (`ReportTargetType.review`) — moderátor ji ponechá (`published`), nebo
 * skryje (`hidden`) přes `applyModerationAction` (viz `moderation/service.ts`,
 * který nad `review` synchronizuje `Review.status`).
 */
export async function disputeReview(
  reviewId: string,
  disputerUserId: string,
  reason: string,
): Promise<DisputeResult> {
  const row = await db.review.findUnique({ where: { id: reviewId } });
  if (!row) return { ok: false, reason: "not_found" };

  const toStatus = nextReviewStatus(row.status as ReviewStatus, "dispute");
  if (!toStatus) return { ok: false, reason: "invalid_transition" };

  // Sdílená moderační fronta T036 — dedikovaný interní důvod (nikdy z výběru
  // uživatele, viz `GENERIC_REPORT_REASONS` v `moderation/types.ts`). Volá se
  // PŘED zápisem stavu recenze — recenze se nepřepne na `disputed`, pokud se
  // moderační případ nepodařilo otevřít.
  const reported = await reportContent({
    targetType: "review",
    targetId: reviewId,
    reporterUserId: disputerUserId,
    reason: "review_dispute",
    note: reason,
  });
  if (!reported.ok) return { ok: false, reason: "not_found" };

  const updated = await db.review.update({
    where: { id: reviewId },
    data: { status: toStatus, disputeReason: reason, disputedAt: new Date() },
  });

  trackEvent("review_disputed", { reviewId });

  if (updated.reviewerUserId) {
    await emit({
      eventType: "review_disputed",
      recipientUserId: updated.reviewerUserId,
      title: "Vaše hodnocení bylo rozporováno",
      reason: "Hodnocený nesouhlasí s vaší recenzí — případ posoudí moderátor.",
      link: "/notifications",
      context: { type: "review", id: reviewId },
    });
  }

  return { ok: true, view: await toView(updated) };
}

/**
 * NEEXPORTUJE se sem žádná zpětná synchronizace stavu z moderace: rozhodnutí
 * moderátora (`moderation/service.ts` → `applyModerationAction`/
 * `restoreTargetVisibility` nad `targetType: "review"`) sahá na `db.review`
 * PŘÍMO (stejný vzor jako existující sync `Message.moderationState`), aby
 * nevznikl cyklický import `reviews ↔ moderation` (`reviews/service.ts` už
 * importuje `moderation/service.ts` kvůli `reportContent` v `disputeReview`).
 */
