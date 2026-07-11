-- T010: veřejná stránka firmy — stabilní slug pro `/firma/[slug]`, opt-in kontaktů
-- a opt-in členů do veřejného týmu. Append-only: přidává sloupce do tabulek T009.

-- AlterTable: veřejný slug (nullable — firmy z T009 ho ještě nemají) + unikát,
-- plus opt-in veřejné kontakty firmy.
ALTER TABLE "organizations" ADD COLUMN "slug" TEXT;
ALTER TABLE "organizations" ADD COLUMN "publicEmail" TEXT;
ALTER TABLE "organizations" ADD COLUMN "publicPhone" TEXT;
ALTER TABLE "organizations" ADD COLUMN "publicWebsite" TEXT;

-- CreateIndex: jedna veřejná URL na firmu.
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- AlterTable: opt-in člena do veřejného týmu (default skrytý).
ALTER TABLE "organization_members" ADD COLUMN "publicVisible" BOOLEAN NOT NULL DEFAULT false;
