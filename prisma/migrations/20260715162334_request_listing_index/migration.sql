-- CreateIndex
CREATE INDEX "requests_status_visibility_publishedAt_idx" ON "requests"("status", "visibility", "publishedAt");
