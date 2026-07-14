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
import { BRIEF_TITLE_MAX_LENGTH, type BriefContent } from "./types";

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

// --- Manuální editace (T022) ------------------------------------------------
//
// Editovatelné jsou VŠECHNY sekce §18 formulářem (ne volný text celého briefu,
// T022 § Main flow bod 1). Zod schéma per sekce vynucuje strukturu (rozpočet
// číslo/rozsah přes `display`, lokalita strukturovaná); odvozená pole (`version`,
// dostupné/chybějící podklady, slug profese) editor NEmění — merge je zachová.

const trimmed = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s.length === 0 ? null : s))
    .nullable();

const editLocationSchema = z
  .object({
    display: trimmed(160),
    address: trimmed(240).optional(),
    shareAddress: z.boolean(),
  })
  // Lokalita bez veřejného popisu nedává smysl → celá sekce je pak „neuvedeno".
  .transform((loc) => (loc.display.length === 0 ? null : loc))
  .nullable();

const editBudgetSchema = z.object({
  known: z.boolean(),
  // „Číslo/rozsah" držíme jako lidsky formátovaný `display`; při `known` je povinné.
  display: trimmed(120),
  scope: trimmed(120).optional(),
});

const editPreferenceSchema = z.object({
  key: z.string().min(1),
  label: trimmed(120),
  value: trimmed(600),
});

const editProfessionSchema = z.object({
  slug: z.string().min(1),
  name: trimmed(120),
  reason: trimmed(600),
});

/** Schéma vstupu editoru briefu (T022). Title je zvlášť (DB sloupec). */
export const briefEditSchema = z.object({
  title: trimmed(BRIEF_TITLE_MAX_LENGTH).min(1, "Název nesmí být prázdný."),
  summary: trimmed(2000),
  goal: trimmed(600),
  projectType: trimmed(160),
  currentState: nullableText(600),
  scope: nullableText(600),
  location: editLocationSchema,
  budget: editBudgetSchema,
  timing: nullableText(300),
  preferences: z.array(editPreferenceSchema).max(50),
  risks: z.array(trimmed(600)).max(50),
  recommendedProfessions: z.array(editProfessionSchema).max(20),
  nextStep: nullableText(600),
});

export type BriefEditInput = z.infer<typeof briefEditSchema>;

/**
 * Sloučí editaci do existujícího snapshotu: převezme editovatelné sekce §18,
 * ODVOZENÁ pole zachová beze změny (`version`, `inputs`, `missingInputs`).
 * `display` rozpočtu při `known:false` normalizuje na „Rozpočet neuveden", aby
 * render nikdy nezobrazil prázdno (invariant z T021).
 */
export function applyBriefEdit(
  existing: BriefContent,
  input: BriefEditInput,
): BriefContent {
  const budgetDisplay = input.budget.known
    ? input.budget.display || "Rozpočet neuveden"
    : "Rozpočet neuveden";
  return {
    ...existing,
    summary: input.summary,
    goal: input.goal,
    projectType: input.projectType,
    currentState: input.currentState,
    scope: input.scope,
    location: input.location,
    budget: {
      known: input.budget.known,
      display: budgetDisplay,
      ...(input.budget.scope ? { scope: input.budget.scope } : {}),
    },
    timing: input.timing,
    preferences: input.preferences,
    risks: input.risks.filter((r) => r.length > 0),
    recommendedProfessions: input.recommendedProfessions,
    nextStep: input.nextStep,
  };
}

/**
 * Odstraní SOUKROMÁ pole ze snapshotu pro sdílení/export (T022 § Main flow 5,
 * Alternative flows). Dnes je to přesná adresa (`location.address`) — příjemce
 * sdíleného odkazu ani výchozí export ji nikdy nevidí, dokud ji vlastník
 * explicitně nezahrne. Text vepsaný do jiných polí neřešíme (na to je privacy
 * varování při sdílení); tady jde o strukturovaně soukromé pole.
 */
export function redactBriefPrivate(content: BriefContent): BriefContent {
  if (!content.location?.address) return content;
  return {
    ...content,
    location: {
      display: content.location.display,
      shareAddress: content.location.shareAddress,
    },
  };
}
