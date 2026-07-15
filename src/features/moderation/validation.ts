import { z } from "zod";
import { REPORT_NOTE_MAX_LENGTH, REPORT_REASONS } from "./types";

/**
 * Validace vstupů nahlašování (T031 § Validation — report vyžaduje důvod z enumu).
 * Popis je volitelný a v limitu délky; prázdný se normalizuje na `undefined`.
 */

/** Volitelný popis reportu (ořízne bílé znaky, prázdný → undefined). */
const note = z
  .string()
  .trim()
  .max(REPORT_NOTE_MAX_LENGTH, `Popis je příliš dlouhý (max ${REPORT_NOTE_MAX_LENGTH} znaků).`)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/** Nahlášení zprávy: cílová zpráva + důvod z enumu + volitelný popis. */
export const reportMessageSchema = z.object({
  messageId: z.string().trim().min(1),
  reason: z.enum(REPORT_REASONS),
  note,
});
export type ReportMessageInput = z.infer<typeof reportMessageSchema>;
