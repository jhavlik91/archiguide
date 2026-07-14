/**
 * Zod validace vstupů poptávky (T024, § Validation). Čistá vrstva (bez DB) —
 * kontrakt mezi UI formulářem, server akcí a datovou vrstvou.
 *
 * Povinné: ≥1 cílová profese, region, typ. Rozpočet a časový horizont mohou být
 * „neuvedeno" (prázdné → `null`; „nevím" je validní odpověď — nikdy si nic
 * nevymýšlíme, zadani/16 §4).
 */

import { z } from "zod";
import {
  REQUEST_FIELD_MAX_LENGTH,
  REQUEST_TITLE_MAX_LENGTH,
  REQUEST_TYPES,
} from "./types";

/** Prázdný/whitespace řetězec → `null` (jednotné „neuvedeno"). */
const optionalText = z
  .string()
  .trim()
  .max(REQUEST_FIELD_MAX_LENGTH)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .transform((value) => value ?? null);

export const requestInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Název poptávky je povinný.")
    .max(REQUEST_TITLE_MAX_LENGTH),
  type: z.enum(REQUEST_TYPES),
  /** Cílové profese — ≥1 (§ Validation). Prázdné/duplicitní slugy se odfiltrují. */
  targetProfessionSlugs: z
    .array(z.string())
    .transform((slugs) => [
      ...new Set(slugs.map((s) => s.trim()).filter((s) => s.length > 0)),
    ])
    .refine((slugs) => slugs.length >= 1, {
      message: "Vyberte alespoň jednu cílovou profesi.",
    }),
  region: z
    .string()
    .trim()
    .min(1, "Region je povinný.")
    .max(REQUEST_FIELD_MAX_LENGTH),
  budget: optionalText,
  timeline: optionalText,
  /** Termín (ISO datum) nebo `null`. Prázdné → bez termínu (neexpiruje). */
  deadline: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
      message: "Neplatné datum termínu.",
    }),
});

export type RequestInput = z.input<typeof requestInputSchema>;
export type ParsedRequestInput = z.output<typeof requestInputSchema>;
