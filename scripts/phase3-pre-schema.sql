-- Run once before `prisma db push` when upgrading an existing PipeLeads DB.
-- A database backup is required before this script.
BEGIN;
LOCK TABLE "Lead", "LeadListEntry", "LeadList" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "userId" text;

-- Historical leads with no list are unreachable by any user and have no
-- owner that can be inferred safely. Remove them instead of assigning them to
-- an arbitrary tenant.
DELETE FROM "Lead" lead
WHERE NOT EXISTS (
  SELECT 1 FROM "LeadListEntry" entry WHERE entry."leadId" = lead.id
);

UPDATE "Lead" lead
SET "userId" = owner."userId"
FROM (
  SELECT entry."leadId", min(list."userId") AS "userId"
  FROM "LeadListEntry" entry
  JOIN "LeadList" list ON list.id = entry."listId"
  GROUP BY entry."leadId"
) owner
WHERE lead.id = owner."leadId" AND lead."userId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Lead" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION 'Lead ownership backfill was incomplete';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "LeadListEntry" entry
    JOIN "LeadList" list ON list.id = entry."listId"
    GROUP BY entry."leadId"
    HAVING count(DISTINCT list."userId") > 1
  ) THEN
    RAISE EXCEPTION 'A historical lead belongs to lists owned by multiple users';
  END IF;
END $$;

ALTER TABLE "Lead" ALTER COLUMN "userId" SET NOT NULL;
COMMIT;
