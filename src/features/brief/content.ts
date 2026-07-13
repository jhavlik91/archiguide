/**
 * Zod schéma snapshotu obsahu briefu (T021) — kontrakt mezi generátorem
 * (`generator.ts`), perzistencí (`service.ts`) a náhledem (UI). Čistá vrstva
 * (bez DB / `next/*`).
 *
 * Snapshot se zapisuje do `Brief.content` (JSON). `parseBriefContent` čte zpět
 * bezpečně: nevalidní/starší snapshot neshodí render — vrátí `null` a UI zobrazí
 * jemný fallback (analogicky `parsePortfolioBlocks` u portfolia). `version`
 * umožní budoucí migrace tvaru.
 */

import { z } from "zod";
import type { BriefContent } from "./types";

const professionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  reason: z.string(),
});

const locationSchema = z.object({
  display: z.string(),
  address: z.string().optional(),
  shareAddress: z.boolean(),
});

const budgetSchema = z.object({
  known: z.boolean(),
  display: z.string().min(1),
  scope: z.string().optional(),
});

const detailSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  value: z.string(),
});

const inputsSchema = z.object({
  count: z.number().int().min(0),
  mediaIds: z.array(z.string()),
});

export const briefContentSchema = z.object({
  version: z.literal(1),
  summary: z.string(),
  goal: z.string(),
  projectType: z.string(),
  currentState: z.string().nullable(),
  scope: z.string().nullable(),
  location: locationSchema.nullable(),
  budget: budgetSchema,
  timing: z.string().nullable(),
  inputs: inputsSchema,
  missingInputs: z.array(z.string()),
  preferences: z.array(detailSchema),
  risks: z.array(z.string()),
  recommendedProfessions: z.array(professionSchema),
  nextStep: z.string().nullable(),
});

/** Serializuje obsah do tvaru pro `Brief.content` (JSON). Ověří kontrakt. */
export function serializeBriefContent(content: BriefContent): BriefContent {
  return briefContentSchema.parse(content) satisfies BriefContent;
}

/**
 * Bezpečně přečte snapshot z DB. Nevalidní/starší tvar → `null` (render zobrazí
 * fallback, ne rozbitou stránku).
 */
export function parseBriefContent(value: unknown): BriefContent | null {
  const parsed = briefContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
