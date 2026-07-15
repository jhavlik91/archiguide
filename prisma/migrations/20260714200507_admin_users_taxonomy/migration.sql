-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('user_suspended', 'user_unsuspended', 'user_role_granted', 'user_role_revoked', 'taxonomy_category_created', 'taxonomy_category_updated', 'taxonomy_category_deleted', 'taxonomy_profession_created', 'taxonomy_profession_updated', 'taxonomy_profession_deactivated', 'taxonomy_profession_reactivated');

-- CreateEnum
CREATE TYPE "AdminAuditTargetType" AS ENUM ('user', 'profession_category', 'profession');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'suspended';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AdminAuditAction" NOT NULL,
    "targetType" "AdminAuditTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actorUserId_idx" ON "admin_audit_logs"("actorUserId");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
