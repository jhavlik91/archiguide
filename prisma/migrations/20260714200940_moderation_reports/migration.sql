-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('profile', 'portfolio_project', 'request', 'message', 'review');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'scam', 'fake_identity', 'harassment', 'dangerous_advice', 'copyright', 'impersonation', 'illegal_solicitation');

-- CreateEnum
CREATE TYPE "ReportState" AS ENUM ('open', 'triaged', 'under_review', 'actioned', 'dismissed', 'appealed', 'closed');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('no_action', 'warning', 'content_hide', 'content_remove', 'feature_restriction', 'suspend_temporary', 'suspend_permanent');

-- CreateEnum
CREATE TYPE "ContentModerationState" AS ENUM ('visible', 'hidden');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "state" "ReportState" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_submissions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "moderatorUserId" TEXT,
    "actionType" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_flags" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "state" "ContentModerationState" NOT NULL DEFAULT 'visible',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "reports_state_createdAt_idx" ON "reports"("state", "createdAt");

-- CreateIndex
CREATE INDEX "report_submissions_reporterUserId_idx" ON "report_submissions"("reporterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "report_submissions_reportId_reporterUserId_key" ON "report_submissions"("reportId", "reporterUserId");

-- CreateIndex
CREATE INDEX "moderation_actions_reportId_createdAt_idx" ON "moderation_actions"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_flags_targetType_targetId_key" ON "moderation_flags"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "report_submissions" ADD CONSTRAINT "report_submissions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_submissions" ADD CONSTRAINT "report_submissions_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
