-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "NotificationState" AS ENUM ('unread', 'read');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "state" "NotificationState" NOT NULL DEFAULT 'unread',
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "linkPath" TEXT NOT NULL,
    "contextType" TEXT,
    "contextId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "readAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_state_idx" ON "notifications"("recipientUserId", "state");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_lastEventAt_idx" ON "notifications"("recipientUserId", "lastEventAt");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_dedupeKey_idx" ON "notifications"("recipientUserId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
