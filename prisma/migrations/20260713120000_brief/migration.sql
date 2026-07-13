-- Brief — generování z guide (T021).
-- Strukturovaný projektový brief (§18) jako SNAPSHOT dokončené guide session.
-- Smazání session brief neruší (FK `guideSessionId` = SetNull); vlastní obsah
-- drží sloupec `content` (JSON).

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('draft', 'ready', 'shared', 'revised', 'archived');

-- CreateEnum
CREATE TYPE "BriefVisibility" AS ENUM ('private', 'shared_link', 'public');

-- CreateTable
CREATE TABLE "briefs" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "guideSessionId" TEXT,
    "scenarioSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'draft',
    "visibility" "BriefVisibility" NOT NULL DEFAULT 'private',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "briefs_ownerUserId_idx" ON "briefs"("ownerUserId");

-- CreateIndex
CREATE INDEX "briefs_guideSessionId_idx" ON "briefs"("guideSessionId");

-- AddForeignKey
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_guideSessionId_fkey" FOREIGN KEY ("guideSessionId") REFERENCES "guide_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
