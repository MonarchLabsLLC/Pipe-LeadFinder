-- Durable Micro credit charges (see PendingCreditCharge in schema.prisma).
-- Additive and safe to re-run. Apply in the configured application schema:
--   npx prisma db execute --file prisma/migrations/add-pending-credit-charges.sql
-- Rollback (settle or export pending/owed rows first):
--   DROP TABLE IF EXISTS "PendingCreditCharge";
CREATE TABLE IF NOT EXISTS "PendingCreditCharge" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "creditUserId" TEXT NOT NULL,
    "email" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PendingCreditCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PendingCreditCharge_idempotencyKey_key" ON "PendingCreditCharge"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PendingCreditCharge_status_nextAttemptAt_idx" ON "PendingCreditCharge"("status", "nextAttemptAt");
