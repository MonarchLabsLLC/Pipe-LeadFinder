# NextJS-Full-Starter-App-2026

A production-ready, AI-agent optimized Next.js starter application built for **Scale.gg** apps. This stack is carefully curated to maximize AI-assisted development success rates—every package works seamlessly together and agents wire it correctly on the first pass.

## Why This Starter?

Modern AI coding assistants (Claude, Cursor, GPT) perform best with a "clean lane" stack—technologies that have clear patterns, excellent documentation, and minimal configuration conflicts. This starter eliminates the setup friction so you can focus on building features.

**Perfect for:**
- SaaS applications
- Internal tools & dashboards
- AI-powered applications
- Rapid prototyping with production-quality foundations

## Tech Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| **Next.js** | 15+ | React framework with App Router & Turbopack |
| **React** | 19 | UI library with Server Components |
| **TypeScript** | 5 | Type safety |

### Styling & UI
| Package | Version | Purpose |
|---------|---------|---------|
| **Tailwind CSS** | 4 | Utility-first CSS |
| **shadcn/ui** | latest | Beautiful, accessible component library |
| **tw-animate-css** | latest | Animation utilities |

### Authentication
| Package | Version | Purpose |
|---------|---------|---------|
| **NextAuth.js** | 5 (Auth.js) | Authentication with dev auto-login |

### Database
| Package | Version | Purpose |
|---------|---------|---------|
| **Prisma** | 7 | Type-safe ORM |
| **PostgreSQL** | - | Production database |

### State & Data
| Package | Version | Purpose |
|---------|---------|---------|
| **React Query** | 5 | Server state management |
| **Zod** | 4 | Schema validation |
| **React Hook Form** | 7 | Form handling |

### Rich Text
| Package | Version | Purpose |
|---------|---------|---------|
| **Tiptap** | 3 | Headless rich text editor |

### AI Services
| Package | Version | Purpose |
|---------|---------|---------|
| **Vercel AI SDK** | 6 | Unified AI interface |
| **OpenAI SDK** | 6 | GPT models |
| **Google Generative AI** | latest | Gemini models |

### External APIs
| Package | Version | Purpose |
|---------|---------|---------|
| **Pexels** | latest | Stock photos & videos |
| **Firecrawl** | latest | Web scraping |
| **Apify Client** | latest | Web automation |

### Runtime
- **Node.js 24.x LTS**

## Features

### Dev Auto-Login
In development mode, authentication is bypassed automatically. Visit any page and you're instantly logged in as:
```
Email: admin@GrooveDigital.com
Name:  Dev Admin
Role:  admin
```

No login forms, no credentials—just start building. Production mode requires real authentication.

### Pre-configured Theme
Custom shadcn/ui theme with:
- Light & dark mode support
- OKLCH color space for better color manipulation
- Custom shadow system
- Typography scale with Inter + JetBrains Mono

### Type-Safe Everything
- Prisma generates types from your schema
- Zod schemas for runtime validation
- NextAuth session types extended
- Full TypeScript coverage

## Quick Start

### 1. Clone & Install
```bash
git clone <repo-url> my-app
cd my-app
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Environment Variables](#environment-variables)).

### 3. Setup Database
```bash
# Start Postgres (local or cloud)
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) - you'll be auto-logged in.

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth secret (generate with `openssl rand -base64 32`) |
| `AUTH_URL` | Your app URL (http://localhost:3000 for dev) |

### AI Services (Optional)
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Same as Gemini (required for Vercel AI SDK) |

### External APIs (Optional)
| Variable | Description |
|----------|-------------|
| `PEXELS_API_KEY` | Pexels stock photos & videos API |
| `FIRECRAWL_API_KEY` | Firecrawl web scraping API |
| `APIFY_API_KEY` | Apify web automation API |

### Real-time (Optional)
| Variable | Description |
|----------|-------------|
| `ABLY_API_KEY` | Ably real-time messaging |
| `PUSHER_APP_ID` | Pusher app ID |
| `PUSHER_KEY` | Pusher key |
| `PUSHER_SECRET` | Pusher secret |
| `PUSHER_CLUSTER` | Pusher cluster region |

## Project Structure

```
├── docs/                    # Documentation
│   ├── User-Guide.md
│   ├── PRD.md
│   └── Technical-Requirements-Doc.md
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/
│   │   │   └── auth/        # NextAuth routes
│   │   ├── globals.css      # Tailwind + theme
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── auth.ts              # NextAuth configuration
│   ├── components/
│   │   └── providers/       # React context providers
│   ├── lib/
│   │   └── utils.ts         # Utility functions (cn, etc.)
│   └── middleware.ts        # Auth middleware
├── .env.example             # Environment template
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Adding shadcn/ui Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
# etc.
```

Browse components: [ui.shadcn.com](https://ui.shadcn.com)

## Database Workflow

```bash
# Edit schema
code prisma/schema.prisma

# Push changes (dev)
npx prisma db push

# Create migration (prod)
npx prisma migrate dev --name your_migration_name

# Generate client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

## Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Docker
```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Customizing the Theme

Edit `src/app/globals.css` or use [tweakcn.com](https://tweakcn.com) to generate a new theme:

```bash
npx shadcn@latest add https://tweakcn.com/r/themes/<your-theme-id>
```

## License

MIT

---

Built for [Scale.gg](https://scale.gg) applications.
