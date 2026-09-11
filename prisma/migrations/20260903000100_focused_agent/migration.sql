-- CreateTable
CREATE TABLE "FocusedAgentThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'native',
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "resourceIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusedAgentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusedAgentMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusedAgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusedAgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'chat',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "activeKey" TEXT,
    "input" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusedAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusedAgentApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "threadId" TEXT,
    "action" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "versions" JSONB NOT NULL,
    "proposalHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvalMethod" TEXT,
    "result" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusedAgentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusedAgentNonce" (
    "issuer" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusedAgentNonce_pkey" PRIMARY KEY ("issuer","nonce")
);

-- CreateTable
CREATE TABLE "FocusedAgentContext" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "resourceIds" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusedAgentContext_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable
CREATE TABLE "FocusedAgentAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusedAgentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusedAgentUsage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusedAgentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusedAgentThread_userId_workspaceId_updatedAt_idx" ON "FocusedAgentThread"("userId", "workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "FocusedAgentMessage_threadId_createdAt_idx" ON "FocusedAgentMessage"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusedAgentRun_activeKey_key" ON "FocusedAgentRun"("activeKey");

-- CreateIndex
CREATE INDEX "FocusedAgentRun_status_createdAt_idx" ON "FocusedAgentRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusedAgentRun_userId_workspaceId_idempotencyKey_key" ON "FocusedAgentRun"("userId", "workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FocusedAgentApproval_userId_workspaceId_status_idx" ON "FocusedAgentApproval"("userId", "workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FocusedAgentApproval_userId_workspaceId_idempotencyKey_key" ON "FocusedAgentApproval"("userId", "workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FocusedAgentNonce_expiresAt_idx" ON "FocusedAgentNonce"("expiresAt");

-- CreateIndex
CREATE INDEX "FocusedAgentAudit_userId_workspaceId_createdAt_idx" ON "FocusedAgentAudit"("userId", "workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusedAgentUsage_requestId_key" ON "FocusedAgentUsage"("requestId");

-- AddForeignKey
ALTER TABLE "FocusedAgentMessage" ADD CONSTRAINT "FocusedAgentMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "FocusedAgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusedAgentRun" ADD CONSTRAINT "FocusedAgentRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "FocusedAgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusedAgentApproval" ADD CONSTRAINT "FocusedAgentApproval_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "FocusedAgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusedAgentUsage" ADD CONSTRAINT "FocusedAgentUsage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FocusedAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
