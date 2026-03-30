# Technical Requirements Document

## Pipe-LeadFinder — System Architecture & Technical Specifications

**Status:** Active Development
**Last Updated:** March 2026

---

## 1. Technology Stack

### Core Framework
- **Next.js 15** — App Router, Turbopack, Server Components + Server Actions
- **React 19** — Server Components, Suspense, streaming
- **TypeScript 5** — strict mode

### Styling & UI
- **Tailwind CSS 4** — utility-first, OKLCH color space
- **shadcn/ui** — component library (New York style)
- **tw-animate-css** — animation utilities
- **lucide-react** — icon library
- **Dual theme system** — amber (warm) / indigo (cool) with light/dark mode via `data-theme` attribute + `.dark` class

### Authentication
- **NextAuth.js 5** (Auth.js) — Credentials provider
- Dev auto-login as `admin@GrooveDigital.com`
- Session available server-side via `auth()`, client-side via `useSession()`

### Database
- **Prisma 7** — ORM, generated client at `src/generated/prisma`
- **PostgreSQL** — DigitalOcean Managed PostgreSQL (or Neon)

### State & Data Fetching
- **React Query** (@tanstack/react-query v5) — server state, caching, optimistic updates
- **React Hook Form** (v7) — form handling
- **Zod** (v4) — schema validation for all API inputs

### Rich Text
- **Tiptap 3** — headless editor for AI-generated content editing

### AI Services
- **Vercel AI SDK** (v6) — `ai` package for streaming AI responses
- **@ai-sdk/openai** — OpenAI provider (GPT-4o, GPT-4o-mini)
- **@ai-sdk/google** — Google Gemini provider
- **@google/generative-ai** — direct Gemini API access

### Data Sourcing
- **apify-client** — Apify actor execution for all 5 search types + enrichment
- **@mendable/firecrawl-js** — website crawling for Knowledge Base
- **pexels** — stock photo API (available but not core)

### Runtime
- **Node.js 24.x LTS**

---

## 2. Architecture Overview

### 2.1 Application Layer Model

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js App Router                     │
│                                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Pages /    │  │  API Routes  │  │  Server Actions  │  │
│  │  Layouts     │  │  /api/*      │  │  (mutations)     │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                │                    │            │
│  ┌──────┴────────────────┴────────────────────┴────────┐  │
│  │                   Service Layer                      │  │
│  │  search-service  │  enrich-service  │  ai-service    │  │
│  └──────┬───────────┴──────┬───────────┴───────┬──────┘  │
│         │                  │                    │          │
│  ┌──────┴──────┐  ┌───────┴───────┐  ┌────────┴───────┐ │
│  │   Apify     │  │   Prisma DB   │  │  Vercel AI SDK │ │
│  │   Client    │  │   (Postgres)  │  │  (OpenAI/Gem)  │ │
│  └─────────────┘  └───────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Directory Structure (Target)

```
src/
├── app/
│   ├── (dashboard)/              # Authenticated dashboard layout
│   │   ├── layout.tsx            # Sidebar + topbar layout
│   │   ├── page.tsx              # Dashboard home / redirect
│   │   ├── lead-search/
│   │   │   ├── new-search/
│   │   │   │   └── page.tsx      # Search type picker + forms
│   │   │   ├── saved-lists/
│   │   │   │   ├── page.tsx      # List index (cards)
│   │   │   │   └── [listId]/
│   │   │   │       └── page.tsx  # List detail (results table)
│   │   │   └── custom-labels/
│   │   │       └── page.tsx      # Label management
│   │   ├── ai/
│   │   │   ├── knowledge-base/
│   │   │   │   └── page.tsx      # Business profile + data sources
│   │   │   ├── ai-assistant/
│   │   │   │   └── page.tsx      # AI Assistant settings/library
│   │   │   └── ai-agent/
│   │   │       ├── page.tsx      # Agent list
│   │   │       └── [agentId]/
│   │   │           └── page.tsx  # Agent builder
│   │   └── admin/
│   │       └── [...slug]/
│   │           └── page.tsx      # Placeholder pages
│   ├── api/
│   │   ├── auth/                 # NextAuth routes
│   │   ├── search/               # Search execution endpoints
│   │   │   ├── people/route.ts
│   │   │   ├── local/route.ts
│   │   │   ├── company/route.ts
│   │   │   ├── domain/route.ts
│   │   │   └── influencer/route.ts
│   │   ├── enrich/               # Enrichment endpoints
│   │   │   ├── email/route.ts
│   │   │   └── phone/route.ts
│   │   ├── ai/                   # AI endpoints
│   │   │   ├── assistant/route.ts
│   │   │   └── agent/route.ts
│   │   ├── lists/                # List CRUD
│   │   └── labels/               # Label CRUD
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Theme imports + Tailwind config
│   └── page.tsx                  # Root redirect
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx           # App sidebar with navigation
│   │   ├── topbar.tsx            # Page header bar
│   │   └── theme-selector.tsx    # Warm/Cool + Light/Dark toggle
│   ├── search/
│   │   ├── search-type-picker.tsx
│   │   ├── people-search-form.tsx
│   │   ├── local-search-form.tsx
│   │   ├── company-search-form.tsx
│   │   ├── domain-search-form.tsx
│   │   └── influencer-search-form.tsx
│   ├── lists/
│   │   ├── list-card.tsx
│   │   ├── list-filters.tsx
│   │   └── results-table.tsx
│   ├── leads/
│   │   ├── lead-row.tsx
│   │   ├── lead-contact-info.tsx
│   │   ├── lead-ai-actions.tsx
│   │   └── lead-labels.tsx
│   └── providers/
│       ├── session-provider.tsx
│       ├── query-provider.tsx
│       └── theme-provider.tsx
├── hooks/
│   ├── useTheme.ts               # Theme switching (amber/indigo + light/dark)
│   ├── useSearch.ts              # Search mutation hooks
│   ├── useLists.ts               # List query/mutation hooks
│   └── useAI.ts                  # AI assistant hooks
├── lib/
│   ├── utils.ts                  # cn() helper
│   ├── apify.ts                  # Apify client singleton + actor helpers
│   ├── prisma.ts                 # Prisma client singleton
│   └── validators/
│       ├── search.ts             # Zod schemas for search forms
│       ├── list.ts               # Zod schemas for lists
│       └── label.ts              # Zod schemas for labels
├── services/
│   ├── search-service.ts         # Apify actor execution + result normalization
│   ├── enrich-service.ts         # Enrichment logic
│   ├── ai-service.ts             # AI prompt construction + streaming
│   └── knowledge-base-service.ts # Business profile + data source management
├── themes/
│   ├── amber.css                 # Warm theme (OKLCH)
│   └── indigo.css                # Cool theme (OKLCH)
├── auth.ts                       # NextAuth configuration
├── middleware.ts                  # Auth middleware
└── generated/
    └── prisma/                   # Generated Prisma client
```

---

## 3. Database Schema

### 3.1 Core Models

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lists          LeadList[]
  labels         CustomLabel[]
  agents         AiAgent[]
  businessProfile BusinessProfile?
  searches       SearchHistory[]
}

model LeadList {
  id        String       @id @default(cuid())
  name      String
  type      SearchType
  status    ListStatus   @default(ACTIVE)
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  leads     LeadListEntry[]
  searches  SearchHistory[]
}

model Lead {
  id          String   @id @default(cuid())
  // Identity
  firstName   String?
  lastName    String?
  fullName    String?
  title       String?
  headline    String?
  avatarUrl   String?
  // Location
  city        String?
  state       String?
  country     String?
  location    String?  // formatted full location
  // Contact
  email       String?
  emailStatus EmailStatus @default(UNKNOWN)
  phone       String?
  phoneStatus PhoneStatus @default(UNKNOWN)
  // Social
  linkedinUrl String?
  facebookUrl String?
  twitterUrl  String?
  instagramUrl String?
  tiktokUrl   String?
  youtubeUrl  String?
  // Company
  companyName    String?
  companyWebsite String?
  companyLinkedin String?
  companySize    String?
  companyRevenue String?
  companyIndustry String?
  // Influencer-specific
  platform       String?
  username       String?
  followerCount  Int?
  engagementRate Float?
  bio            String?
  // Meta
  sourceType     SearchType
  rawData        Json?       // Full Apify response for this lead
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  listEntries    LeadListEntry[]
  aiResults      AiResult[]
}

model LeadListEntry {
  id        String   @id @default(cuid())
  listId    String
  list      LeadList @relation(fields: [listId], references: [id], onDelete: Cascade)
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  labels    LeadEntryLabel[]

  @@unique([listId, leadId])
}

model CustomLabel {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  entries   LeadEntryLabel[]

  @@unique([userId, name])
}

model LeadEntryLabel {
  id        String         @id @default(cuid())
  entryId   String
  entry     LeadListEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  labelId   String
  label     CustomLabel    @relation(fields: [labelId], references: [id], onDelete: Cascade)
  createdAt DateTime       @default(now())

  @@unique([entryId, labelId])
}

model SearchHistory {
  id         String     @id @default(cuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id])
  listId     String?
  list       LeadList?  @relation(fields: [listId], references: [id])
  searchType SearchType
  parameters Json       // Search form values
  resultCount Int       @default(0)
  status     SearchStatus @default(PENDING)
  apifyRunId String?    // Apify run ID for tracking
  createdAt  DateTime   @default(now())
}

model AiResult {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  actionType AiActionType
  prompt    String?
  result    String   @db.Text
  model     String?  // e.g., "gpt-4o", "gemini-pro"
  createdAt DateTime @default(now())
}

model BusinessProfile {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id])
  businessName     String?
  businessWebsite  String?
  whatYouSell      String?
  whoItHelps       String?
  whatItDoes       String?
  contactPerson    String?
  personality      String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  dataSources      DataSource[]
}

model DataSource {
  id               String   @id @default(cuid())
  profileId        String
  profile          BusinessProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type             DataSourceType
  content          String   @db.Text
  sourceUrl        String?
  name             String?
  createdAt        DateTime @default(now())
}

model AiAgent {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  name        String
  description String?
  status      AgentStatus @default(DRAFT)
  config      Json?       // Search params, actions, connections
  autoSave    Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

// Enums

enum SearchType {
  PEOPLE
  LOCAL
  COMPANY
  DOMAIN
  INFLUENCER
}

enum ListStatus {
  ACTIVE
  ARCHIVED
}

enum EmailStatus {
  UNKNOWN
  FOUND
  NOT_FOUND
  POTENTIAL
}

enum PhoneStatus {
  UNKNOWN
  FOUND
  NOT_FOUND
}

enum SearchStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum AiActionType {
  SIMILAR_PEOPLE
  DIRECT_MESSAGE
  SUMMARY
  SUBJECT_LINE
  INTRO
  CUSTOM
  LIBRARY
}

enum DataSourceType {
  WEBSITE
  TEXT
  QA
  PDF
}

enum AgentStatus {
  DRAFT
  ACTIVE
  PAUSED
}
```

---

## 4. API Specifications

### 4.1 Search Endpoints

All search endpoints follow the same pattern:

```
POST /api/search/{type}
Content-Type: application/json
Authorization: Session cookie (NextAuth)

Request Body: Zod-validated search parameters
Response: { searchId, status, results?: Lead[] }
```

For long-running Apify searches, the endpoint returns a `searchId` and the client polls or uses Server-Sent Events for completion.

### 4.2 List Endpoints

```
GET    /api/lists              — List all lists (with counts)
POST   /api/lists              — Create new list
GET    /api/lists/[id]         — Get list with leads (paginated)
PATCH  /api/lists/[id]         — Update list (rename, archive)
DELETE /api/lists/[id]         — Delete list

POST   /api/lists/[id]/export  — Export list to CSV
```

### 4.3 Label Endpoints

```
GET    /api/labels             — List all custom labels
POST   /api/labels             — Create label
DELETE /api/labels/[id]        — Delete label
POST   /api/leads/[id]/labels  — Apply label to lead
DELETE /api/leads/[id]/labels/[labelId] — Remove label from lead
```

### 4.4 Enrichment Endpoints

```
POST   /api/enrich/email       — Find email for a lead
POST   /api/enrich/phone       — Find phone for a lead
POST   /api/enrich/bulk        — Bulk enrich all leads in a list
```

### 4.5 AI Endpoints

```
POST   /api/ai/assistant       — Generate AI content (streaming)
  Body: { leadId, actionType, customPrompt? }
  Response: ReadableStream (Vercel AI SDK)

GET    /api/ai/knowledge-base  — Get business profile
PUT    /api/ai/knowledge-base  — Update business profile
POST   /api/ai/knowledge-base/sources — Add data source
```

---

## 5. Apify Integration

### 5.1 Client Setup

```typescript
// src/lib/apify.ts
import { ApifyClient } from 'apify-client'

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY,
})

export { apifyClient }
```

### 5.2 Actor Execution Pattern

```typescript
// src/services/search-service.ts
async function executeSearch(type: SearchType, params: SearchParams) {
  const actorId = getActorId(type) // Map search type to Apify actor
  const input = buildActorInput(type, params) // Transform form params to actor input

  const run = await apifyClient.actor(actorId).call(input)
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems()

  return normalizeResults(type, items) // Transform to Lead model
}
```

### 5.3 Actor Configuration

Actor IDs configured via environment variables:

```env
APIFY_ACTOR_PEOPLE=actor/people-search-id
APIFY_ACTOR_LOCAL=actor/local-search-id
APIFY_ACTOR_COMPANY=actor/company-search-id
APIFY_ACTOR_DOMAIN=actor/domain-search-id
APIFY_ACTOR_INFLUENCER=actor/influencer-search-id
APIFY_ACTOR_ENRICH_EMAIL=actor/email-enrichment-id
APIFY_ACTOR_ENRICH_PHONE=actor/phone-enrichment-id
```

---

## 6. Security Requirements

- All API routes protected by NextAuth session validation
- Apify API key stored server-side only, never exposed to client
- Zod validation on all API inputs
- Rate limiting on search endpoints (prevent credit abuse)
- CSRF protection via NextAuth
- No raw SQL — all queries through Prisma ORM

---

## 7. Performance Requirements

- Search form render: < 100ms
- Apify actor initiation: < 2 seconds
- Search results (after Apify completes): streamed as available
- List page load (100 leads): < 500ms
- AI Assistant response: streaming, first token < 1 second
- Database queries: indexed on userId, listId, searchType

---

## 8. Deployment

- **Platform:** Vercel (recommended) or Docker
- **Database:** DigitalOcean Managed PostgreSQL
- **Environment:** Node.js 24.x LTS
- **Build:** `next build` with Turbopack
- **Prisma:** Run `prisma migrate deploy` on deployment
