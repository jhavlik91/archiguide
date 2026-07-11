-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('active', 'deleted');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "mimeType" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "webKey" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "altText" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_ownerUserId_idx" ON "media_assets"("ownerUserId");

-- CreateIndex
CREATE INDEX "media_assets_ownerOrgId_idx" ON "media_assets"("ownerOrgId");

-- CreateIndex
CREATE INDEX "media_assets_contentHash_idx" ON "media_assets"("contentHash");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Polymorfní vlastník: právě jeden z ownerUserId / ownerOrgId je vyplněný.
-- Prisma tenhle invariant neumí vyjádřit, proto DB-level CHECK (pojistka nad
-- service vrstvou), stejně jako u portfolia (T012).
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_one_owner"
    CHECK (("ownerUserId" IS NOT NULL) <> ("ownerOrgId" IS NOT NULL));
