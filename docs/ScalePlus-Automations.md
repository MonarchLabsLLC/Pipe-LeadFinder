# LeadFinder saved-prospect automations

## Supported contract

App key: `pipeleadsfinder` (separate from PipeLeads CRM's `pipeleads`). Source scope is an owned **ACTIVE LeadList**. The broker's destination `tenantId` is a separate identity.

| Kind | Operation | Fields |
| --- | --- | --- |
| Trigger | `lead_added_to_list` | Optional `entryId` |
| Trigger | `lead_label_added` | Optional `entryId`, `labelId` |
| Condition | `lead_in_list` | Optional `entryId` |
| Condition | `lead_has_label` | Required `labelId`, optional `entryId` |
| Action | `apply_existing_label` | Required `labelId`, optional `entryId` |

Catalog resources are `entries` and `labels`. Conditions/actions require a valid current `contact.email`. The source resolves an existing lead entry in the selected list by exact normalized email. An optional entry selector narrows the match; multiple remaining matches produce a conflict instead of guessing. Missing records are not created. Labels must already belong to the connected account.

These are saved prospects, **not account-owner identities or opt-in subscribers**. Events use `data.identityKind: prospect`, actual saved email and name, and source/list/entry/lead/label identifiers. Missing or invalid email prevents capture. No raw provider payload, company/social data, or consent claim is exported. Capturing a prospect must not grant email eligibility or subscription permission downstream. The coordinated broker and Groove receiver must implement neutral-prospect eligibility before this source is enabled; owner opt-in logic must not be substituted.

## Ownership and native behavior

The signed broker subject resolves only through unique `User.keycloakSubId`; the adapter does not provision users, relink by email, change roles, or alter native authentication. The list, lead and (when relevant) label must all belong to that exact current user. There is no disabled-account column in this schema. Archived lists are excluded even if the caller owns them.

Native SQL INSERT triggers on `LeadListEntry` and `LeadEntryLabel` capture actual persisted entries and labels, including the existing search-result persistence helper, single-label route, bulk-label route and list-copy operations. Native search, provider, credit, AI, notification and messaging behavior is unchanged. The new action performs only the existing label-assignment operation. It cannot start a search, enrich an email/phone, run AI, send a message, move a list or spend credits.

## Transaction and replay behavior

The additive migration creates four infrastructure tables and two triggers. Capture is atomic with the native transaction, including rollback. The trigger function pins the migration's current schema so native Prisma's schema-qualified writes work even when the connection's default search path differs. Apply the migration in the application's configured schema.

Each source event has a random source ID and a distinct stable envelope ID for each active binding. `occurredAt` is explicit UTC ISO8601 ending in `Z`. Explicit `eventKeys: []` exports nothing; omitted/null retains the compatibility default of all supported events. Durable binding request receipts stop old activation retries from undoing newer pauses. Binding subject, destination tenant and source scope cannot be reassigned.

Actions use an atomic idempotency receipt with the label assignment. Concurrent retries produce one assignment. An already-applied label returns its existing assignment as a durable no-op. Replay checks current account/list/lead/email/label ownership and the original assignment ID. A removed or replaced assignment fails; replay never recreates it. Receipt failures roll back the label write. A trusted transaction-local origin suppresses the action's immediate exported event, and later manual label events remain eligible.

## Delivery and runtime

The Next Node instrumentation starts this worker alongside the existing native job runtime. `PIPELEADS_JOBS_ENABLED` keeps its original effect; `SCALEPLUS_AUTOMATIONS_ENABLED` independently controls the source worker. Each process has one nonoverlapping delivery loop; PostgreSQL `FOR UPDATE SKIP LOCKED` prevents duplicate claims across processes. Up to 25 due rows are attempted every 15 seconds.

Immediately before HTTP, share locks protect the current account, lead/list/entry, optional label assignment and immutable active binding. Transfers, deletion, email/subject changes, archived lists, removed labels and paused/narrowed bindings cancel pending delivery. Callback timeout is ten seconds; retries retain IDs, back off from 30 seconds to 15 minutes, and stop after eight attempts. Failed rows remain durable for operator diagnosis.

Callbacks require HTTPS in production and reject redirects. A successful HTTP status alone is insufficient: `data.accepted === true` and `data.mapped !== false` are required. Empty/unmatched acknowledgements and ambiguous 409 responses remain failures. Service requests verify exact raw-body HMAC, five-minute timestamps and matching request IDs, with a 64 KiB body cap. The callback key is separate from the broker service key.

Database TLS requires the mapped provider CA with certificate verification. URL TLS overrides are removed. Only nonproduction loopback may use plaintext. The configured schema is validated before becoming a PostgreSQL search path; no runtime SQL identifier is derived unchecked from a request.

## Rollout and verification

Keep `SCALEPLUS_AUTOMATIONS_ENABLED=false` until source, MailBaser registry/neutral-prospect delivery gates and Groove editor/neutral receiver are deployed together. Source implementation and a configured catalog do not establish live workflow connectivity or prospect email permission.

Apply `prisma/migrations/add-scaleplus-automations.sql` in an explicit transaction in the configured source schema; do not use a broad production Prisma schema push. Pair `SCALEPLUS_AUTOMATION_SERVICE_SECRET` and the dedicated `PIPELEADSFINDER_AUTOMATION_WEBHOOK_SECRET` with the broker. Set the HTTPS callback URL. Restart only the verified LeadFinder application process. No new dependency is required.

Tests use a disposable PostgreSQL database named `leadfinder_automation_test` on localhost. They intentionally truncate synthetic data and must never run against production. The native schema uses `pipeleads` locally.

```sh
# DATABASE_URL must point only to the disposable local fixture.
npx prisma db push
npx prisma generate
AUTOMATION_TEST_DATABASE_URL="$DATABASE_URL" npx tsx --test tests/automations/adapter.integration.ts
npm test
npx tsc --noEmit
PIPELEADS_JOBS_ENABLED=false SCALEPLUS_AUTOMATIONS_ENABLED=false npm run build
```

The integration test uses the actual generated Prisma client, real native search-result persistence without external calls, PostgreSQL triggers/receipts and a signed local HTTP callback. Separate runtime tests execute the instrumentation entrypoint and verify both worker flags plus fail-closed TLS/schema settings. Prisma 7 transaction assumptions were checked against its versioned documentation; this does not upgrade the application to Prisma 8.

Production compatibility: the default `public` schema does not send a `search_path` startup option, because managed transaction poolers reject that option. Explicit non-default schemas still require a compatible connection. Certificate verification remains required.
