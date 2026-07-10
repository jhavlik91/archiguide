/**
 * Sdílené typy a číselníky profesionálního profilu (T007).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (ProfileStatus, Availability,
 * CollaborationForm, PricingModel) — jsou jediným zdrojem pro Zod validaci i UI
 * popisky. Modul je čistý (bez DB / `next/*`), aby šel použít i v klientských
 * komponentách.
 */

export const HEADLINE_MAX_LENGTH = 120;
export const BIO_MAX_LENGTH = 2000;

export const PROFILE_STATUSES = ["draft", "published"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const AVAILABILITIES = ["open", "limited", "unavailable"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const COLLABORATION_FORMS = ["remote", "onsite", "hybrid"] as const;
export type CollaborationForm = (typeof COLLABORATION_FORMS)[number];

export const PRICING_MODELS = [
  "hourly",
  "fixed",
  "per_project",
  "on_request",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

/** Popisky pro UI (čeština). Klíče musí pokrýt celý příslušný enum. */
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  open: "Přijímám nové zakázky",
  limited: "Omezená kapacita",
  unavailable: "Momentálně nepřijímám",
};

export const COLLABORATION_FORM_LABELS: Record<CollaborationForm, string> = {
  remote: "Na dálku",
  onsite: "Osobně / na místě",
  hybrid: "Kombinace",
};

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  hourly: "Hodinová sazba",
  fixed: "Pevná cena za rozsah",
  per_project: "Cena za projekt",
  on_request: "Na vyžádání",
};

/** Jedna profese ve výběru profilu. */
export type ProfessionLink = {
  professionId: string;
  isPrimary: boolean;
};
