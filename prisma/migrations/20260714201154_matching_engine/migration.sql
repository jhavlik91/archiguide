-- CreateEnum
CREATE TYPE "MatchRecommendationStatus" AS ENUM ('new', 'shown', 'shortlisted', 'dismissed');

-- CreateTable
CREATE TABLE "match_recommendations" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "MatchRecommendationStatus" NOT NULL DEFAULT 'new',
    "sponsored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_recommendations_requestId_idx" ON "match_recommendations"("requestId");

-- CreateIndex
CREATE INDEX "match_recommendations_candidateUserId_idx" ON "match_recommendations"("candidateUserId");

-- CreateIndex
CREATE UNIQUE INDEX "match_recommendations_requestId_candidateUserId_key" ON "match_recommendations"("requestId", "candidateUserId");

-- AddForeignKey
ALTER TABLE "match_recommendations" ADD CONSTRAINT "match_recommendations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_recommendations" ADD CONSTRAINT "match_recommendations_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
