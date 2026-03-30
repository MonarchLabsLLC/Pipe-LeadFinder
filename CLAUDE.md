# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Use Ref MCP for API Documentation

**ALWAYS use the Ref MCP tool (`ref_search_documentation` / `ref_read_url`) when working with external API models, SDKs, or libraries.** This includes OpenAI, Vercel AI SDK, Apify, Prisma, NextAuth, and any other third-party API. Do not rely on memory alone — check the current docs to avoid using deprecated models, removed endpoints, or outdated patterns.

## Project

**Pipe-LeadFinder** (package: `pipedrive-suite`) — a Scale.gg application built on an AI-agent-optimized Next.js starter. Requires **Node.js 24.x LTS**.

## Commands

```bash
npm run dev      # Start dev server (Turbopack) - auto-login enabled
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

### Database (Prisma 7)
```bash
npx prisma db push           # Push schema changes (dev)
npx prisma migrate dev       # Create migration
npx prisma generate          # Regenerate client
npx prisma studio            # Visual database browser
```

### UI Components (shadcn/ui)
```bash
npx shadcn@latest add <component>    # Add component (button, card, etc.)
```

## Architecture

### Tech Stack
- **Next.js 15** (App Router, Turbopack)
- **React 19** with Server Components
- **TypeScript 5**, **Tailwind 4**, **shadcn/ui**
- **NextAuth 5** (Auth.js), **Prisma 7** (PostgreSQL)
- **React Query**, **Zod**, **React Hook Form**
- **Vercel AI SDK 6** with OpenAI (`@ai-sdk/openai`) + Google Gemini (`@ai-sdk/google`)
- **Tiptap 3** (rich text editor), **Firecrawl** (web scraping), **Apify** (web automation), **Pexels** (stock photos)

### Authentication Pattern

Development mode has automatic authentication bypass:

1. `src/middleware.ts` - Intercepts requests, redirects unauthenticated users to `/api/auth/dev-login` in dev mode
2. `src/app/api/auth/dev-login/route.ts` - Signs in automatically as `admin@GrooveDigital.com`
3. `src/auth.ts` - NextAuth config with `DEV_USER` constant, type augmentation for `role` field

**In development**: No login required. Visit any page → auto-redirected → auto-signed in.
**In production**: Redirects to `/login` (needs implementation).

Session is available via:
- Server Components: `import { auth } from "@/auth"` → `const session = await auth()`
- Client Components: `import { useSession } from "next-auth/react"`

### Page Structure

All authenticated pages live under the `(dashboard)` route group, which wraps content in `AppSidebar` + `Topbar` layout:

- `/lead-search/new-search` — search form (People, Local, Company, Domain, Influencer)
- `/lead-search/saved-lists` — list management with leads table
- `/lead-search/custom-labels` — label CRUD for lead organization
- `/ai/ai-assistant` — per-lead AI actions (DM, summary, subject lines, etc.)
- `/ai/ai-agent` — automated prospecting pipeline builder
- `/ai/knowledge-base` — business profile + data sources for AI personalization
- `/admin/[...slug]` — admin pages (role-restricted)
- `/resources/support` — support page
- `/resources/tutorials` — tutorial content

### Styling

Theme defined in `src/app/globals.css`:
- OKLCH color space for all colors
- CSS variables in `:root` (light) and `.dark` (dark mode)
- `@theme inline` block maps to Tailwind utilities
- Fonts: Inter (sans), JetBrains Mono (mono)

To update theme: `npx shadcn@latest add https://tweakcn.com/r/themes/<id>`

### Prisma

- Schema: `prisma/schema.prisma`
- Generated client outputs to: `src/generated/prisma`
- Database: DigitalOcean Managed PostgreSQL (or Neon — see `.env.example`)
- Import client from: `import { PrismaClient } from "@/generated/prisma"`
- Import enums from: `import { SearchType } from "@/generated/prisma/enums"`
- **Prisma 7 requires a driver adapter** — client is instantiated with `PrismaPg` from `@prisma/adapter-pg` in `src/lib/prisma.ts`
- SSL: auto-detects DigitalOcean CA cert at `/etc/ssl/digitalocean/ca-certificate.crt`; falls back to `rejectUnauthorized: false` for other remote hosts; disabled for localhost
- The `?sslmode=` param is stripped from `DATABASE_URL` at runtime (SSL is handled by the adapter)

### ensureUser Pattern

API routes that write to the database call `ensureUser(session)` from `src/lib/ensure-user.ts` to upsert the authenticated user before performing any operations. This handles the case where the `User` row doesn't yet exist in Postgres (e.g., first login via dev-auto-login).

### Search Route Pattern

All five search types (`/api/search/people`, `/api/search/local`, `/api/search/company`, `/api/search/domain`, `/api/search/influencer`) follow an identical flow:

1. `auth()` → verify session
2. `ensureUser(session)` → upsert User row
3. `guardCredits()` → pre-check credit balance (returns 402 if insufficient)
4. Zod validation via schemas in `src/lib/validators/search.ts`
5. Create `SearchHistory` record (status: PENDING → RUNNING)
6. `executeSearch()` → dispatches to the correct Apify actor via env var mapping
7. `pickLeadFields()` → whitelist raw Apify output to valid `Lead` model fields
8. Create `Lead` + `LeadListEntry` records
9. `deductCredits()` → fire-and-forget credit consumption
10. Update `SearchHistory` (status: COMPLETED, resultCount)

### AI Service Architecture

- **AI Assistant** (`/api/ai/assistant`): Uses Vercel AI SDK `streamText` with `openai()` provider. Builds prompts from lead context + business profile (Knowledge Base). Each `AiActionType` (DIRECT_MESSAGE, SUMMARY, SUBJECT_LINE, etc.) has a dedicated system prompt in `src/services/ai-service.ts`. Token costs charged via `consumeTokenCredits()` in `onFinish`.
- **Knowledge Base** (`/api/ai/knowledge-base`): CRUD for `BusinessProfile` + `DataSource` records. Data sources can be WEBSITE (crawled via Firecrawl), TEXT, QA, or PDF. The business context is injected into all AI prompts.
- **AI Agents** (`/api/ai/agent`): CRUD + run endpoint for `AiAgent` model (automated prospecting pipelines).
- **Prompt Templates** (`/api/ai/prompts`): CRUD for reusable `PromptTemplate` records.

### Environment Setup

Copy `.env.example` to `.env`. Key required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_URL` — app URL (`http://localhost:3000` for dev)
- `DEV_AUTO_LOGIN=true` — enables dev auto-login
- `OPENAI_API_KEY` — for AI assistant features
- `GOOGLE_GENERATIVE_AI_API_KEY` — for Gemini (also aliased as `GEMINI_API_KEY`, `GOOGLE_API_KEY`)
- `APIFY_API_KEY` — Apify platform API key
- `APIFY_ACTOR_ENRICH_EMAIL=code_crafter/personal-email-finder` — person-level email enrichment actor
- `APIFY_ACTOR_ENRICH_PHONE=code_crafter/mobile-finder` — person-level phone enrichment actor
- `APIFY_ACTOR_PEOPLE`, `APIFY_ACTOR_LOCAL`, `APIFY_ACTOR_COMPANY`, `APIFY_ACTOR_DOMAIN`, `APIFY_ACTOR_INFLUENCER` — search actors (see `.env.example` for defaults)
- `FIRECRAWL_API_KEY` — for Knowledge Base website crawling
- `PEXELS_API_KEY` — stock photo integration
- `MICRO_SERVICE_BASE` — ScaleCredits microservice URL (default `http://localhost:3002/api`)
- `SCALECREDITS_URL` — Credit purchase portal URL (e.g., `https://credits.scaleplus.gg`)
- `NEXT_PUBLIC_SCALECREDITS_URL` — Client-side credit purchase URL (exposed to browser)

### Key Directories

- `src/app/(dashboard)/` — All authenticated pages (sidebar + topbar layout)
- `src/app/api/search/` — Per-type search routes (people, local, company, domain, influencer)
- `src/app/api/ai/` — AI assistant, agent, knowledge-base, and prompt template routes
- `src/app/api/enrich/` — Email/phone enrichment routes
- `src/components/layout/` — `AppSidebar`, `Topbar`
- `src/components/leads/` — Lead table row, AI action sheet, label management
- `src/components/search/` — Search form components
- `src/services/` — Business logic layer:
  - `search-service.ts` — Apify actor dispatch + result normalization per search type
  - `enrich-service.ts` — Email/phone enrichment via Apify actors, persists results
  - `ai-service.ts` — System prompts, business/lead context builders
  - `credits-service.ts` — ScaleCredits microservice proxy (retry + timeout logic)
  - `knowledge-base-service.ts` — Business profile + data source management
- `src/lib/validators/` — Zod schemas: `search.ts`, `list.ts`, `label.ts`, `prompt.ts`
- `src/lib/credit-guard.ts` — `guardCredits` pre-check + `deductCredits` fire-and-forget
- `src/lib/pick-lead-fields.ts` — Whitelist valid Lead model fields from raw Apify output
- `src/lib/apify.ts` — Singleton `ApifyClient` instance
- `src/lib/prisma.ts` — Singleton Prisma client with PrismaPg adapter + SSL config
- `src/contexts/credits-context.tsx` — `CreditsProvider`, `useCredits`, `useCreditsCheck` hooks
- `src/types/credits.ts` — Credit system type definitions
- `src/auth.ts` — NextAuth configuration and type augmentation
- `docs/` — PRD, technical requirements, user guide, implementation plan

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/search/people` | POST | People search via LinkedIn (`{ listId, description, location, ... }`) |
| `/api/search/local` | POST | Local business search via Google Maps |
| `/api/search/company` | POST | Company search via LinkedIn |
| `/api/search/domain` | POST | Domain/company enrichment |
| `/api/search/influencer` | POST | Influencer discovery across platforms |
| `/api/search/[searchId]/status` | GET | Poll search status |
| `/api/enrich/email` | POST | Enrich a single lead's email (`{ leadId }`) |
| `/api/enrich/phone` | POST | Enrich a single lead's phone (`{ leadId }`) |
| `/api/enrich/bulk` | POST | Bulk enrich all un-emailed leads in a list (`{ listId }`) |
| `/api/ai/assistant` | POST | Stream AI-generated content for a lead (`{ leadId, actionType }`) |
| `/api/ai/agent` | GET/POST | List or create AI agents |
| `/api/ai/agent/[id]` | GET/PUT/DELETE | CRUD single agent |
| `/api/ai/agent/[id]/run` | POST | Execute an agent pipeline |
| `/api/ai/knowledge-base` | GET/POST | Get or update business profile |
| `/api/ai/knowledge-base/sources` | GET/POST | List or add data sources |
| `/api/ai/knowledge-base/sources/[id]` | PUT/DELETE | Update or remove a data source |
| `/api/ai/prompts` | GET/POST | List or create prompt templates |
| `/api/ai/prompts/[id]` | PUT/DELETE | Update or delete a prompt template |
| `/api/labels/apply` | POST/DELETE | Apply or remove a label on a lead entry |
| `/api/labels/remove` | POST | Remove a label from a lead entry |
| `/api/leads` | GET | Query leads with filters |
| `/api/lists/[id]/history` | GET | Fetch search history for a list (last 50) |
| `/api/lists/[id]/export` | GET | Download CSV of all leads in a list |
| `/api/credits` | GET | Get user credit balance (or `?action=check` for pre-op availability) |
| `/api/location-search` | POST | Nominatim location autocomplete (`{ query }`) |

### ScaleCredits Integration

The app uses an external **ScaleCredits** microservice for metered billing. All communication goes through `src/services/credits-service.ts` using internal webhook auth headers (`x-internal-webhook: true`, `x-user-id`, `x-user-email`).

**Flow for search routes:** pre-check via `guardCredits()` before running the search, then `deductCredits()` after results are returned.

**Flow for enrichment routes:** pre-check via `guardCredits()` before enrichment, then charge only on success (data found).

**Flow for AI assistant:** token-based consumption via `consumeTokenCredits()` called in the Vercel AI SDK `onFinish` callback.

**Frontend:** `CreditsProvider` (`src/contexts/credits-context.tsx`) polls `/api/credits` every 30 seconds (accelerates to every 5 seconds during active operations). The `useCredits` hook exposes balance; `useCreditsCheck` validates availability before starting an operation.

**Credit costs:**

| Operation | Cost |
|-----------|------|
| People Search | 3 per contact |
| Local Search | 1 per business (free if no email found) |
| Company Search | 1 per company |
| Domain Search | 1 per contact |
| Influencer Search | 2 per profile |
| Enrich email/phone | 1 per lead |
