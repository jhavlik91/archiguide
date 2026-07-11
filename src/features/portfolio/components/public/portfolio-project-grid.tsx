import Link from "next/link";
import { PORTFOLIO_PROJECT_TYPE_LABELS } from "../../types";
import type { PublicPortfolioCard } from "../../queries";

/**
 * Mřížka publikovaných projektů pro veřejný profil profesionála/firmy (T016 §
 * Main flow #4). Každá kartička odkazuje na `/projekt/[slug]`. Prázdný seznam se
 * nevykreslí (sekce se na profilu vůbec neobjeví).
 */
export function PortfolioProjectGrid({
  projects,
}: {
  projects: PublicPortfolioCard[];
}) {
  if (projects.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <li key={project.slug}>
          <Link
            href={`/projekt/${project.slug}`}
            className="group border-border hover:border-primary/50 block overflow-hidden rounded-lg border transition-colors"
          >
            <div className="bg-muted aspect-[4/3] w-full overflow-hidden">
              {project.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.coverImageUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
                  Bez náhledu
                </div>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="text-foreground font-medium group-hover:underline">
                {project.title}
              </p>
              <p className="text-muted-foreground text-sm">
                {[
                  project.projectType
                    ? PORTFOLIO_PROJECT_TYPE_LABELS[project.projectType]
                    : null,
                  project.year,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
