/**
 * Sdílené typy a číselníky hodnocení (T037).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (`ReviewStatus`) — jsou jediným
 * zdrojem pro Zod validaci (`validation.ts`), stavový automat
 * (`state-machine.ts`) i UI popisky. Modul je čistý (bez DB / `next/*`), aby ho
 * šlo použít i v klientských komponentách (formulář hodnocení, karta recenze).
 */

export const REVIEW_STATUSES = ["published", "disputed", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  published: "Zveřejněná",
  disputed: "Rozporovaná",
  hidden: "Skrytá",
};

/** Kritéria hodnocení (§36.2), v pořadí zobrazení. */
export const REVIEW_CRITERIA = [
  "communication",
  "quality",
  "timeliness",
  "transparency",
  "professionalism",
] as const;
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];

export const REVIEW_CRITERION_LABELS: Record<ReviewCriterion, string> = {
  communication: "Komunikace",
  quality: "Kvalita",
  timeliness: "Termíny",
  transparency: "Transparentnost",
  professionalism: "Profesionalita",
};

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

export const REVIEW_TEXT_MAX_LENGTH = 2000;
export const REVIEW_REPLY_MAX_LENGTH = 2000;
export const REVIEW_DISPUTE_REASON_MAX_LENGTH = 1000;

/** Krátké okno pro editaci vlastní recenze bez zámku (main flow bod 3). */
export const REVIEW_EDIT_WINDOW_HOURS = 24;

/** Hodnocení per kritérium, škála {@link REVIEW_RATING_MIN}–{@link REVIEW_RATING_MAX}. */
export type ReviewRatings = Record<ReviewCriterion, number>;

// --- Cíl recenze (profesionál NEBO firma) -----------------------------------

export type ReviewTargetRef =
  | { type: "professional"; userId: string }
  | { type: "organization"; orgId: string };

/** Zobrazované jméno cíle (headline profesionála, nebo název firmy). */
export interface ReviewTargetSummary {
  ref: ReviewTargetRef;
  displayName: string;
}

// --- Náhledy pro UI ----------------------------------------------------------

/** Kompletní náhled recenze. */
export interface ReviewView {
  id: string;
  reviewerUserId: string | null;
  /** Headline/jméno recenzenta, nebo „bývalý uživatel" po smazání účtu. */
  reviewerDisplayName: string;
  target: ReviewTargetRef;
  evidenceResponseId: string;
  ratings: ReviewRatings;
  text: string | null;
  status: ReviewStatus;
  replyText: string | null;
  repliedAt: string | null;
  disputeReason: string | null;
  disputedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Průměr per kritérium + celkový průměr + počet recenzí (veřejné zobrazení). */
export interface ReviewAggregate {
  count: number;
  overallAverage: number | null;
  criteriaAverages: Record<ReviewCriterion, number | null>;
}

/** Nabídka k ohodnocení (main flow bod 2) — accepted interakce bez recenze. */
export interface EligibleReviewItem {
  responseId: string;
  requestId: string;
  requestTitle: string;
  target: ReviewTargetSummary;
  acceptedAt: string;
}

/** Badge text — vysvětluje původ hodnocení (zadani/12 §3, main flow bod 7). */
export const REVIEW_BADGE_TEXT = "Hodnocení z ověřených spoluprací";
