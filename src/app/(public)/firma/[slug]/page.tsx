import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
import { getPublicOrganization } from "@/features/organizations/queries";
import { getMembershipRole } from "@/features/organizations/service";
import { roleAtLeast } from "@/features/organizations/rules";
import { listPublicPortfolioForOrg } from "@/features/portfolio/queries";
import { PublicOrganization } from "@/features/organizations/components/public/public-organization";
import { getReviewsForTarget } from "@/features/reviews/service";

/**
 * T010 — veřejná stránka firmy (`/firma/[slug]`).
 *
 * Renderuje se jen `active` firma; archivovaná je 404 pro všechny (viditelnost
 * řeší `getPublicOrganization`). Do týmu jde jen člen s opt-inem; kontaktní údaje
 * členů se nikde nenačítají ani nevykreslují. `force-dynamic`, ať stránka vždy
 * odráží aktuální stav (editace profilu, změna opt-inů) a započítá zobrazení.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await getPublicOrganization(slug);

  if (!org) {
    return {
      title: "Firma nenalezena — ArchiGuide",
      robots: { index: false, follow: false },
    };
  }

  const title = org.name;
  const description =
    org.description?.trim().slice(0, 160) ||
    `${title} na ArchiGuide — firemní profil, specializace a tým.`;

  return {
    title,
    description,
    alternates: { canonical: `/firma/${slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/firma/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function OrganizationPublicPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const org = await getPublicOrganization(slug);

  if (!org) notFound();

  // Analytika bez PII o návštěvníkovi.
  trackEvent("org.viewed", { orgId: org.id });

  // Publikované projekty firmy pro sekci Portfolio (T016).
  const projects = await listPublicPortfolioForOrg(org.id);

  // Hodnocení firmy (T037). Editor+ firmy vidí u recenzí reply/dispute akce —
  // stránka je veřejná (bez requireUser), takže membership zjišťujeme jen pro
  // přihlášeného uživatele.
  const reviews = await getReviewsForTarget({
    type: "organization",
    orgId: org.id,
  });
  const actor = await getActor();
  const isEditor =
    actor.kind === "user" &&
    roleAtLeast(await getMembershipRole(org.id, actor.userId), "editor");

  return (
    <PublicOrganization
      org={org}
      projects={projects}
      reviews={reviews}
      isEditor={isEditor}
    />
  );
}
