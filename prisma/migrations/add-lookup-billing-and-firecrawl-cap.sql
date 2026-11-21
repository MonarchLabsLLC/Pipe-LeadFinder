-- Additive and safe to re-run. Apply in the configured application schema:
--   npx prisma db execute --file prisma/migrations/add-lookup-billing-and-firecrawl-cap.sql
-- Rollback:
--   ALTER TABLE "SearchHistory" DROP COLUMN IF EXISTS "billableCount";
--   DROP TABLE IF EXISTS "FirecrawlUsage";
ALTER TABLE "SearchHistory" ADD COLUMN IF NOT EXISTS "billableCount" INTEGER;
CREATE TABLE IF NOT EXISTS "FirecrawlUsage" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FirecrawlUsage_pkey" PRIMARY KEY ("userId", "day")
);
