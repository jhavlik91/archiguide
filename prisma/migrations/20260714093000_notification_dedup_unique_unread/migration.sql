-- Dedup invariant T032: nejvýše JEDNA nepřečtená notifikace na (příjemce, dedupeKey).
-- Aplikační find-then-create ho pod souběhem neudrží (dva emity stejného klíče se
-- minou a založí duplikát) — vynucuje ho DB. Částečný unikátní index Prisma schema
-- neumí vyjádřit (viz @@index v schema.prisma), drží ho tato ruční migrace;
-- createOrBumpNotification řeší kolizi (P2002) bumpem vítězného řádku.
CREATE UNIQUE INDEX "notifications_recipient_dedupe_unread_key"
  ON "notifications"("recipientUserId", "dedupeKey")
  WHERE "state" = 'unread';
