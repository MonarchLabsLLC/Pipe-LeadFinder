# Pipe-LeadFinder

AI-powered lead intelligence platform built on Next.js and Apify. Find, enrich, and manage business leads through five specialized search types with AI-powered research and outreach personalization.

Part of the [Scale.gg](https://scale.gg) ecosystem.

## What It Does

- **5 Search Types** — People, Local Business, Company, Domain, and Influencer searches powered by Apify actors
- **Saved Lists** — organize leads into lists with filtering, search, and bulk operations
- **Data Enrichment** — one-click email and phone number discovery
- **AI Assistant** — generate personalized DMs, subject lines, intros, and summaries per lead
- **AI Agents** — automated prospecting pipelines (search → enrich → action → CRM)
- **Knowledge Base** — business profile that powers AI personalization

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL + Prisma 7 |
| Auth | NextAuth 5 (Auth.js) |
| Data Engine | Apify (lead sourcing + enrichment) |
| AI | Vercel AI SDK 6 (OpenAI + Gemini) |
| Scraping | Firecrawl (Knowledge Base website crawling) |
| State | React Query 5, Zod 4, React Hook Form 7 |
| Runtime | Node.js 24.x LTS |

## Quick Start

### 1. Install

```bash
git clone <repo-url> pipe-leadfinder
cd pipe-leadfinder
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `APIFY_API_KEY` — your Apify API token
- `OPENAI_API_KEY` — for AI Assistant features

### 3. Database

```bash
npx prisma db push
```

### 4. Run

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — auto-logged in as `admin@GrooveDigital.com` in dev mode.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Database

```bash
npx prisma db push           # Push schema changes (dev)
npx prisma migrate dev       # Create migration
npx prisma generate          # Regenerate client
npx prisma studio            # Visual database browser
```

## Documentation

- [PRD](docs/PRD.md) — product requirements and feature specifications
- [Technical Requirements](docs/Technical-Requirements-Doc.md) — architecture, schema, API specs
- [User Guide](docs/User-Guide.md) — end-user documentation
- [Implementation Plan](docs/implementation-plan.md) — phased build plan with subagent tasks

## Themes

Dual theme system with warm (amber) and cool (indigo) palettes, each with light and dark mode. Theme selection persists via localStorage.

## License

Proprietary — GrooveDigital / Scale.gg
