-- CreateEnum
CREATE TYPE "RequestResponseStatus" AS ENUM ('draft', 'sent', 'viewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn');

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'request_response';

-- CreateTable
CREATE TABLE "request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorOrgId" TEXT,
    "status" "RequestResponseStatus" NOT NULL DEFAULT 'draft',
    "message" TEXT NOT NULL,
    "priceModel" "PricingModel",
    "priceNote" TEXT,
    "availability" TEXT,
    "rejectionReason" TEXT,
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_response_portfolio_items" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "portfolioProjectId" TEXT NOT NULL,

    CONSTRAINT "request_response_portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_response_audit_entries" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "RequestResponseStatus",
    "toStatus" "RequestResponseStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_response_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_responses_requestId_idx" ON "request_responses"("requestId");

-- CreateIndex
CREATE INDEX "request_responses_authorUserId_idx" ON "request_responses"("authorUserId");

-- CreateIndex
CREATE INDEX "request_responses_authorOrgId_idx" ON "request_responses"("authorOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "request_responses_requestId_authorUserId_key" ON "request_responses"("requestId", "authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "request_responses_requestId_authorOrgId_key" ON "request_responses"("requestId", "authorOrgId");

-- CreateIndex
CREATE INDEX "request_response_portfolio_items_responseId_idx" ON "request_response_portfolio_items"("responseId");

-- CreateIndex
CREATE INDEX "request_response_portfolio_items_portfolioProjectId_idx" ON "request_response_portfolio_items"("portfolioProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "request_response_portfolio_items_responseId_portfolioProjec_key" ON "request_response_portfolio_items"("responseId", "portfolioProjectId");

-- CreateIndex
CREATE INDEX "request_response_audit_entries_responseId_createdAt_idx" ON "request_response_audit_entries"("responseId", "createdAt");

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_authorOrgId_fkey" FOREIGN KEY ("authorOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_response_portfolio_items" ADD CONSTRAINT "request_response_portfolio_items_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "request_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_response_portfolio_items" ADD CONSTRAINT "request_response_portfolio_items_portfolioProjectId_fkey" FOREIGN KEY ("portfolioProjectId") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_response_audit_entries" ADD CONSTRAINT "request_response_audit_entries_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "request_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_response_audit_entries" ADD CONSTRAINT "request_response_audit_entries_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Polymorfní autor: právě jeden z authorUserId / authorOrgId je vyplněný.
-- Prisma tenhle invariant neumí vyjádřit, proto DB-level CHECK (pojistka nad
-- service vrstvou), stejný vzor jako "portfolio_projects_one_owner".
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_one_author"
    CHECK (("authorUserId" IS NOT NULL) <> ("authorOrgId" IS NOT NULL));
