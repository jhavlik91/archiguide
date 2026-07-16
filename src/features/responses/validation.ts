/**
 * Zod validace vstupů reakce na poptávku (T027, § Validation). Čistá vrstva
 * (bez DB) — kontrakt mezi formulářem, server akcí a datovou vrstvou.
 *
 * Povinná je jen zpráva (§ Validation — „zpráva povinná"); cenový model,
 * poznámka k ceně a dostupnost jsou nepovinné (main flow bod 2 je nabízí, ale
 * validace je nevyžaduje — stejný princip „nevím je validní" jako u poptávky).
 * Přiložené portfolio projekty se validují na vlastnictví a `published` stav
 * až v `service.ts` (potřebují DB), tady jen na tvar a horní limit počtu.
 */

import { z } from "zod";
import { PRICING_MODELS } from "@/features/profiles/types";
import {
  RESPONSE_FIELD_MAX_LENGTH,
  RESPONSE_MAX_PORTFOLIO_ITEMS,
  RESPONSE_MESSAGE_MAX_LENGTH,
} from "./types";

/** Prázdný/whitespace řetězec → `null` (jednotné „neuvedeno"). */
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .transform((value) => value ?? null);

/** Prázdný výběr ceny (placeholder `""`) → `null` (nevyplněno je validní). */
const optionalPriceModel = z
  .union([z.enum(PRICING_MODELS), z.literal("")])
  .nullable()
  .transform((value) => (value === "" || value == null ? null : value));

export const responseInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Zpráva je povinná.")
    .max(RESPONSE_MESSAGE_MAX_LENGTH),
  priceModel: optionalPriceModel,
  priceNote: optionalText(RESPONSE_FIELD_MAX_LENGTH),
  availability: optionalText(RESPONSE_FIELD_MAX_LENGTH),
  /** Vlastní `published` portfolio projekty k přiložení. Duplicity se odfiltrují. */
  portfolioProjectIds: z
    .array(z.string())
    .transform((ids) => [
      ...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)),
    ])
    .refine((ids) => ids.length <= RESPONSE_MAX_PORTFOLIO_ITEMS, {
      message: `Lze přiložit nejvýše ${RESPONSE_MAX_PORTFOLIO_ITEMS} projektů.`,
    }),
});

export type ResponseInput = z.input<typeof responseInputSchema>;
export type ParsedResponseInput = z.output<typeof responseInputSchema>;

/** Volitelný důvod odmítnutí (main flow bod 6) — prázdný → `null`. */
export const responseRejectSchema = z.object({
  reason: optionalText(RESPONSE_FIELD_MAX_LENGTH),
});

export type ResponseRejectInput = z.input<typeof responseRejectSchema>;
export type ParsedResponseRejectInput = z.output<typeof responseRejectSchema>;
