/**
 * Zod validace vstupů moderace (T036, § Validation). Čistá vrstva (bez DB) —
 * kontrakt mezi UI formulářem, server akcí a datovou vrstvou.
 *
 * Report: důvod musí být z enumu, volitelná poznámka. Moderační akce: typ z
 * enumu a POVINNÝ důvod zásahu (§ acceptance criteria — auditní záznam s
 * důvodem).
 */

import { z } from "zod";
import {
  MODERATION_ACTION_TYPES,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
} from "./types";

const REPORT_NOTE_MAX_LENGTH = 1000;
const ACTION_REASON_MAX_LENGTH = 1000;

export const reportContentSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().trim().min(1, "Chybí ID nahlašovaného obsahu."),
  reason: z.enum(REPORT_REASONS),
  note: z
    .string()
    .trim()
    .max(REPORT_NOTE_MAX_LENGTH)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export type ReportContentInput = z.input<typeof reportContentSchema>;
export type ParsedReportContentInput = z.output<typeof reportContentSchema>;

export const moderationActionSchema = z.object({
  actionType: z.enum(MODERATION_ACTION_TYPES),
  reason: z
    .string()
    .trim()
    .min(5, "Uveďte důvod akce (alespoň pár slov).")
    .max(ACTION_REASON_MAX_LENGTH),
});

export type ModerationActionInput = z.input<typeof moderationActionSchema>;
export type ParsedModerationActionInput = z.output<
  typeof moderationActionSchema
>;
