import { z } from "zod";

/**
 * Validace admin CRUD nad taxonomií (T035 § Main flow 4, § Validation).
 * Slug unikátnost řeší service vrstva (DB index je zdroj pravdy).
 */

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Název je příliš krátký.").max(100),
  position: z.coerce.number().int().min(0).default(0),
});

export const professionSchema = z.object({
  name: z.string().trim().min(2, "Název je příliš krátký.").max(100),
  categoryId: z.string().min(1, "Vyberte kategorii."),
  synonyms: z.array(z.string().trim().min(1)).max(20).default([]),
  regulated: z.boolean().default(false),
  verificationHints: z.array(z.string().trim().min(1)).max(10).default([]),
  position: z.coerce.number().int().min(0).default(0),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProfessionInput = z.infer<typeof professionSchema>;
