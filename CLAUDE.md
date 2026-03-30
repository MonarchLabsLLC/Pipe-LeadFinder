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

- Schema: `prisma/schema.prisma` (currently bare — no models defined yet)
- Generated client outputs to: `src/generated/prisma`
- Database: DigitalOcean Managed PostgreSQL (or Neon — see `.env.example`)
- Import client from: `import { PrismaClient } from "@/generated/prisma"`

### Environment Setup

Copy `.env.example` to `.env`. Key required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_URL` — app URL (`http://localhost:3000` for dev)
- `DEV_AUTO_LOGIN=true` — enables dev auto-login

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/providers/` - React context providers (SessionProvider)
- `src/lib/utils.ts` - `cn()` helper for className merging
- `src/auth.ts` - NextAuth configuration and type augmentation
- `docs/` - User guide, PRD, technical requirements
