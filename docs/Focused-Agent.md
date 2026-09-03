# Focused Lead Finder Agent

This opt-in implementation is disabled by default. It is separate from the existing AI Assistant and scheduled AI Agent. A Git push does not deploy it or enable it for customers.

## Experience

The header Agent button opens a private right-hand panel, full-screen on mobile. Answers use safe Markdown; both user and assistant messages have a copy button that preserves the original text. Conversation history is saved server-side, scoped to the user and their workspace, and restored after refresh. Select one existing saved list and optionally up to 50 saved leads. Changing the signed-in identity clears active UI context.

Describe the prospects you want; the Agent asks for missing criteria and prepares a search preview. Search type must match an active owned list. Enrichment finds missing email or phone details and explicitly skips completed/ineligible records. Scoring uses the existing business context and configured AI model. All three operations require a human review card; the model cannot approve itself. No new prospecting schedules, outbound messages, list creation, deletion, or arbitrary cross-app calls are exposed.

Search/enrichment previews show current configured pricing, maximum units and credits, exact inputs/records, skipped records, and effects. Approval locks that server-owned price snapshot. Searches use the existing product matching policy; by default they skip existing entries and may fill blank fields without overwriting non-empty fields. AI conversations and scoring use the existing model and actual Scale Credits token accounting. Reads do not add an AI charge when called directly through MCP.

## Security and protocol

Native endpoints live under `/api/focused-agent`; service endpoints implement `/api/godmode/service/v1`. The bounded action registry is shared by both surfaces. Each request checks authoritative ClickCampaigns Pro Max entitlement and current destination-app access. Verified Keycloak subjects resolve to existing local users only; email matching, auto-provisioning, development login and unverified token decoding are not accepted by this Agent. Existing sessions must sign in again to obtain verified provenance.

Service requests require the shared bridge's 30-second HS256 signature, exact subject/audience/issuer, path/action/body binding, lineage, and a persistent one-use nonce. Distinct per-app credentials are mandatory. UI mutations additionally require same-origin requests and the action header. Only the authenticated UI or signed MCP human-elicitation evidence can approve an immutable proposal. `confirmed: true` is not an approval mechanism.

The UI may explicitly share its current list selection for two minutes while open. External Codex/Claude conversation text remains in those clients; this app records only tool activity, proposals and approved jobs.

## Durable jobs and billing

Native chat returns a durable run ID and executes after the response. Polling recovers queued chat runs; atomic claims prevent duplicate generation. Provider responses are persisted before usage charging and before tool dispatch. Interrupted/uncertain runs require review, never an automatic paid retry.

Approved searches, enrichment and scoring use existing pg-boss jobs. They have stable approval-based idempotency keys and zero automatic retries. Job execution rechecks access, input/approval binding, list/lead versions and pricing; enrichment performs an owner/version compare-and-swap before saving. Scoring checkpoints its provider result and charges tokens before parsing or saving. Unknown outcomes are retained for review rather than replayed. Partial enrichment failures are reported in job item records and summary counts. Completed jobs and charges are not duplicated by repeated approval requests.

## Rollout prerequisites

1. Review/apply `20260903000100_focused_agent` through the repository migration workflow in an explicitly authorized environment. It adds assistant-only records; it does not rewrite existing product data.
2. Configure a distinct `LEADFINDER_GODMODE_SERVICE_SECRET` and `CLICKCAMPAIGNS_GODMODE_BASE_URL`. Configure matching bridge settings and the actual Keycloak app role in ClickCampaigns; do not infer access from a plan display name.
3. Verify real Keycloak sign-in, existing OpenAI configuration, Scale Credits pricing/consumption and the durable job worker.
4. Independently enable `LEADFINDER_AGENT_ENABLED`, `LEADFINDER_GODMODE_ENABLED` and `LEADFINDER_AGENT_WRITES_ENABLED` only after staging tests. All default to false.
5. Use the private Superpowers installation/OAuth guide. The plugin is not listed in the public Codex plugin directory; customers do not paste developer API keys.

The Lead Finder-to-CRM handoff is a separate integration layer and must pass destination-owned approval, deduplication and access-loss tests before activation. Production integration and deployment are not implied by local tests.

## Verification

Use Node 24, `npm test`, `npx tsc --noEmit`, focused ESLint and `npm run build`. The focused integration suite runs only against an explicitly named disposable loopback database, with network/model/billing calls mocked. It covers ownership, revoked access, pricing, approval hashes/expiry/rejection, retry-safe jobs, record races, MCP approval/replay, private history and uncertain billing.
