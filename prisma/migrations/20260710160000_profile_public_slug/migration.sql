-- T008: veřejná stránka profilu — stabilní slug pro `/profesional/[slug]`.
-- Append-only: přidává sloupec do tabulky T007. Nullable (draft ho ještě nemá),
-- unikátní (jedna veřejná URL na profil).

-- AlterTable
ALTER TABLE "professional_profiles" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_slug_key" ON "professional_profiles"("slug");
