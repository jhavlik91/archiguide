-- CreateEnum
CREATE TYPE "GuideStepType" AS ENUM ('single_choice', 'multi_choice', 'text', 'number', 'range', 'location', 'file_ref');

-- CreateEnum
CREATE TYPE "GuideSessionState" AS ENUM ('active', 'completed', 'abandoned');

-- CreateTable
CREATE TABLE "guide_scenarios" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_steps" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "GuideStepType" NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "help" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB NOT NULL DEFAULT '{}',
    "condition" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_sessions" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT,
    "token" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "state" "GuideSessionState" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_scenarios_slug_idx" ON "guide_scenarios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "guide_scenarios_slug_version_key" ON "guide_scenarios"("slug", "version");

-- CreateIndex
CREATE INDEX "guide_steps_scenarioId_idx" ON "guide_steps"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "guide_steps_scenarioId_key_key" ON "guide_steps"("scenarioId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "guide_sessions_token_key" ON "guide_sessions"("token");

-- CreateIndex
CREATE INDEX "guide_sessions_userId_idx" ON "guide_sessions"("userId");

-- CreateIndex
CREATE INDEX "guide_sessions_scenarioId_idx" ON "guide_sessions"("scenarioId");

-- AddForeignKey
ALTER TABLE "guide_steps" ADD CONSTRAINT "guide_steps_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "guide_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_sessions" ADD CONSTRAINT "guide_sessions_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "guide_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_sessions" ADD CONSTRAINT "guide_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
