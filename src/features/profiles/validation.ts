import { z } from "zod";
import {
  AVAILABILITIES,
  BIO_MAX_LENGTH,
  COLLABORATION_FORMS,
  HEADLINE_MAX_LENGTH,
  PRICING_MODELS,
} from "./types";

/**
 * Validace vstupů profilu (T007). Editace je rozdělená po sekcích (základ,
 * odbornost, dostupnost, ceny) — každá sekce má vlastní schéma, aby šlo ukládat
 * průběžně (onboarding je přeskočitelný). Prázdné/„nevím" hodnoty jsou validní a
 * neblokují flow (viz TECHNICKE-ZADANI §4).
 */

/** Prázdný string → undefined; jinak ořízne okraje. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

/** Pole textů: ořízne, zahodí prázdné a duplicity, zachová pořadí. */
const textList = (maxItemLength = 80) =>
  z
    .array(z.string().trim().min(1).max(maxItemLength))
    .transform((items) => [...new Set(items)])
    .optional()
    .transform((items) => items ?? []);

// --- Sekce: základ ----------------------------------------------------------

export const basicsSchema = z.object({
  headline: optionalText(HEADLINE_MAX_LENGTH),
  photoUrl: z
    .string()
    .trim()
    .url("Zadejte platnou URL fotografie.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bio: optionalText(BIO_MAX_LENGTH),
  location: optionalText(120),
  serviceAreas: textList(),
  languages: textList(40),
});
export type BasicsInput = z.infer<typeof basicsSchema>;

// --- Sekce: odbornost -------------------------------------------------------

export const expertiseSchema = z.object({
  yearsOfExperience: z.coerce
    .number()
    .int()
    .min(0)
    .max(80)
    .optional()
    .or(z.nan().transform(() => undefined)),
  specializations: textList(80),
  projectTypes: textList(80),
});
export type ExpertiseInput = z.infer<typeof expertiseSchema>;

// --- Sekce: dostupnost ------------------------------------------------------

export const availabilitySchema = z.object({
  availability: z.enum(AVAILABILITIES).optional(),
  collaborationForms: z
    .array(z.enum(COLLABORATION_FORMS))
    .transform((items) => [...new Set(items)])
    .optional()
    .transform((items) => items ?? []),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

// --- Sekce: ceny ------------------------------------------------------------

export const pricingSchema = z.object({
  pricingModel: z.enum(PRICING_MODELS).optional(),
  pricingNote: optionalText(200),
});
export type PricingInput = z.infer<typeof pricingSchema>;

// --- Profese (odbornost, M:N) ----------------------------------------------

/**
 * Výběr profesí. `professionId` se ověřuje proti taxonomii až v service vrstvě
 * (profese jen z T005). Příznak hlavní profese normalizuje `rules.ts`.
 */
export const professionsSchema = z.object({
  professions: z
    .array(
      z.object({
        professionId: z.string().min(1),
        isPrimary: z.boolean().default(false),
      }),
    )
    .max(20),
});
export type ProfessionsInput = z.infer<typeof professionsSchema>;

// --- Přepínač přijímání poptávek -------------------------------------------

export const acceptingSchema = z.object({ accepting: z.boolean() });

// --- Onboarding: úzké schéma jednotlivých kroků -----------------------------
// Každý krok validuje jen své pole (wizard ukládá po polích, ať nepřemaže
// ostatní rozpracovaná data).

export const onboardingLocationSchema = z.object({
  location: optionalText(120),
});
export const onboardingSpecializationsSchema = z.object({
  specializations: textList(80),
});
export const onboardingAvailabilitySchema = z.object({
  availability: z.enum(AVAILABILITIES).optional(),
});

// --- Onboarding krok --------------------------------------------------------

/** Wizard §55: profese → lokalita → specializace → dostupnost. 0 = nezačato. */
export const ONBOARDING_STEP_COUNT = 4;
export const onboardingStepSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(ONBOARDING_STEP_COUNT);
