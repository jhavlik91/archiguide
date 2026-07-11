-- T016: veřejná stránka portfolia — stabilní slug pro `/projekt/[slug]`.
-- Append-only: přidává sloupec do tabulky T012. Nullable (draft ho ještě nemá,
-- vzniká při první publikaci), unikátní (jedna veřejná URL na dílo).

-- AlterTable
ALTER TABLE "portfolio_projects" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_projects_slug_key" ON "portfolio_projects"("slug");
