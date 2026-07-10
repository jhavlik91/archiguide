import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { getPublicProfile } from "@/features/profiles/queries";
import { isIndexable } from "@/features/profiles/public-view";
import { PublicProfile } from "@/features/profiles/components/public/public-profile";

/**
 * T008 — veřejná stránka profesionála (`/profesional/[slug]`).
 *
 * Renderuje se jen publikovaný profil aktivního uživatele; draft je 404 pro
 * všechny kromě vlastníka v režimu náhledu (`?preview=1`). Viditelnost a načtení
 * dat řeší `getPublicProfile` (memoizované per-request). Kontaktní údaje se
 * nikde nenačítají ani nevykreslují (private by default).
 */

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ preview?: string }>;

/** Náhled zapíná jen `?preview=1` (příp. `true`). */
function isPreview(sp: { preview?: string }): boolean {
  return sp.preview === "1" || sp.preview === "true";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const result = await getPublicProfile(slug, isPreview(sp));

  if (!result) {
    // Neexistující/skrytý profil — nic neindexovat, ať se draft nedostane do SERP.
    return {
      title: "Profil nenalezen — ArchiGuide",
      robots: { index: false, follow: false },
    };
  }

  const { profile, view } = result;
  const title = profile.headline?.trim() || "Profesionál";
  const primary = profile.professions.find((p) => p.isPrimary)?.profession.name;
  const pageTitle = primary ? `${title} — ${primary}` : title;
  const description =
    profile.bio?.trim().slice(0, 160) ||
    `${title} na ArchiGuide — odbornost, dostupnost a forma spolupráce.`;
  const indexable = isIndexable(view);

  return {
    title: pageTitle,
    description,
    robots: indexable ? undefined : { index: false, follow: false },
    alternates: indexable ? { canonical: `/profesional/${slug}` } : undefined,
    openGraph: {
      type: "profile",
      title: pageTitle,
      description,
      url: `/profesional/${slug}`,
    },
    twitter: { card: "summary_large_image", title: pageTitle, description },
  };
}

export default async function ProfessionalProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const result = await getPublicProfile(slug, isPreview(sp));

  if (!result) notFound();

  const { profile, view, isOwner, isAuthenticated } = result;

  // Analytika bez PII o návštěvníkovi. Náhled vlastníka a jeho vlastní
  // zobrazení nezapočítáváme, ať čísla nezkresluje.
  if (view.mode === "public" && !isOwner) {
    trackEvent("profile.viewed", { profileId: profile.id });
  }

  return (
    <PublicProfile
      profile={profile}
      mode={view.mode}
      isOwner={isOwner}
      isAuthenticated={isAuthenticated}
    />
  );
}
