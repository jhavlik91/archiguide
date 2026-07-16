/**
 * Zod validace vstupů hodnocení (T037, § Validation). Čistá vrstva (bez DB) —
 * kontrakt mezi formulářem, server akcí a datovou vrstvou.
 *
 * Všechna kritéria jsou POVINNÁ (§ Validation — „všechna kritéria povinná"),
 * text je volitelný s max délkou. Evidence (accepted interakce, vlastnictví)
 * se validuje až v `service.ts` (potřebuje DB).
 */

import { z } from "zod";
import {
  REVIEW_CRITERIA,
  REVIEW_DISPUTE_REASON_MAX_LENGTH,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_REPLY_MAX_LENGTH,
  REVIEW_TEXT_MAX_LENGTH,
} from "./types";

const ratingSchema = z
  .number()
  .int()
  .min(REVIEW_RATING_MIN, `Hodnocení musí být alespoň ${REVIEW_RATING_MIN}.`)
  .max(REVIEW_RATING_MAX, `Hodnocení může být nejvýše ${REVIEW_RATING_MAX}.`);

const ratingsShape = Object.fromEntries(
  REVIEW_CRITERIA.map((criterion) => [criterion, ratingSchema]),
) as Record<(typeof REVIEW_CRITERIA)[number], typeof ratingSchema>;

/** Prázdný/whitespace text → `null` (nepovinné pole je validně prázdné). */
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .transform((value) => value ?? null);

export const reviewInputSchema = z.object({
  ratings: z.object(ratingsShape),
  text: optionalText(REVIEW_TEXT_MAX_LENGTH),
});

export type ReviewInput = z.input<typeof reviewInputSchema>;
export type ParsedReviewInput = z.output<typeof reviewInputSchema>;

/** Odpověď hodnoceného (§36.3 — právo na reakci). Povinný text. */
export const reviewReplySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Odpověď nemůže být prázdná.")
    .max(REVIEW_REPLY_MAX_LENGTH),
});

export type ReviewReplyInput = z.input<typeof reviewReplySchema>;
export type ParsedReviewReplyInput = z.output<typeof reviewReplySchema>;

/** Spor hodnoceného (main flow bod 6) — důvod je povinný ("s důvodem"). */
export const reviewDisputeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Uveďte důvod sporu (alespoň pár slov).")
    .max(REVIEW_DISPUTE_REASON_MAX_LENGTH),
});

export type ReviewDisputeInput = z.input<typeof reviewDisputeSchema>;
export type ParsedReviewDisputeInput = z.output<typeof reviewDisputeSchema>;
