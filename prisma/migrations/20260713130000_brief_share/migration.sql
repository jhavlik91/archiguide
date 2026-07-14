-- Brief — editace, sdílení, export (T022).
-- Sdílení přes odvolatelný privátní odkaz (capability URL): `shareToken` je
-- náhodný high-entropy identifikátor v plaintextu — dává jen READ-ONLY přístup
-- ke snapshotu, který vlastník vědomě sdílel, a musí jít znovu zobrazit/zkopírovat.
-- Sdílená verze je zmrazený SNAPSHOT (`sharedContent`/`sharedTitle`/`sharedAt`)
-- nezávislý na živém `content` (zadani/08 §2: `shared → revised → shared`).
-- `shareRevokedAt` drží čas odvolání (odvoláním se `shareToken` vynuluje).

-- AlterTable
ALTER TABLE "briefs"
    ADD COLUMN "shareToken" TEXT,
    ADD COLUMN "sharedContent" JSONB,
    ADD COLUMN "sharedTitle" TEXT,
    ADD COLUMN "sharedAt" TIMESTAMP(3),
    ADD COLUMN "shareRevokedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "briefs_shareToken_key" ON "briefs"("shareToken");
