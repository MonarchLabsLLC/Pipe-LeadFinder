-- Scale Plugin Store channel (docs/Scale-Plugin-Channel.md).
-- Additive only: four new tables. No existing table is altered.
-- NOT applied by a merge, a build or a deploy. Apply it on purpose
-- (npx prisma migrate deploy, or run this file) before setting
-- SCALE_PLUGINS_ENABLED=true.

-- CreateTable
CREATE TABLE "PluginProposal" (
    "approvalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownerSubject" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginName" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "unattended" BOOLEAN NOT NULL DEFAULT false,
    "reservedCredits" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,
    "outcomeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginProposal_pkey" PRIMARY KEY ("approvalId")
);

-- CreateTable
CREATE TABLE "PluginActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "installId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginName" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "proposalId" TEXT,
    "requestId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginEventOutbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginInstallCreditCap" (
    "installId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pluginName" TEXT NOT NULL,
    "monthlyCredits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginInstallCreditCap_pkey" PRIMARY KEY ("installId")
);

-- CreateIndex
CREATE INDEX "PluginInstallCreditCap_userId_idx" ON "PluginInstallCreditCap"("userId");

-- CreateIndex
CREATE INDEX "PluginProposal_installId_createdAt_idx" ON "PluginProposal"("installId", "createdAt");

-- CreateIndex
CREATE INDEX "PluginProposal_userId_createdAt_idx" ON "PluginProposal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PluginActionLog_userId_createdAt_idx" ON "PluginActionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PluginActionLog_installId_createdAt_idx" ON "PluginActionLog"("installId", "createdAt");

-- CreateIndex
CREATE INDEX "PluginEventOutbox_status_nextAttemptAt_idx" ON "PluginEventOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "PluginEventOutbox_userId_idx" ON "PluginEventOutbox"("userId");
