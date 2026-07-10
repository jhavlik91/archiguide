-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('open', 'limited', 'unavailable');

-- CreateEnum
CREATE TYPE "CollaborationForm" AS ENUM ('remote', 'onsite', 'hybrid');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('hourly', 'fixed', 'per_project', 'on_request');

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "photoUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "serviceAreas" TEXT[],
    "languages" TEXT[],
    "yearsOfExperience" INTEGER,
    "specializations" TEXT[],
    "projectTypes" TEXT[],
    "availability" "Availability",
    "collaborationForms" "CollaborationForm"[],
    "pricingModel" "PricingModel",
    "pricingNote" TEXT,
    "status" "ProfileStatus" NOT NULL DEFAULT 'draft',
    "acceptingRequests" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_professions" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_professions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_userId_key" ON "professional_profiles"("userId");

-- CreateIndex
CREATE INDEX "profile_professions_professionId_idx" ON "profile_professions"("professionId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_professions_profileId_professionId_key" ON "profile_professions"("profileId", "professionId");

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_professions" ADD CONSTRAINT "profile_professions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_professions" ADD CONSTRAINT "profile_professions_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "professions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Právě jedna hlavní profese na profil. Parciální unikátní index je DB-level
-- pojistka nad service vrstvou (Prisma schema parciální unikát neumí vyjádřit).
CREATE UNIQUE INDEX "profile_professions_one_primary_per_profile"
    ON "profile_professions"("profileId")
    WHERE "isPrimary";
