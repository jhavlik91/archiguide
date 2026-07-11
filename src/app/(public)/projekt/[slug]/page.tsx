import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { getPublicPortfolioProject } from "@/features/portfolio/queries";
import { isIndexable } from "@/features/portfolio/public-view";
import { PublicPortfolioProject } from "@/features/portfolio/components/public/public-portfolio-project";

/**
 * T016 — veřejná stránka portfolio díla (`/projekt/[slug]`).
 *
 * Renderuje se publikovaný snapshot díla aktivního vlastníka; draft/archiv je
 * 404 pro všechny kromě editora v režimu náhledu (`?preview=1`, dostupný přes id
 * díla — draft ještě nemá slug). Viditelnost i načtení dat řeší
 * `getPublicPortfolioProject` (memoizované per-request).
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
  const result = await getPublicPortfolioProject(slug, isPreview(sp));

  if (!result) {
    // Neexistující/skryté dílo — nic neindexovat, ať se draft nedostane do SERP.
    return {
      title: "Projekt nenalezen — ArchiGuide",
      robots: { index: false, follow: false },
    };
  }

  const { project, view } = result;
  const pageTitle = project.title;
  const description =
    project.description?.trim().slice(0, 160) ||
    `${project.title} — portfolio na ArchiGuide.`;
  const indexable = isIndexable(view);
  const canonical = project.slug ? `/projekt/${project.slug}` : undefined;
  const image = project.coverImageUrl ?? undefined;

  return {
    title: pageTitle,
    description,
    robots: indexable ? undefined : { index: false, follow: false },
    alternates: indexable ? { canonical } : undefined,
    openGraph: {
      type: "article",
      title: pageTitle,
      description,
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PortfolioProjectPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const result = await getPublicPortfolioProject(slug, isPreview(sp));

  if (!result) notFound();

  const { project, view, isEditor } = result;

  // Analytika bez PII o návštěvníkovi. Náhled a zobrazení editorem nezapočítáváme.
  if (view.mode === "public" && !isEditor) {
    trackEvent("portfolio.viewed", { projectId: project.id });
  }

  return <PublicPortfolioProject project={project} mode={view.mode} />;
}
