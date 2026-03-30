# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Vercel AI SDK** with OpenAI + Gemini
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
- **Prisma 7 requires a driver adapter** — client is instantiated with `PrismaPg` from `@prisma/adapter-pg`:
  ```ts
  // src/lib/prisma.ts
  import { PrismaPg } from "@prisma/adapter-pg"
  const adapter = new PrismaPg(process.env.DATABASE_URL!)
  new PrismaClient({ adapter })
  ```

### ensureUser Pattern

API routes that write to the database call `ensureUser(session)` from `src/lib/ensure-user.ts` to upsert the authenticated user before performing any operations. This handles the case where the `User` row doesn't yet exist in Postgres (e.g., first login via dev-auto-login).

### Environment Setup

Copy `.env.example` to `.env`. Key required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_URL` — app URL (`http://localhost:3000` for dev)
- `DEV_AUTO_LOGIN=true` — enables dev auto-login
- `APIFY_API_KEY` — Apify platform API key
- `APIFY_ACTOR_ENRICH_EMAIL=code_crafter/personal-email-finder` — person-level email enrichment actor
- `APIFY_ACTOR_ENRICH_PHONE=code_crafter/mobile-finder` — person-level phone enrichment actor
- `APIFY_ACTOR_PEOPLE`, `APIFY_ACTOR_LOCAL`, `APIFY_ACTOR_COMPANY`, `APIFY_ACTOR_DOMAIN`, `APIFY_ACTOR_INFLUENCER` — search actors (see `.env.example` for defaults)
- `MICRO_SERVICE_BASE` — ScaleCredits microservice URL (default `http://localhost:3002/api`)
- `SCALECREDITS_URL` — Credit purchase portal URL (e.g., `https://credits.scaleplus.gg`)
- `NEXT_PUBLIC_SCALECREDITS_URL` — Client-side credit purchase URL (exposed to browser)

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/providers/` - React context providers (SessionProvider)
- `src/components/leads/` - Lead table row, AI action sheet, label management
- `src/components/ui/location-autocomplete.tsx` - Location field with Nominatim autocomplete
- `src/lib/utils.ts` - `cn()` helper for className merging
- `src/lib/ensure-user.ts` - Upsert authenticated user into Prisma before writes
- `src/lib/pick-lead-fields.ts` - Whitelist valid Lead model fields from raw Apify output
- `src/lib/prisma.ts` - Singleton Prisma client with PrismaPg adapter
- `src/services/enrich-service.ts` - `enrichEmail`, `enrichPhone`, `enrichBulk` — call Apify actors and persist results
- `src/services/credits-service.ts` - ScaleCredits microservice proxy (`getBalance`, `consumeCredits`, `consumeTokenCredits`)
- `src/lib/credit-guard.ts` - `guardCredits` pre-check + `deductCredits` helpers for API routes
- `src/contexts/credits-context.tsx` - `CreditsProvider`, `useCredits`, `useCreditsCheck` hooks
- `src/types/credits.ts` - Credit system type definitions
- `src/auth.ts` - NextAuth configuration and type augmentation
- `docs/` - User guide, PRD, technical requirements

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/enrich/email` | POST | Enrich a single lead's email (`{ leadId }`) |
| `/api/enrich/phone` | POST | Enrich a single lead's phone (`{ leadId }`) |
| `/api/enrich/bulk` | POST | Bulk enrich all un-emailed leads in a list (`{ listId }`) |
| `/api/labels/apply` | POST/DELETE | Apply or remove a label on a lead entry (`{ entryId, labelId }`) |
| `/api/labels/remove` | POST | Remove a label from a lead entry (`{ entryId, labelId }`) |
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
