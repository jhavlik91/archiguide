-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('published', 'disputed', 'hidden');

-- AlterEnum
ALTER TYPE "ReportReason" ADD VALUE 'review_dispute';

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "targetUserId" TEXT,
    "targetOrgId" TEXT,
    "evidenceResponseId" TEXT NOT NULL,
    "ratingCommunication" INTEGER NOT NULL,
    "ratingQuality" INTEGER NOT NULL,
    "ratingTimeliness" INTEGER NOT NULL,
    "ratingTransparency" INTEGER NOT NULL,
    "ratingProfessionalism" INTEGER NOT NULL,
    "text" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'published',
    "replyText" TEXT,
    "repliedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_evidenceResponseId_key" ON "reviews"("evidenceResponseId");

-- CreateIndex
CREATE INDEX "reviews_targetUserId_idx" ON "reviews"("targetUserId");

-- CreateIndex
CREATE INDEX "reviews_targetOrgId_idx" ON "reviews"("targetOrgId");

-- CreateIndex
CREATE INDEX "reviews_reviewerUserId_idx" ON "reviews"("reviewerUserId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_targetOrgId_fkey" FOREIGN KEY ("targetOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_evidenceResponseId_fkey" FOREIGN KEY ("evidenceResponseId") REFERENCES "request_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Polymorfní cíl: právě jeden z targetUserId / targetOrgId je vyplněný.
-- Prisma tenhle invariant neumí vyjádřit, proto DB-level CHECK (pojistka nad
-- service vrstvou), stejný vzor jako "request_responses_one_author".
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_one_target"
    CHECK (("targetUserId" IS NOT NULL) <> ("targetOrgId" IS NOT NULL));
