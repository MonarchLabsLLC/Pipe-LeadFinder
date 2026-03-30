# ScaleCredits Billing Integration — Handoff for Matt

**Last updated:** March 30, 2026
**App name in ScaleCredits:** `pipe-leadfinder` (registered as `PipeLeads` in admin UI)

---

## What's Done

The ScaleCredits integration is fully wired in code. Every search, enrichment, and AI action now:

1. **Pre-checks** credit balance before running (blocks if negative)
2. **Deducts** credits after successful completion (fire-and-forget)
3. **Displays** live balance in the sidebar (polls every 30s, 5s during active ops)
4. **Links** to `https://credits.scaleplus.gg` for purchasing

### Auth Pattern

PipeLeads uses **NextAuth Credentials** (not Keycloak), so it communicates with the ScaleCredits microservice via **internal webhook headers** instead of Bearer tokens:

```
x-internal-webhook: true
x-user-id: <session.user.id>
x-user-email: <session.user.email>
x-app-name: pipe-leadfinder
```

This uses the `isAuthenticatedOrInternal` middleware in ScaleCredits. In production, you may want to add `INTERNAL_WEBHOOK_SECRET` to both apps for signed requests.

### Env Vars (already set in .env)

| Variable | Value | Notes |
|----------|-------|-------|
| `MICRO_SERVICE_BASE` | `http://localhost:3002/api` | ScaleCredits microservice URL |
| `SCALECREDITS_URL` | `https://credits.scaleplus.gg` | Purchase portal (server-side) |
| `NEXT_PUBLIC_SCALECREDITS_URL` | `https://credits.scaleplus.gg` | Purchase portal (client-side) |

---

## Two Types of Credit Consumption

PipeLeads has **two distinct billing models** flowing into ScaleCredits:

### 1. Flat Credits (Searches + Enrichment)

These send a fixed `amount` to the `/api/micro/credits/consume` endpoint.

| Action | Code action key | Credits per result | Notes |
|--------|----------------|-------------------|-------|
| People Search | `search:people` | **3** per contact | LinkedIn professional profiles |
| Local Search | `search:local` | **1** per business | **Free if no email found** |
| Company Search | `search:company` | **1** per company | LinkedIn company data |
| Domain Search | `search:domain` | **1** per contact | All contacts at one domain |
| Influencer Search | `search:influencer` | **2** per profile | Instagram/TikTok/YouTube |
| Email Enrichment | `enrich:email` | **1** per lead | Only charged if email FOUND or POTENTIAL |
| Phone Enrichment | `enrich:phone` | **1** per lead | Only charged if phone FOUND |

**Payload example** (flat credits):
```json
{
  "amount": 30,
  "description": "search:people x 10",
  "metadata": {
    "appName": "pipe-leadfinder",
    "action": "search:people",
    "resultCount": 10,
    "listId": "abc-123",
    "searchType": "PEOPLE"
  }
}
```

### 2. Token-Based Credits (AI Assistant)

The AI Assistant generates personalized outreach messages per lead. It uses **OpenAI gpt-4o-mini** and sends token usage to the microservice.

**Payload example** (token-based):
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "inputTokens": 1250,
  "outputTokens": 450,
  "appName": "pipe-leadfinder"
}
```

The microservice looks up `gpt-4o-mini` in the `pricing` table and calculates credits from the per-million-token rates.

---

## What Matt Needs to Do in ScaleCredits Admin

### 1. Verify `gpt-4o-mini` is in the Pricing Table

Go to **Admin > Pricing Configuration** in ScaleCredits and check that `gpt-4o-mini` has a row in the **Text Models** pricing table.

If it's missing, add it:

| Field | Value | Notes |
|-------|-------|-------|
| Model | `gpt-4o-mini` | Exact string — this is what the code sends |
| Provider | `openai` | |
| Input per million tokens (USD) | `$0.15` | OpenAI's current price (verify at openai.com/pricing) |
| Output per million tokens (USD) | `$0.60` | OpenAI's current price |
| Multiplier | `2.0` | Our standard 2x markup (adjust per business goals) |

> **Current OpenAI pricing for gpt-4o-mini (as of March 2026):**
> - Input: $0.15 / 1M tokens
> - Output: $0.60 / 1M tokens
> - Cached input: $0.075 / 1M tokens
>
> At 2x multiplier, a typical AI Assistant action (~1,500 input + ~500 output tokens) would cost roughly **1-2 display credits**.

### 2. Configure Project Multiplier for `pipe-leadfinder`

Go to **Admin > Project Multipliers** and check if `pipe-leadfinder` has a row in the `project_multipliers` table.

If it's missing, add it:

| Field | Value | Notes |
|-------|-------|-------|
| Project | `pipe-leadfinder` | Must match the `appName` sent in payloads |
| Multiplier | `1.0` | Adjust if PipeLeads should have different pricing |
| Minimum Credits | `0` | Set to e.g. `10` if you want a minimum charge per API call |

### 3. Verify User ID Mapping

PipeLeads sends `x-user-id: dev-admin-001` in development. In production with Keycloak, this will be the Keycloak `sub` (UUID).

The ScaleCredits microservice auto-creates user records when it sees a new `x-user-id`. Verify this works by:
1. Start both apps locally
2. Run a search in PipeLeads
3. Check the ScaleCredits admin for the new user + ledger entry

### 4. (Production) Add Webhook Secret

For production, set the same secret in both apps:

**ScaleCredits (.env):**
```
INTERNAL_WEBHOOK_SECRET=some-long-random-secret
```

**PipeLeads (.env):**
```
INTERNAL_WEBHOOK_SECRET=some-long-random-secret
```

Then update `src/services/credits-service.ts` `internalHeaders()` function to include:
```
"x-internal-webhook-secret": process.env.INTERNAL_WEBHOOK_SECRET
```

(Not done yet — currently relies on trusted-network `x-internal-webhook: true` header, which works for dev and trusted internal networks.)

### 5. Set PipeLeads-Specific Exempt Users (Optional)

If certain users (e.g., internal QA, demo accounts) should not be charged for PipeLeads:

Go to **Admin > User Management** and add them to the exempt list for `pipe-leadfinder`. ScaleCredits will record usage with `exempted: true` and charge 0 credits.

---

## Apify Actor Costs (Our Wholesale Cost)

These are the Apify actors we call. PipeLeads pays Apify per actor run — this is our cost, separate from what we charge users in credits.

| Actor | Apify ID | Est. Cost per Run | What It Does |
|-------|----------|-------------------|-------------|
| People Search | `harvestapi/linkedin-profile-search` | ~$0.005/result | LinkedIn profile search by role/location |
| Local Search | `agents/google-maps-search` | ~$0.002/result | Google Maps business scraper |
| Company Search | `apimaestro/linkedin-companies-search-scraper` | ~$0.005/result | LinkedIn company search |
| Domain Search | `george.the.developer/company-enrichment-api` | ~$0.01/lookup | All contacts at a domain |
| Influencer Search | `alizarin_refrigerator-owner/influencer-discovery---find-influencers-across-social-platforms` | ~$0.01/result | Cross-platform influencer finder |
| Email Enrichment | `code_crafter/personal-email-finder` | ~$0.02/lookup | Finds email from LinkedIn URL |
| Phone Enrichment | `code_crafter/mobile-finder` | ~$0.02/lookup | Finds phone from LinkedIn URL |

> **Note:** Apify pricing is per-compute-unit, not fixed per result. The estimates above are based on typical run sizes. Check your Apify dashboard for actual costs. Our credit pricing should cover these costs + margin.

### Margin Analysis

| Action | Our wholesale cost | Credits charged | Credit value (at 200 credits/$1) | Margin |
|--------|-------------------|----------------|----------------------------------|--------|
| People Search (1 lead) | ~$0.005 | 3 credits | $0.015 | ~3x |
| Local Search (1 biz) | ~$0.002 | 1 credit | $0.005 | ~2.5x |
| Email Enrichment (1 lead) | ~$0.02 | 1 credit | $0.005 | **negative** |
| Phone Enrichment (1 lead) | ~$0.02 | 1 credit | $0.005 | **negative** |

> **Action needed:** Enrichment credits may need to be raised from 1 to 3-5 credits per lead to maintain margin, or bundled into the search cost. The enrichment actors (`code_crafter/personal-email-finder` and `code_crafter/mobile-finder`) are the most expensive per-call.

---

## OpenAI AI Assistant Costs

| Model | Provider | Input Price | Output Price | Typical Action | Est. Tokens | Est. Cost | Credits (2x markup) |
|-------|----------|------------|-------------|----------------|-------------|-----------|---------------------|
| `gpt-4o-mini` | OpenAI | $0.15/1M | $0.60/1M | DM generation | ~1,500 in / ~500 out | ~$0.0005 | ~1-2 credits |
| `gpt-4o-mini` | OpenAI | $0.15/1M | $0.60/1M | Summary | ~2,000 in / ~800 out | ~$0.0008 | ~2-3 credits |
| `gpt-4o-mini` | OpenAI | $0.15/1M | $0.60/1M | Subject lines | ~1,200 in / ~300 out | ~$0.0004 | ~1 credit |

AI actions are very cheap with `gpt-4o-mini`. At 2x multiplier, a typical action costs 1-3 display credits. This is well within margin.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/services/credits-service.ts` | All microservice calls (getBalance, consume, consumeTokens) |
| `src/lib/credit-guard.ts` | guardCredits() and deductCredits() helpers |
| `src/app/api/credits/route.ts` | GET /api/credits — frontend balance endpoint |
| `src/contexts/credits-context.tsx` | React context + useCredits() hook |
| `src/types/credits.ts` | TypeScript interfaces |
| `src/components/layout/sidebar.tsx` | Live balance display |
| `CREDIT_COSTS` in credits-service.ts | Flat credit amounts per action |

---

## Testing Checklist

- [ ] Start ScaleCredits microservice on port 3002
- [ ] Start PipeLeads on port 3060
- [ ] Verify sidebar shows a credit balance (not "0" or "...")
- [ ] Run a People Search — verify credits deducted in ScaleCredits ledger
- [ ] Run a Local Search with no emails — verify 0 credits charged
- [ ] Run email enrichment — verify 1 credit charged only if email found
- [ ] Run an AI Assistant action — verify token-based credits in ledger
- [ ] Set balance to negative in admin — verify searches are blocked with 402
- [ ] Click Credit Wallet — verify it opens credits.scaleplus.gg
- [ ] Verify `gpt-4o-mini` pricing row exists in ScaleCredits admin
- [ ] Verify `pipe-leadfinder` row exists in project_multipliers
- [ ] (Production) Set INTERNAL_WEBHOOK_SECRET in both apps
- [ ] Review enrichment credit pricing — may need increase for margin
