-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('profile', 'portfolio_project', 'request', 'message', 'review');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'scam', 'fake_identity', 'harassment', 'dangerous_advice', 'copyright', 'impersonation', 'illegal_solicitation');

-- CreateEnum
CREATE TYPE "ReportState" AS ENUM ('open', 'triaged', 'under_review', 'actioned', 'dismissed', 'appealed', 'closed');

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "state" "ReportState" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocks_blockedUserId_idx" ON "blocks"("blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blockerUserId_blockedUserId_key" ON "blocks"("blockerUserId", "blockedUserId");

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "reports_state_idx" ON "reports"("state");

-- CreateIndex
CREATE INDEX "reports_reporterUserId_idx" ON "reports"("reporterUserId");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

