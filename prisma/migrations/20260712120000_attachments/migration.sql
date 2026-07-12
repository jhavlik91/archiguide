-- CreateEnum
CREATE TYPE "AttachmentVisibility" AS ENUM ('private', 'shared_in_context', 'public');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('active', 'deleted');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "visibility" "AttachmentVisibility" NOT NULL DEFAULT 'private',
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_ownerUserId_idx" ON "attachments"("ownerUserId");

-- CreateIndex
CREATE INDEX "attachments_contextType_contextId_idx" ON "attachments"("contextType", "contextId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
