-- CreateTable
CREATE TABLE "request_invites" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_invites_requestId_idx" ON "request_invites"("requestId");

-- CreateIndex
CREATE INDEX "request_invites_invitedUserId_idx" ON "request_invites"("invitedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "request_invites_requestId_invitedUserId_key" ON "request_invites"("requestId", "invitedUserId");

-- AddForeignKey
ALTER TABLE "request_invites" ADD CONSTRAINT "request_invites_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_invites" ADD CONSTRAINT "request_invites_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
