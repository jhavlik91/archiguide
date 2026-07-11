-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "PortfolioVisibility" AS ENUM ('public', 'unlisted');

-- CreateEnum
CREATE TYPE "PortfolioProjectType" AS ENUM ('project', 'realization', 'concept', 'technical_case_study', 'craft_realization', 'before_after', 'competition', 'research');

-- CreateEnum
CREATE TYPE "PortfolioCoauthorStatus" AS ENUM ('invited', 'confirmed', 'declined');

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "title" TEXT NOT NULL,
    "projectType" "PortfolioProjectType",
    "location" TEXT,
    "year" INTEGER,
    "description" TEXT,
    "visibility" "PortfolioVisibility" NOT NULL DEFAULT 'public',
    "status" "PortfolioStatus" NOT NULL DEFAULT 'draft',
    "publishedSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_coauthors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PortfolioCoauthorStatus" NOT NULL DEFAULT 'invited',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_coauthors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_projects_ownerUserId_idx" ON "portfolio_projects"("ownerUserId");

-- CreateIndex
CREATE INDEX "portfolio_projects_ownerOrgId_idx" ON "portfolio_projects"("ownerOrgId");

-- CreateIndex
CREATE INDEX "portfolio_projects_status_idx" ON "portfolio_projects"("status");

-- CreateIndex
CREATE INDEX "portfolio_coauthors_userId_idx" ON "portfolio_coauthors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_coauthors_projectId_userId_key" ON "portfolio_coauthors"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_coauthors" ADD CONSTRAINT "portfolio_coauthors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_coauthors" ADD CONSTRAINT "portfolio_coauthors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Polymorfní vlastník: právě jeden z ownerUserId / ownerOrgId je vyplněný.
-- Prisma tenhle invariant neumí vyjádřit, proto DB-level CHECK (pojistka nad
-- service vrstvou). FK na `organizations` doplní T009, až tabulka vznikne.
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_one_owner"
    CHECK (("ownerUserId" IS NOT NULL) <> ("ownerOrgId" IS NOT NULL));
