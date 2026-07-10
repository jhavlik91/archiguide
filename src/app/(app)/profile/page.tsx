import Link from "next/link";
import { requireUser } from "@/lib/session";
import { hasRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOwnProfile, getProfessionOptions } from "@/features/profiles/queries";
import { BecomeProfessional } from "@/features/profiles/components/become-professional";
import {
  ProfileEditor,
  type EditorProfile,
} from "@/features/profiles/components/profile-editor";
import type { CategoryOption } from "@/features/profiles/components/profession-picker";
import type { ProfileWithProfessions } from "@/features/profiles/service";

function toCategoryOptions(
  categories: Awaited<ReturnType<typeof getProfessionOptions>>,
): CategoryOption[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    professions: c.professions.map((p) => ({ id: p.id, name: p.name })),
  }));
}

function toEditorProfile(profile: ProfileWithProfessions): EditorProfile {
  return {
    status: profile.status,
    slug: profile.slug,
    acceptingRequests: profile.acceptingRequests,
    headline: profile.headline,
    photoUrl: profile.photoUrl,
    bio: profile.bio,
    location: profile.location,
    serviceAreas: profile.serviceAreas,
    languages: profile.languages,
    yearsOfExperience: profile.yearsOfExperience,
    specializations: profile.specializations,
    projectTypes: profile.projectTypes,
    availability: profile.availability,
    collaborationForms: profile.collaborationForms,
    pricingModel: profile.pricingModel,
    pricingNote: profile.pricingNote,
    professions: profile.professions.map((p) => ({
      professionId: p.professionId,
      isPrimary: p.isPrimary,
    })),
  };
}

export default async function ProfilePage() {
  const actor = await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Váš profesionální profil — základ, odbornost, dostupnost a ceny.
        </p>
      </div>

      {!hasRole(actor, "professional") ? (
        <BecomeProfessional />
      ) : (
        <ProfileBody userId={actor.userId} />
      )}
    </div>
  );
}

async function ProfileBody({ userId }: { userId: string }) {
  const [profile, categories] = await Promise.all([
    getOwnProfile(userId),
    getProfessionOptions(),
  ]);

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zatím nemáte profil</CardTitle>
          <CardDescription>
            Projděte krátký onboarding — profese, lokalitu, specializace a
            dostupnost. Každý krok lze přeskočit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/profile/onboarding">Spustit onboarding</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ProfileEditor
      profile={toEditorProfile(profile)}
      categories={toCategoryOptions(categories)}
    />
  );
}
