import { z } from "zod";
import {
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  PORTFOLIO_PROJECT_TYPES,
  PORTFOLIO_VISIBILITIES,
  TITLE_MAX_LENGTH,
  YEAR_MIN,
} from "./types";
import { yearMax } from "./rules";

/**
 * Validace vstupů portfolia (T012). Povinný je jen titul (T012 § Validation);
 * ostatní metadata jsou volitelná a vznikají postupně. Rok se hlídá proti
 * rozumnému rozsahu. Prázdné hodnoty jsou validní a neblokují flow.
 */

/** Prázdný string → undefined; jinak ořízne okraje. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

const titleField = z
  .string()
  .trim()
  .min(1, "Zadejte název díla.")
  .max(TITLE_MAX_LENGTH);

/** Rok jako volitelné číslo v rozumném rozsahu. */
const yearField = z
  .number()
  .int("Rok musí být celé číslo.")
  .min(YEAR_MIN, `Rok musí být ${YEAR_MIN} nebo novější.`)
  .max(yearMax(), `Rok nesmí být z daleké budoucnosti.`)
  .nullish();

// --- Založení dílo ----------------------------------------------------------

/** Založení projektu. Vlastník se určuje ze serveru (actor / org kontext). */
export const createPortfolioSchema = z.object({
  title: titleField,
  /** Cílová organizace-vlastník; bez ní vzniká dílo vlastněné uživatelem. */
  ownerOrgId: z.string().min(1).optional(),
});
export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

// --- Editace metadat --------------------------------------------------------

export const updatePortfolioSchema = z.object({
  title: titleField,
  projectType: z.enum(PORTFOLIO_PROJECT_TYPES).nullish(),
  location: optionalText(LOCATION_MAX_LENGTH),
  year: yearField,
  description: optionalText(DESCRIPTION_MAX_LENGTH),
  visibility: z.enum(PORTFOLIO_VISIBILITIES).default("public"),
});
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

// --- Spoluautoři ------------------------------------------------------------

/** Pozvání spoluautora podle e-mailu (musí mít účet — vazba je na userId). */
export const inviteCoauthorSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Zadejte e-mail.")
    .email("Zadejte platný e-mail.")
    .toLowerCase(),
});
export type InviteCoauthorInput = z.infer<typeof inviteCoauthorSchema>;

/** Reakce spoluautora na pozvání. */
export const coauthorResponseSchema = z.object({
  projectId: z.string().min(1),
  response: z.enum(["accept", "decline"]),
});
export type CoauthorResponseInput = z.infer<typeof coauthorResponseSchema>;

/** Cíl akce nad jedním projektem (publish/unpublish/delete). */
export const projectTargetSchema = z.object({
  projectId: z.string().min(1),
});
export type ProjectTargetInput = z.infer<typeof projectTargetSchema>;
