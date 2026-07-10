import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { hasRole } from "@/lib/permissions";
import { getOwnProfile, getProfessionOptions } from "@/features/profiles/queries";
import {
  OnboardingWizard,
  type OnboardingInitial,
} from "@/features/profiles/components/onboarding-wizard";
import type { CategoryOption } from "@/features/profiles/components/profession-picker";

export default async function OnboardingPage() {
  const actor = await requireUser();
  // Precondition: role professional. Klient si ji přidá na /profile.
  if (!hasRole(actor, "professional")) redirect("/profile");

  const [profile, categories] = await Promise.all([
    getOwnProfile(actor.userId),
    getProfessionOptions(),
  ]);

  const initial: OnboardingInitial = {
    professions:
      profile?.professions.map((p) => ({
        professionId: p.professionId,
        isPrimary: p.isPrimary,
      })) ?? [],
    location: profile?.location ?? null,
    specializations: profile?.specializations ?? [],
    availability: profile?.availability ?? null,
    onboardingStep: profile?.onboardingStep ?? 0,
  };

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    professions: c.professions.map((p) => ({ id: p.id, name: p.name })),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Založení profilu
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pár kroků k základu profilu. Rozpracovaný profil se průběžně ukládá.
        </p>
      </div>
      <OnboardingWizard initial={initial} categories={categoryOptions} />
    </div>
  );
}
