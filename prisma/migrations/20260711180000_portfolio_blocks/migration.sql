-- AlterTable
ALTER TABLE "portfolio_projects" ADD COLUMN "blocksVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "portfolio_blocks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_blocks_projectId_order_idx" ON "portfolio_blocks"("projectId", "order");

-- AddForeignKey
ALTER TABLE "portfolio_blocks" ADD CONSTRAINT "portfolio_blocks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
