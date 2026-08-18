-- =============================================================================
-- Scale Plus Team Workspaces — PipeLeads LeadFinder binding + audit tables
--
-- *** DO NOT APPLY until the coordinated Pro Max Team Workspaces rollout is
-- *** explicitly approved. Purely additive; no existing table is modified.
--
-- This repo uses `prisma db push` (no prisma/migrations directory), so this
-- manual SQL is the reviewed artifact. Matching Prisma models are included as
-- a commented block at the bottom of prisma/schema.prisma; uncomment them and
-- run `npx prisma generate` only when this SQL is approved and applied.
-- Runtime code accesses these tables via $queryRaw/$executeRaw and fails
-- closed while they do not exist.
--
-- Dialect: PostgreSQL (DigitalOcean Managed PostgreSQL / Neon).
-- =============================================================================

-- One opaque central workspace id binds to exactly ONE existing local owner
-- tenant ("User".id), and one owner tenant hosts at most one workspace.
CREATE TABLE IF NOT EXISTS "ScaleWorkspaceBinding" (
    "workspaceId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaleWorkspaceBinding_pkey" PRIMARY KEY ("workspaceId"),
    CONSTRAINT "ScaleWorkspaceBinding_ownerUserId_key" UNIQUE ("ownerUserId"),
    CONSTRAINT "ScaleWorkspaceBinding_ownerUserId_fkey"
        FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Guest mutation audit: records the ACTUAL actor (member) separately from the
-- owner-scoped resource rows. Raw tokens/codes are never stored here.
CREATE TABLE IF NOT EXISTS "ScaleWorkspaceAuditEvent" (
    "id"                   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "workspaceId"          TEXT NOT NULL,
    "actorUserId"          TEXT NOT NULL,
    "ownerUserId"          TEXT NOT NULL,
    "actorKeycloakSubject" TEXT NOT NULL,
    "method"               VARCHAR(10) NOT NULL,
    "path"                 TEXT NOT NULL,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaleWorkspaceAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScaleWorkspaceAuditEvent_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScaleWorkspaceAuditEvent_ownerUserId_fkey"
        FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ScaleWorkspaceAuditEvent_workspaceId_createdAt_idx"
    ON "ScaleWorkspaceAuditEvent"("workspaceId", "createdAt");
