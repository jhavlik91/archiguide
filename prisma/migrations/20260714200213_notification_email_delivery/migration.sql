-- CreateEnum
CREATE TYPE "NotificationEmailKind" AS ENUM ('transactional', 'daily_digest', 'weekly_digest');

-- CreateEnum
CREATE TYPE "NotificationEmailStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "notification_email_deliveries" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "notificationId" TEXT,
    "kind" "NotificationEmailKind" NOT NULL,
    "status" "NotificationEmailStatus" NOT NULL DEFAULT 'queued',
    "periodKey" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_email_deliveries_notificationId_key" ON "notification_email_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "notification_email_deliveries_recipientUserId_kind_idx" ON "notification_email_deliveries"("recipientUserId", "kind");

-- AddForeignKey
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotence digestu T033: nejvýše JEDEN e-mail na (příjemce, druh, perioda).
-- Opakovaný/souběžný cron běh pro stejný den/týden narazí na P2002 a přeskočí
-- odeslání místo duplicitního e-mailu. Částečný unikátní index (jen řádky s
-- vyplněnou periodou — transakční e-maily periodu nemají) Prisma schema
-- neumí vyjádřit, stejně jako u `notification_dedup_unique_unread` (T032).
CREATE UNIQUE INDEX "notification_email_deliveries_recipient_kind_period_key"
  ON "notification_email_deliveries"("recipientUserId", "kind", "periodKey")
  WHERE "periodKey" IS NOT NULL;
