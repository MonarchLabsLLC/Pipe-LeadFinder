# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Turbopack) - auto-login enabled
npm run build    # Production build
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
- Database URL: `DATABASE_URL` env var

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/providers/` - React context providers (SessionProvider)
- `src/lib/utils.ts` - `cn()` helper for className merging
- `src/auth.ts` - NextAuth configuration and type augmentation
- `docs/` - User guide, PRD, technical requirements
