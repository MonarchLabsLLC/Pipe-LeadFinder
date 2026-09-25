# Agent-native Lead Finder

Lead Finder's Pro Max agent lets a person *talk to* the product: describe who
they want, answer a couple of tap-to-answer questions, approve a card, and get
results — then keep going (enrich, label, score, export, hand off, schedule).
It is the same house pattern as HD Helpdesk, MailBaser and Scale.gg, built
into this app (no sidecar service).

It extends the existing Focused Agent (`src/server/focused-agent/`,
[Focused-Agent.md](Focused-Agent.md)); there is one agent, one set of tables,
one approval path.

## The rules

1. **Two tool tiers only.** *Read* tools run immediately and change nothing.
   *Prepare* tools create a hashed, expiring proposal (`FocusedAgentApproval`).
   There is **no execute tool**: only a person pressing **Approve & run**
   (`POST /api/focused-agent/approvals/:id/decision`, or a signed MCP human
   approval) runs anything, through `decideProposal()`.
2. **Re-validate on approval.** Approval rebuilds the plan from the stored
   input and compares versions and preview (records, list, prices, business
   context, destination). Any change → `STALE_PROPOSAL`, prepare again.
   Jobs re-check again before they start (`job-guard.ts`).
3. **Pro Max on every call, fail-closed.** `requireAgentEntitlement()`
   (`access.ts`) runs inside `resolveActor()`, which every chat, state, run,
   approve and background step calls. Any error, timeout, unexpected answer or
   missing configuration denies. There is no positive cache on the server.
4. **Credits.** `requireCredits()` before each model step and before a
   proposal; each step's real input/output tokens are billed to Scale Credits
   (`tokenBillingPayload()` in `pricing.ts`, `provider: "openrouter"`, the
   billed model, idempotency key `focused-agent:<run>:<step>`). Approved paid
   work is charged at the price snapshot shown on the card.
5. **Audit.** Every tool result, proposal, approval, rejection and completion
   is a `FocusedAgentAudit` row.
6. **Never claim unapproved work.** The system prompt forbids saying anything
   started or ran unless a tool result shows its recorded status.

## Runtime

`runtime.ts`: Vercel AI SDK `generateText` with tools on OpenRouter DeepSeek
(`src/services/ai-runtime.ts`), up to `MAX_AGENT_STEPS = 8` steps per message,
run in the background (`after()`) and polled by the browser. Tools have no
`execute()`: every call is validated by the registry (`actions.ts`, zod,
strict) and dispatched after usage is recorded.

**Clarifying questions.** `ask_user` takes one question and 2–4 short options
(`askUserSchema` in `tools.ts`). It ends the turn: the runtime stores an
assistant message with `metadata.kind = "question"` (the UI draws buttons and
a "Something else" box) and a plain-text copy for the model's history. The
answer is simply the next user message. The prompt allows at most three
questions per request and says to ask only what `interpret_request`
(`interpretSearch()`) reports as missing.

## Tools

| Tool | Tier | Notes |
|---|---|---|
| `ask_user` | read | Tap-to-answer question; ends the turn |
| `interpret_request` | read | Wraps `interpretSearch()`; returns type, fields, `missingRequired` (token-billed) |
| `list_resources`, `get_list` | read | Owned lists and leads |
| `list_recent_searches` | read | Last searches with active lists |
| `list_labels` | read | Custom labels |
| `get_export_link` | read | CSV link for an owned list |
| `get_credits` | read | Balance and per-result prices |
| `get_handoff_options` | read | PipeLeads pipelines/stages or MailBaser lists/tags (suite-link options) |
| `get_run` | read | Approved job progress |
| `get_crm_destinations`, `get_crm_transfer_status` | read | GodMode CRM bridge (existing) |
| `prepare_search` | prepare | Existing list (`listId`) or **new list** (`newList.name`, created on approval) |
| `prepare_rerun_search` | prepare | A recent search into its own list |
| `prepare_enrichment` | prepare | Selected leads (≤50) |
| `prepare_bulk_enrichment` | prepare | Every lead in a list missing email/phone (≤500) |
| `prepare_scoring` | prepare | Selected leads |
| `prepare_label_change` | prepare | Apply/remove one label (≤50 leads); free |
| `prepare_handoff` | prepare | To PipeLeads CRM or MailBaser through `src/lib/suite-link/handoff.ts` |
| `prepare_scheduled_agent` | prepare | Creates an ACTIVE `AiAgent`, first run one period after approval |
| `prepare_crm_transfer` | prepare | GodMode CRM bridge (existing) |

The signed ClickCampaigns Superpowers (MCP) service exposes every tool above
except `ask_user` (`SERVICE_ACTIONS`; the MCP host asks its user itself):
`interpret_request`, `get_credits`, `list_recent_searches`, `list_labels`,
`get_export_link`, `get_handoff_options`, `prepare_rerun_search`,
`prepare_bulk_enrichment`, `prepare_label_change`, `prepare_handoff` and
`prepare_scheduled_agent`, alongside the original nine. They use the same
signature, Pro Max check, workspace scoping, `assertWrites()`, idempotency key
and proposal path. MCP differences:

- `prepare_search` and `prepare_scheduled_agent` take a structured
  `parameters` object (the in-app model sends a `parametersJson` string, which
  `normalizeToolInput()` turns into the same input). Scheduled-agent
  parameters are validated against the same strict per-type search schema.
- Proposal results keep `approvalUrl` (the in-app runtime strips it because
  the card is shown in chat). Nothing runs until
  `POST /proposals/:id/execute` carries the signed human approval grant for
  that exact proposal and hash.
- `get_export_link` returns absolute URLs built from `AUTH_URL`; the CSV
  download still requires the user's signed-in browser session.
- `interpret_request` is token-billed exactly as in-app, keyed by the MCP
  request's idempotency key.

Adding a tool: add it to `actions` with a strict zod schema and a tier; read
tools return data from a scoped query; prepare tools build a deterministic
plan in `plans.ts`/`plans-extra.ts` (input, preview, versions) and, for
non-job work, an executor in `executeExtraPlan()`. Add a test for scoping and
for "nothing happens before approval".

## UI

- `src/components/agent/` — `agent-welcome` (the "Who do you want to find?"
  front door), `agent-conversation` (timeline + composer), `choice-question`,
  `proposal-card`, `lead-results-card`, `agent-upsell-card`,
  `agent-front-door`, and the shared hooks `use-agent-access` and
  `use-agent-thread` (loading, polling, send, approve; the page and the dock
  stay on the same thread through a window event).
- `src/app/(dashboard)/lead-search/new-search/page.tsx` renders
  `AgentFrontDoor`: Pro Max → welcome, then the full-width conversation; no Pro
  Max (`PROMAX_REQUIRED`) → "Describe who you want" plus the upsell (links to
  `NEXT_PUBLIC_PROMAX_UPGRADE_URL`, default `https://scale.gg/pricing/`);
  agent off → "Describe who you want" only.
- `src/components/focused-agent/agent-panel.tsx` — the header **Agent**
  button and the docked panel. On ≥1024px `html.lf-agent-dock-open` pushes
  the page (`--lf-agent-dock-width` in `globals.css`); on phones it is
  full-screen. Context (list/lead selection, CRM transfer, Superpowers) lives
  in its collapsible **Context** section.

## Flags and environment

| Variable | Meaning | Production |
|---|---|---|
| `LEADFINDER_AGENT_ENABLED` | Agent UI and `/api/focused-agent/*` | `true` to launch (conversation, questions, read tools) |
| `LEADFINDER_AGENT_WRITES_ENABLED` | Preparing and approving paid/data-changing proposals | `true` after a live read-only check |
| `LEADFINDER_AGENT_HANDOFF_ENABLED` | GodMode CRM transfer tools (existing) | unchanged |
| `LEADFINDER_GODMODE_ENABLED` | ClickCampaigns MCP service (existing) | unchanged |
| `CLICKCAMPAIGNS_GODMODE_BASE_URL`, `LEADFINDER_GODMODE_SERVICE_SECRET` | Pro Max entitlement check | required (already set if MCP is live) |
| `MICRO_SERVICE_BASE`, `INTERNAL_WEBHOOK_SECRET` | Scale Credits | required |
| `OPEN_ROUTER_API_KEY` | Model | required |
| `PIPELEADS_SUITE_URL` + `LEADFINDER_SUITE_SERVICE_SECRET`, `MAILBASER_URL` + `LEADFINDER_MAILBASER_SERVICE_SECRET` | `prepare_handoff` destinations | already used by the one-click handoff |
| `NEXT_PUBLIC_PROMAX_UPGRADE_URL` | Upsell link | optional |

No database migration: questions live in message metadata and the new
proposal kinds are new `action` strings on the existing tables.

## Local development

The entitlement check calls ClickCampaigns and billing calls Scale Credits,
and the auto-login user has no Keycloak identity. For local work only:

```bash
LEADFINDER_AGENT_ENABLED=true
LEADFINDER_AGENT_WRITES_ENABLED=true
LEADFINDER_AGENT_DEV_BYPASS=promax   # or "none" to see the non-Pro Max upsell
```

`LEADFINDER_AGENT_DEV_BYPASS` (`dev-bypass.ts`) is honoured **only when
`NODE_ENV === "development"`** and ignored everywhere else (production, test,
`next start`). In development it accepts the auto-login session, answers the
entitlement check locally, uses a 1,000,000-credit balance and the published
price table, and records token usage as `dev_uncharged` instead of billing.
A `dev:` subject is always refused outside development. Model calls are real
(`OPEN_ROUTER_API_KEY`), and an approved search really calls Apify — keep
`resultsLimit` small.

Dev servers on the same host share cookies across ports; run a second app on
`127.0.0.1` with `AUTH_URL` to match.
