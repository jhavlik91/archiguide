-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('b2c', 'b2b');

-- CreateEnum
CREATE TYPE "RequestVisibility" AS ENUM ('private', 'shared_link', 'public');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'active', 'in_discussion', 'paused', 'awarded', 'closed', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "briefId" TEXT,
    "type" "RequestType" NOT NULL DEFAULT 'b2c',
    "visibility" "RequestVisibility" NOT NULL DEFAULT 'private',
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "targetProfessionSlugs" TEXT[],
    "region" TEXT NOT NULL,
    "budget" TEXT,
    "timeline" TEXT,
    "deadline" TIMESTAMP(3),
    "briefSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "editedAfterPublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_audit_entries" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_ownerUserId_idx" ON "requests"("ownerUserId");

-- CreateIndex
CREATE INDEX "requests_briefId_idx" ON "requests"("briefId");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "request_audit_entries_requestId_createdAt_idx" ON "request_audit_entries"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_audit_entries" ADD CONSTRAINT "request_audit_entries_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_audit_entries" ADD CONSTRAINT "request_audit_entries_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
