-- T036 staví na T031 (migrace 20260713140000_messaging_attachments_block_report):
-- tabulka "reports" a enumy ReportTargetType/ReportReason/ReportState už existují.
-- Tahle migrace transformuje model z "jeden řádek na reportera" (T031) na
-- "jeden PŘÍPAD na cíl + podání per reporter" (T036) a přidává moderační akce
-- (audit) a moderační stav cíle.

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('no_action', 'warning', 'content_hide', 'content_remove', 'feature_restriction', 'suspend_temporary', 'suspend_permanent');

-- CreateEnum
CREATE TYPE "ContentModerationState" AS ENUM ('visible', 'hidden');

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

-- DataMigration: každý existující T031 report (řádek per reporter) se stává
-- samostatným případem s jedním podáním. Otevřené případy stejného cíle se
-- vědomě NEslučují (šlo by o ztrátovou operaci nad historickými daty) —
-- agregace platí pro nová nahlášení přes `reportContent`.
INSERT INTO "report_submissions" ("id", "reportId", "reporterUserId", "reason", "note", "createdAt")
SELECT gen_random_uuid()::text, r."id", r."reporterUserId", r."reason", r."note", r."createdAt"
FROM "reports" r;

-- AlterTable: reporter se přesunul do podání; případ dostává čas rozřešení.
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporterUserId_fkey";
DROP INDEX "reports_reporterUserId_idx";
DROP INDEX "reports_state_idx";
ALTER TABLE "reports" DROP COLUMN "reporterUserId";
ALTER TABLE "reports" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "reports_state_createdAt_idx" ON "reports"("state", "createdAt");
