# Scale Plugin Channel

How third-party plugins from the Scale Plugin Store reach Lead Finder. The wire contract is the ScalePlus dashboard's "Scale Plugin Platform: wire contracts"; this page says how this app implements it and what an operator does to switch it on.

The channel is **off by default**. With `SCALE_PLUGINS_ENABLED` unset, every route below answers 404, nothing is queued, and the Plugins link is not shown.

## The shape of it

A plugin never talks to this app. It calls the ScalePlus dashboard, which checks the plugin's install and scopes and then calls this app with a signed service token. This app checks the token and the scopes again, itself.

| Piece | Where |
|---|---|
| Plugin service (dashboard calls in) | `/api/plugins/service/v1/{capabilities, tenants, actions/:action, proposals/:id}`, `src/server/plugins/service.ts` (pure) and `service.db.ts` |
| Capabilities contract | `docs/plugin-capabilities.json`, generated from `src/server/plugins/registry.ts` |
| Changes, proposals, the owner's decision | `src/server/plugins/changes.ts` |
| Events (this app calls the dashboard) | `src/server/plugins/events.ts` (queue), `job-events.ts` (hooks), `forwarder.ts` (send) |
| Plugins page and the frame | `/plugins`, `/plugins/<installId>`, `src/components/plugins/`, `src/server/plugins/frame.service.ts` |

It is the sibling of the Superpowers service at `/api/godmode/service/v1` and reuses its parts: the same tools and input schemas (`src/server/focused-agent/actions.ts`), the same priced plans and previews (`plans.ts`), the same hashed proposal rows (`FocusedAgentApproval`) and the same replay ledger (`FocusedAgentNonce`).

It does **not** reuse the Agent's gate. A plugin needs neither Pro Max nor the `LEADFINDER_AGENT_*` and `LEADFINDER_GODMODE_*` switches.

## Environment variables

| Variable | Meaning |
|---|---|
| `SCALE_PLUGINS_ENABLED` | `true` switches the channel on. |
| `SCALE_PLUGIN_SERVICE_SECRET` | The HS256 secret shared with the dashboard (its `PLUGIN_GATEWAY_SECRET_LEADFINDER`). At least 32 bytes; shorter, the channel stays off. |
| `SCALE_PLUGIN_GATEWAY_URL` | The dashboard's base URL. Default `https://app.scaleplus.gg`. |
| `NEXT_PUBLIC_SCALE_PLUGINS_ENABLED` | `true` at build time shows the Plugins link in the sidebar. The page and its API still check `SCALE_PLUGINS_ENABLED`. |

Scale Credits (`MICRO_SERVICE_BASE`, `INTERNAL_WEBHOOK_SECRET`) must be configured, as for any paid operation: prices and the owner's balance are read before anything is stored or started.

## Service token

`Authorization: Bearer <jwt>`, HS256. Dashboard to app: issuer `scaleplus-plugin-gateway`, audience `leadfinder-plugin-service-v1`. Checked in this order: signature, issuer, audience, expiry (at most 30 seconds of life, 5 seconds of skew), nonce, method, path with query string, SHA-256 of the raw body. Any failure is `401 invalid_service_token`.

The nonce (`jti`) is stored once in the `FocusedAgentNonce` table under the issuer `scaleplus-plugin-gateway` (a primary key, so a second use is refused by the database). Spent nonces are deleted on the scheduled tick.

`GET /capabilities` describes the app, so it accepts a token with no install claims. Every other route requires them.

## Tenants

A call names the ScalePlus workspace owner's Keycloak subject (`ownerSubject`), matched to `User.keycloakSubId`. A Lead Finder account belongs to one person, so an owner has exactly one tenant and its id is their `User.id`. An owner who has never signed in to Lead Finder has none (`404 tenant_not_found`); nothing is created for them. The `409 tenant_required` rule is implemented and tested, but cannot occur today.

## Areas, levels and actions

Scope is `leadfinder.<area>:<level>`. A higher level includes the lower ones in the same area.

| Area | read | write | act (needs approval unless `act_unattended`) |
|---|---|---|---|
| `leads` | `list-lists`, `get-list`, `list-labels`, `get-export-link` | `change-labels` | |
| `searches` | `list-recent-searches`, `get-search-run` | | `run-search`, `rerun-search` |
| `enrichment` | `get-enrichment-run` | | `enrich-leads`, `enrich-list`, `score-leads` |
| `credits` | `get-credits` | | |
| `agents` | `list-agents` | | `create-agent` |

**Everything that spends the owner's Scale Credits is `act`**: searches, enrichment, scoring (metered AI) and scheduling an AI Agent (which spends on every run). Labels are free and stay inside Lead Finder, so they are `write`.

Not exposed, on purpose: `interpret_request` (it spends metered AI on every call), and every handoff that pushes leads into PipeLeads CRM or MailBaser (another app's data).

- **read** runs and returns `200 { data }`.
- **write** runs at once.
- **act** with `act_unattended` for the area: priced, credit-checked and started in one call, `200 { data }` with a `runId` to poll (`get-search-run`, `get-enrichment-run`).
- **act** otherwise: `202 { status: "pending_approval", proposalId, expiresAt }`. The proposal's title starts with the plugin's name, its preview states the credit cost exactly as the Agent's preview does, and it waits 72 hours. `GET /proposals/:id` answers only the install that filed it.

Credits are checked before anything is stored or started, attended or not. Too few is `422 invalid_input` with a message that says so. They are checked again when the owner approves.

### Where the owner approves

- The top of `/plugins` ("Waiting for your approval"), which needs neither the Agent nor Pro Max.
- The Agent panel's approval card, for owners who have the Agent: plugin proposals are `FocusedAgentApproval` rows, so they appear there too, and a decision made there goes through the same plugin path.

Approving re-prices and re-checks the plan. If records or prices changed since the plugin asked, nothing runs and the proposal is reported as failed. An approved search, enrichment or scoring becomes the product's normal background job (the same one the app's own screens start), charged the usual way.

### Who did it

A plugin acts as the workspace owner, because the tables need a user. The plugin is recorded beside the owner in two new tables: `PluginProposal` (who asked for each consequential action) and `PluginActionLog` (every call, with `pluginId`, `installId`, `pluginName`, the action and its outcome). Lists, searches and jobs themselves show the owner.

## Events

| Type | Area | Sent when |
|---|---|---|
| `leadfinder.search.completed` | `searches` | a search job finished (`src/services/job-workers.ts`), or an AI Agent's own search (`agent-runner.ts`) |
| `leadfinder.list.updated` | `leads` | those searches saved leads to a list, or a plugin changed labels |
| `leadfinder.enrichment.completed` | `enrichment` | an enrichment or scoring job finished |
| `leadfinder.action.approved`, `.rejected`, `.expired` | | a proposal's outcome, sent only to the install that asked |

Payloads carry ids and counts only: never a lead's name, email or phone.

There is no `leadfinder.credits.low`: the balance lives in the Scale Credits service and this app has no hook for it. Labels and lists changed by a person on the app's own screens do not send `list.updated` yet.

How they are sent:

- An event is a row in `PluginEventOutbox`. Writing it never throws, so it cannot fail the job or approval that caused it.
- The row is sent in the background of the same process right after it is written, and again on every scheduled tick (`POST /api/ai/agent/run-scheduled`, the existing `npm run agents:scheduled` cron), which is what retries.
- Sent only for owners with at least one install (asked of the dashboard once per owner, kept 60 seconds per process). Everyone else's rows are deleted unsent.
- A failed send is retried after 1, 5, 15 and 60 minutes and 6 hours, on the next tick after that time; the sixth failure marks the row `FAILED` and leaves it. Delivered rows are deleted. The dashboard de-duplicates on the event id.
- The same tick expires proposals past their 72 hours and reports them.
- `approved` carries `status: "executed"` or `status: "failed"` with `result.error`.

## The frame

`/plugins` lists the owner's installs from the dashboard. Opening one loads `/plugins/<installId>?origin=<plugin origin>`:

- `<iframe sandbox="allow-scripts allow-forms allow-popups allow-downloads">`, never `allow-same-origin`.
- `src/proxy.ts` serves that page with `Content-Security-Policy: frame-src 'self' <Keycloak origin> <plugin origin>`. `'self'` and Keycloak are what the app's own sign-in needs; with no origin in the address, or a malformed one, no third-party origin is allowed. The origin in the address can only narrow what may be framed: the page frames nothing unless it equals the `pluginOrigin` the dashboard returns for that install. The page forces a full page load on the way in and on the way out, so the policy applies and does not follow the person to other screens.
- The frame pass is fetched by this app's server (`POST /api/platform/internal/frame-pass`) and handed to the frame by `postMessage`, never in a URL.
- Bridge: the host acts on a message only when it comes from that iframe's own window with origin `"null"` or the plugin's, and posts with target `"*"` to that window only. `scale.frame.navigate` opens a saved `list` of the owner's and ignores anything else.

Owner only. A Scale Plus teammate working in the owner's account (a guest workspace session) is a member here and is refused; Lead Finder has no admin seat on an account.

## Switching it on

1. Apply the migration `prisma/migrations/20261007120000_scale_plugin_channel` on purpose. **Nothing applies it for you**: the build only runs `prisma generate`, and the deploy is pull, install, build, restart. It adds three tables (`PluginProposal`, `PluginActionLog`, `PluginEventOutbox`) and alters no existing table.
2. On the dashboard: vendor `docs/plugin-capabilities.json`, set `PLUGIN_GATEWAY_SECRET_LEADFINDER` and `PLUGIN_GATEWAY_URL_LEADFINDER` (this app's base URL).
3. Here: set `SCALE_PLUGIN_SERVICE_SECRET` to the same secret, `SCALE_PLUGIN_GATEWAY_URL` if the dashboard is not at the default, then `SCALE_PLUGINS_ENABLED=true`. Set `NEXT_PUBLIC_SCALE_PLUGINS_ENABLED=true` before the build to show the link.
4. Make sure the scheduled tick is running (`PIPELEADS_AGENT_CRON_SECRET`, `npm run agents:scheduled`). Without it a failed event is never retried and no expiry is reported.

To switch it off, unset `SCALE_PLUGINS_ENABLED`. Pending plugin proposals can then no longer be approved, and queued events wait.

## Changing the action list

Edit `src/server/plugins/registry.ts`, then regenerate the contract:

```bash
UPDATE_PLUGIN_CAPABILITIES=1 npx vitest run src/server/plugins/capabilities.test.ts
```

That test fails when the committed file and the code disagree. Tests: `src/server/plugins/*.test.ts` and `src/lib/plugin-frame.test.ts`; none needs a database.
