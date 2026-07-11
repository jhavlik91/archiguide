import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PORTFOLIO_PROJECT_TYPE_LABELS } from "../../types";
import type {
  PublicPortfolioAuthor,
  PublicPortfolioProject,
} from "../../queries";
import { BlockRenderer } from "./block-renderer";

/**
 * Veřejný render publikovaného portfolio díla (T016). Hero s metadaty a autory,
 * pak sekvence obsahových bloků ze snapshotu. Náhledový režim (`preview`) přidá
 * lištu, že jde o nepublikovanou verzi viditelnou jen editorům.
 */
export function PublicPortfolioProject({
  project,
  mode,
}: {
  project: PublicPortfolioProject;
  mode: "public" | "preview";
}) {
  const { title, projectType, location, year, description } = project;
  const hasMeta = !!location || !!year || !!projectType;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {mode === "preview" && (
        <div className="border-warning/40 bg-warning/10 text-foreground mb-6 rounded-md border px-4 py-3 text-sm">
          Náhled nepublikované verze — veřejnosti se nezobrazuje.
        </div>
      )}

      <header className="space-y-4">
        {projectType && (
          <Badge variant="secondary">
            {PORTFOLIO_PROJECT_TYPE_LABELS[projectType]}
          </Badge>
        )}
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>

        {hasMeta && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {location}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-4" aria-hidden />
                {year}
              </span>
            )}
          </div>
        )}

        <Authors owner={project.owner} coauthors={project.coauthors} />

        {description && (
          <p className="text-foreground/90 max-w-2xl text-lg leading-relaxed">
            {description}
          </p>
        )}
      </header>

      <div className="mt-10">
        <BlockRenderer blocks={project.blocks} />
      </div>

      <footer className="text-muted-foreground mt-12 border-t pt-6 text-xs">
        Portfolio na ArchiGuide
      </footer>
    </main>
  );
}

/** Odkaz na autora, nebo prosté jméno, když nemá veřejný profil. */
function AuthorLink({ author }: { author: PublicPortfolioAuthor }) {
  if (author.href) {
    return (
      <Link href={author.href} className="text-primary hover:underline">
        {author.name}
      </Link>
    );
  }
  return <span className="text-foreground">{author.name}</span>;
}

/** Řádek autorů: vlastník + potvrzení spoluautoři. */
function Authors({
  owner,
  coauthors,
}: {
  owner: PublicPortfolioAuthor;
  coauthors: PublicPortfolioAuthor[];
}) {
  return (
    <p className="text-muted-foreground text-sm">
      <span>Autor: </span>
      <AuthorLink author={owner} />
      {coauthors.length > 0 && (
        <>
          <span>{" · Spolupráce: "}</span>
          {coauthors.map((coauthor, index) => (
            <span key={index}>
              {index > 0 && ", "}
              <AuthorLink author={coauthor} />
            </span>
          ))}
        </>
      )}
    </p>
  );
}
