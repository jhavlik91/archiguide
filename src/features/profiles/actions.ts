"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { type UserActor, can } from "@/lib/permissions";
// Import zároveň registruje oprávnění profilů (profiles.edit_own, profiles.view).
import { P_PROFILE_EDIT } from "./permissions";
import {
  getOrCreateDraft,
  publishProfile,
  setAcceptingRequests,
  setOnboardingStep,
  setProfessions,
  unpublishProfile,
  updateAvailability,
  updateBasics,
  updateExpertise,
  updateOnboardingAvailability,
  updateOnboardingLocation,
  updateOnboardingSpecializations,
  updatePricing,
} from "./service";
import {
  acceptingSchema,
  availabilitySchema,
  basicsSchema,
  expertiseSchema,
  onboardingLocationSchema,
  onboardingAvailabilitySchema,
  onboardingSpecializationsSchema,
  onboardingStepSchema,
  pricingSchema,
  professionsSchema,
} from "./validation";

export type ProfileActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation" | "rule";
      message: string;
    };

const UNAUTHENTICATED: ProfileActionResult = {
  ok: false,
  error: "unauthenticated",
  message: "Přihlaste se prosím.",
};
const FORBIDDEN: ProfileActionResult = {
  ok: false,
  error: "forbidden",
  message: "Úpravy profilu jsou jen pro profesionály.",
};

function invalid(message = "Zkontrolujte zadané údaje."): ProfileActionResult {
  return { ok: false, error: "validation", message };
}
function ruleError(message: string): ProfileActionResult {
  return { ok: false, error: "rule", message };
}

/**
 * Ověří přihlášeného profesionála a zajistí existenci draftu (idempotentně).
 * Vrací actora, nebo chybový výsledek (bez vyhození — kvůli UX ve formulářích).
 */
async function requireProfessionalProfile(): Promise<
  { actor: UserActor } | { result: ProfileActionResult }
> {
  const actor = await getActor();
  if (actor.kind !== "user") return { result: UNAUTHENTICATED };
  if (!can(actor, P_PROFILE_EDIT)) return { result: FORBIDDEN };

  const { created } = await getOrCreateDraft(actor.userId);
  if (created) trackEvent("profile.created", { userId: actor.userId });
  return { actor };
}

function revalidateProfile(): void {
  revalidatePath("/profile");
  revalidatePath("/profile/onboarding");
}

// --- Sekce ------------------------------------------------------------------

export async function saveBasics(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = basicsSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message);
  }
  await updateBasics(guard.actor.userId, parsed.data);
  revalidateProfile();
  return { ok: true };
}

export async function saveExpertise(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = expertiseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  await updateExpertise(guard.actor.userId, parsed.data);
  revalidateProfile();
  return { ok: true };
}

export async function saveAvailability(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  await updateAvailability(guard.actor.userId, parsed.data);
  revalidateProfile();
  return { ok: true };
}

export async function savePricing(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = pricingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  await updatePricing(guard.actor.userId, parsed.data);
  revalidateProfile();
  return { ok: true };
}

export async function saveProfessions(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = professionsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const result = await setProfessions(guard.actor.userId, parsed.data.professions);
  if (!result.ok) {
    return ruleError("Vybrané profese nejsou platné. Vyberte je ze seznamu.");
  }
  revalidateProfile();
  return { ok: true };
}

// --- Onboarding: úzké updaty po jednom poli --------------------------------
// (Nepřepisují ostatní rozpracovaná pole — na rozdíl od sekčních save* výše.)

export async function saveOnboardingLocation(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = onboardingLocationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  await updateOnboardingLocation(guard.actor.userId, parsed.data.location ?? null);
  revalidateProfile();
  return { ok: true };
}

export async function saveOnboardingSpecializations(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = onboardingSpecializationsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  await updateOnboardingSpecializations(
    guard.actor.userId,
    parsed.data.specializations,
  );
  revalidateProfile();
  return { ok: true };
}

export async function saveOnboardingAvailability(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = onboardingAvailabilitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  await updateOnboardingAvailability(
    guard.actor.userId,
    parsed.data.availability ?? null,
  );
  revalidateProfile();
  return { ok: true };
}

// --- Onboarding pokrok ------------------------------------------------------

export async function saveOnboardingStep(
  step: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = onboardingStepSchema.safeParse(step);
  if (!parsed.success) return invalid();
  await setOnboardingStep(guard.actor.userId, parsed.data);
  revalidateProfile();
  return { ok: true };
}

// --- Publikace a příjem poptávek -------------------------------------------

export async function publishProfileAction(): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const result = await publishProfile(guard.actor.userId);
  if (!result.ok) {
    return ruleError(
      "Profil ještě nelze publikovat — doplňte titulek a alespoň jednu profesi.",
    );
  }
  trackEvent("profile.published", { userId: guard.actor.userId });
  revalidateProfile();
  return { ok: true };
}

export async function unpublishProfileAction(): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  await unpublishProfile(guard.actor.userId);
  revalidateProfile();
  return { ok: true };
}

export async function toggleAcceptingRequests(
  input: unknown,
): Promise<ProfileActionResult> {
  const guard = await requireProfessionalProfile();
  if ("result" in guard) return guard.result;

  const parsed = acceptingSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const result = await setAcceptingRequests(
    guard.actor.userId,
    parsed.data.accepting,
  );
  if (!result.ok) {
    return ruleError("Nejdřív vyberte alespoň jednu profesi.");
  }
  trackEvent("profile.accepting_requests_toggled", {
    userId: guard.actor.userId,
    accepting: parsed.data.accepting,
  });
  revalidateProfile();
  return { ok: true };
}
