# One-click handoff: Add to PipeLeads and Add to MailBaser

Lead Finder can push saved leads straight into the owner's PipeLeads Suite CRM and
MailBaser account. Lead Finder is the **caller**; the Suite and MailBaser are the
receivers. Nothing is queued: each send is one signed, synchronous request of at
most 50 leads.

## What the user sees

- A **Send to** column on every lead row and two buttons in the selection bar:
  **PipeLeads** and **MailBaser**. A button is hidden unless its target is configured
  (`GET /api/handoff/status`).
- PipeLeads: the button sends at once with the remembered choices (default: contact
  and company, no deal). The chevron opens "Also create a deal" (pipeline and stage,
  loaded lazily; only OPEN stages are offered) and tag names.
- MailBaser: the first click opens a list and tag picker; later clicks reuse the
  remembered choice. Leads without a usable email are skipped before sending.
- Choices are kept in `localStorage` under `leadfinder:handoff:<target>:<userId>`.
- Bulk selections are sent in sequential batches of 50 and the counts are summed.
- A toast reports "Added N to X: a new, b updated, c skipped" with an **Open** action
  (`<PIPELEADS_SUITE_URL>/crm/contacts` or `<MAILBASER_URL>/contacts`). Receiver error
  messages (for example `mailbaser_account_required`) are shown as they are.

## Environment

| Variable | Purpose |
| --- | --- |
| `PIPELEADS_SUITE_URL` | Suite base URL, e.g. `https://go.pipeleads.ai` |
| `LEADFINDER_SUITE_SERVICE_SECRET` | HMAC secret shared with the Suite (at least 32 chars) |
| `MAILBASER_URL` | MailBaser base URL, e.g. `https://mailbaser.com` |
| `LEADFINDER_MAILBASER_SERVICE_SECRET` | HMAC secret shared with MailBaser (at least 32 chars) |

A target is enabled only when its URL parses as http(s) and its secret has at least 32
characters. Trailing slashes are stripped. Disabled targets answer 404 and their
buttons are hidden. No database migration is needed.

## Routes (session-authenticated)

| Route | Does |
| --- | --- |
| `GET /api/handoff/status` | `{ pipeleads: boolean, mailbaser: boolean }` |
| `GET /api/handoff/pipeleads/options` | Suite pipelines, stages and tags for the user |
| `POST /api/handoff/pipeleads/send` | `{ leadIds (1..50), createDeals?, pipelineId?, stageId?, tagNames? (<= 20) }` |
| `GET /api/handoff/mailbaser/options` | MailBaser lists and tags for the user |
| `POST /api/handoff/mailbaser/send` | `{ leadIds (1..50), listIds?, tagIds?, tagNames? }` |

Send answers `{ results, counts: { created, updated, skipped }, openUrl }`.

Order of checks: target configured (404) -> signed in (401) -> `resolveWorkspaceScope`
-> **owner only** (a guest in a team workspace gets 403 "Only the workspace owner can
send leads to PipeLeads/MailBaser"; the proxy gate already blocks `/api/handoff/*` for
guests because it is not on the member allowlist) -> the user must have a Keycloak
subject (409 `keycloak_subject_required`) -> body validation (400, `too_many_leads`
above 50).

Leads are loaded only through the owner's own lists (the same scoping as the lead
routes, with no admin bypass). Ids outside that scope are reported as `skipped`
with reason `not_found` and never sent. Receiver errors keep their message: 409 stays
409, a timeout is 504, a rejected signature or missing receiver is 502.

## Wire contract (summary)

Code: `src/lib/suite-link/` (`signing.ts`, `config.ts`, `client.ts`, `payload.ts`,
`handoff.ts`).

- Headers: `content-type: application/json`, `x-scaleplus-app: pipeleadsfinder`,
  `x-scaleplus-timestamp` (unix seconds), `x-scaleplus-request-id` (fresh UUID per
  call, equal to `body.requestId`), `x-scaleplus-signature` = lowercase hex
  HMAC-SHA256(secret, `${timestamp}.${requestId}.${rawBody}`).
- Identity in every body: `subject` (the user's Keycloak subject), `email`, `name?`.
- Suite: `POST /api/internal/leadfinder/options` and `/api/internal/leadfinder/leads`
  (`leads[]` with `externalId` = Lead Finder lead id, names, email, phone, title,
  LinkedIn, location, company fields, `sourceListName`; plus `createDeals`,
  `pipelineId?`, `stageId?`, `tagNames?`).
- MailBaser: `POST /api/internal/scaleplus/leadfinder/options` and
  `/api/internal/scaleplus/leadfinder/contacts` (`contacts[]` with `externalId`,
  `email`, names, phone, company, title; plus `listIds?`, `tagIds?`, `tagNames?`).
- Receivers are idempotent by `requestId`, answer plain JSON (a `{ data }` wrapper is
  tolerated) and errors as `{ error: { code, message } }`.
- Empty strings are sent as missing; lengths are clamped to the receivers' limits;
  an email is sent only when it is not marked NOT_FOUND and looks like an email.
- Timeout: 20 seconds per call.

## Tests

`src/lib/suite-link/suite-link.test.ts` (signing vector, config rules, payload mapping,
batching) and `src/lib/suite-link/routes.test.ts` (401/404/403/409/400, scope, guest
rule, signed outbound body, error pass-through) with the outbound `fetch` mocked.
