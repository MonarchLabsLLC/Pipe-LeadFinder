-- Run after `prisma db push` creates LeadIdentity and its enum.
INSERT INTO "LeadIdentity" (id, "userId", "leadId", type, value, "createdAt")
SELECT DISTINCT ON (lead."userId", lower(trim(lead.email)))
  concat('li_', md5(lead."userId" || ':email:' || lower(trim(lead.email)))),
  lead."userId", lead.id, 'EMAIL'::"LeadIdentityType",
  lower(trim(lead.email)), now()
FROM "Lead" lead
WHERE nullif(trim(lead.email), '') IS NOT NULL
ORDER BY lead."userId", lower(trim(lead.email)), lead."createdAt"
ON CONFLICT ("userId", type, value) DO NOTHING;

INSERT INTO "LeadIdentity" (id, "userId", "leadId", type, value, "createdAt")
SELECT DISTINCT ON (lead."userId", normalized.value)
  concat('li_', md5(lead."userId" || ':linkedin:' || normalized.value)),
  lead."userId", lead.id, 'LINKEDIN'::"LeadIdentityType", normalized.value, now()
FROM "Lead" lead
CROSS JOIN LATERAL (
  SELECT lower(regexp_replace(regexp_replace(split_part(trim(lead."linkedinUrl"), '?', 1), '^https?://(www\.)?', ''), '/+$', '')) AS value
) normalized
WHERE nullif(trim(lead."linkedinUrl"), '') IS NOT NULL
ORDER BY lead."userId", normalized.value, lead."createdAt"
ON CONFLICT ("userId", type, value) DO NOTHING;

INSERT INTO "LeadIdentity" (id, "userId", "leadId", type, value, "createdAt")
SELECT DISTINCT ON (lead."userId", lower(trim(lead.platform)) || ':' || lower(regexp_replace(trim(lead.username), '^@', '')))
  concat('li_', md5(lead."userId" || ':social:' || lower(trim(lead.platform)) || ':' || lower(regexp_replace(trim(lead.username), '^@', '')))),
  lead."userId", lead.id, 'SOCIAL_USERNAME'::"LeadIdentityType",
  lower(trim(lead.platform)) || ':' || lower(regexp_replace(trim(lead.username), '^@', '')), now()
FROM "Lead" lead
WHERE nullif(trim(lead.platform), '') IS NOT NULL AND nullif(trim(lead.username), '') IS NOT NULL
ORDER BY lead."userId", lower(trim(lead.platform)) || ':' || lower(regexp_replace(trim(lead.username), '^@', '')), lead."createdAt"
ON CONFLICT ("userId", type, value) DO NOTHING;

INSERT INTO "LeadIdentity" (id, "userId", "leadId", type, value, "createdAt")
SELECT DISTINCT ON (lead."userId", normalized.value)
  concat('li_', md5(lead."userId" || ':domain:' || normalized.value)),
  lead."userId", lead.id, 'COMPANY_DOMAIN'::"LeadIdentityType", normalized.value, now()
FROM "Lead" lead
CROSS JOIN LATERAL (
  SELECT lower(split_part(regexp_replace(trim(lead."companyWebsite"), '^https?://(www\.)?', ''), '/', 1)) AS value
) normalized
WHERE lead."sourceType" IN ('COMPANY', 'LOCAL')
  AND nullif(trim(lead."companyWebsite"), '') IS NOT NULL
ORDER BY lead."userId", normalized.value, lead."createdAt"
ON CONFLICT ("userId", type, value) DO NOTHING;
