# Implementation Plan

## Pipe-LeadFinder — Phased Build with Parallel Subagent Tasks

**Created:** March 2026
**Architecture:** Next.js 15 App Router + Apify + Vercel AI SDK
**Reference Docs:** [PRD](PRD.md) | [Technical Requirements](Technical-Requirements-Doc.md)

---

## Build Philosophy

Each phase contains **independent tasks that can run as parallel subagents**. Tasks within a phase have no shared state — they can be built simultaneously in isolated worktrees and merged sequentially. Dependencies between phases are strict: Phase N must complete before Phase N+1 begins.

---

## Phase 0: Foundation (Sequential — Must Complete First)

Everything else depends on this. Run sequentially.

### Task 0.1: Database Schema + Prisma Setup
**Files:** `prisma/schema.prisma`, `src/lib/prisma.ts`
**Work:**
- Define all models from Technical Requirements Doc Section 3: User, LeadList, Lead, LeadListEntry, CustomLabel, LeadEntryLabel, SearchHistory, AiResult, BusinessProfile, DataSource, AiAgent
- Define all enums: SearchType, ListStatus, EmailStatus, PhoneStatus, SearchStatus, AiActionType, DataSourceType, AgentStatus
- Create Prisma client singleton at `src/lib/prisma.ts` (with global dev caching pattern)
- Run `npx prisma db push` to create tables
- Run `npx prisma generate` to generate client
**Acceptance:** `npx prisma studio` opens and shows all tables. Client imports work from `@/generated/prisma`.

### Task 0.2: Dashboard Layout Shell
**Files:** `src/app/(dashboard)/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`
**Dependencies:** Task 0.1 (needs User model for session display)
**Work:**
- Create route group `(dashboard)` with shared layout
- Build collapsible sidebar matching reference app: logo, credits display (static "0"), nav sections (AI Tools, Lead Search, Admin, Resources) with expand/collapse, user avatar at bottom
- Build topbar with page title, theme toggle, and flag icon area
- Sidebar nav items link to correct routes (pages don't need to exist yet)
- Integrate theme selector (warm/cool + light/dark) using existing `useTheme` hook
- Add React Query provider (`src/components/providers/query-provider.tsx`)
- Root `(dashboard)/page.tsx` redirects to `/lead-search/new-search`
**Acceptance:** Sidebar renders with all nav sections, collapses/expands, theme switching works, navigation links are correct.

### Task 0.3: Apify Client + Service Foundation
**Files:** `src/lib/apify.ts`, `src/services/search-service.ts`, `src/lib/validators/search.ts`
**Work:**
- Create Apify client singleton using `apify-client` with `process.env.APIFY_API_KEY`
- Create `search-service.ts` with the actor execution pattern: `executeSearch(type, params)` → call actor → get dataset → normalize results
- Create `normalizeResults(type, items)` that transforms raw Apify output to Lead model shape
- Create Zod schemas for all 5 search types in `src/lib/validators/search.ts`
- Add environment variables for actor IDs: `APIFY_ACTOR_PEOPLE`, `APIFY_ACTOR_LOCAL`, `APIFY_ACTOR_COMPANY`, `APIFY_ACTOR_DOMAIN`, `APIFY_ACTOR_INFLUENCER`
**Acceptance:** Can import and call `executeSearch` from a test API route. Zod schemas validate correctly.

---

## Phase 1: Core Search & Lists (Parallel — 6 Subagents)

All tasks in this phase are independent and can run simultaneously.

### Task 1.1: Search Type Picker + Page Shell
**Files:** `src/app/(dashboard)/lead-search/new-search/page.tsx`, `src/components/search/search-type-picker.tsx`
**Work:**
- Build the New Search page with "What are you searching for?" heading
- Create `SearchTypePicker` component: 5 cards in a 3+2 grid layout
- Each card: icon (lucide), title, description, credit cost text
- Clicking a card selects it (checkmark badge, highlighted border) and renders the corresponding form below
- Only one card selected at a time
- Use shadcn Card component
**Acceptance:** Page renders 5 search type cards. Clicking one selects it (visual feedback). No form rendering needed — just the picker.

### Task 1.2: People Search Form
**Files:** `src/components/search/people-search-form.tsx`
**Work:**
- Build People Search form with fields from PRD Section 5.1.1
- Top section: Description (text), Location (searchable combobox), Results Limit (select, default 10)
- Collapsible "Advanced filters" section with all 15 fields
- "PRO TIP" info text when advanced filters expanded
- Bottom: Select List dropdown + "Create new list" link, "→ Continue" button + "Cancel" button
- Form state managed by React Hook Form + Zod validation
- On submit: call `POST /api/search/people` (API doesn't need to exist yet — just wire the form)
**Acceptance:** Form renders all fields, validates input, submits JSON payload.

### Task 1.3: Local Search Form
**Files:** `src/components/search/local-search-form.tsx`
**Work:**
- Build Local Search form: Business Type (text), Location (searchable combobox)
- Select List dropdown + "Create new list" + add button
- Credit info text: "Company search will consume 1 credit per record returned. No credits will be consumed if email addresses are not found."
- "→ Continue" + "Cancel" buttons
- React Hook Form + Zod validation
**Acceptance:** Form renders, validates, submits.

### Task 1.4: Company + Domain Search Forms
**Files:** `src/components/search/company-search-form.tsx`, `src/components/search/domain-search-form.tsx`
**Work:**
- **Company Search:** Description, Location, Radius (km), Results Limit, Industry, Company Name, Domain, Technologies, Keyword, Employee Count, Revenue. "→ Continue" + "Cancel".
- **Domain Search:** Company Name or Website (text, placeholder "Eg: Amazon"), Select List + "Create new list". Credit info: "1 credit will be consumed per individual result. Example: 7 staff with emails = 7 credits consumed." "→ Continue" + "Cancel".
- Both use React Hook Form + Zod
**Acceptance:** Both forms render, validate, submit.

### Task 1.5: Influencer Search Form
**Files:** `src/components/search/influencer-search-form.tsx`
**Work:**
- Platform tabs: Instagram (default selected, purple) | TikTok | YouTube
- All fields from PRD Section 5.1.5: Hashtags (tag input), Description, Followers from/to, Age from/to, Reels Plays from/to, Engagements from/to, Engagement Rate, Language, Gender, Last Post (days), Contact Details, Partnership, Category, Account Type, Followers Growth Rate (Interval + Operator + Value), Verified checkbox, Has Sponsored Posts checkbox
- Audience section: Age, Credibility, Gender, Language, Interests, Locations
- Search by Username section: Username, Location
- Select List + "Create new list", "→ Continue" + "Cancel"
- React Hook Form + Zod
**Acceptance:** Form renders all fields across platform tabs, validates, submits.

### Task 1.6: Saved Lists Page (Index)
**Files:** `src/app/(dashboard)/lead-search/saved-lists/page.tsx`, `src/components/lists/list-card.tsx`, `src/components/lists/list-filters.tsx`, `src/hooks/useLists.ts`
**Work:**
- Build list index page with filter tabs: All | People | Domain | Local | Company | Influencer (with counts)
- Search bar for filtering lists by name
- "+ Create New" button (opens create list dialog)
- Active / Archive radio toggle
- Grid / List view toggle (dropdown)
- List cards: type icon (different icon per SearchType), list name, "Type: {type}" label, record counts ("All (9), Email found (6)"), relative timestamp, settings gear menu (rename, archive, delete)
- React Query hook `useLists()` for fetching lists
- API route: `GET /api/lists` — returns all lists for current user with counts
- API route: `POST /api/lists` — create new list
- API route: `PATCH /api/lists/[id]` — rename, archive
- API route: `DELETE /api/lists/[id]` — delete list
**Acceptance:** Lists page renders with filter tabs, search, create, and list cards. CRUD operations work.

---

## Phase 2: Search Execution + Results Table (Parallel — 4 Subagents)

### Task 2.1: Search API Routes (All 5 Types)
**Files:** `src/app/api/search/people/route.ts`, `src/app/api/search/local/route.ts`, `src/app/api/search/company/route.ts`, `src/app/api/search/domain/route.ts`, `src/app/api/search/influencer/route.ts`
**Work:**
- Each route: validate input with Zod, authenticate session, call `searchService.executeSearch(type, params)`, create SearchHistory record, create Lead records, create LeadListEntry records linking leads to the selected list, return results
- Handle Apify async: if actor takes > 10 seconds, return searchId and status RUNNING. Client polls `GET /api/search/[searchId]/status`.
- Create polling endpoint: `src/app/api/search/[searchId]/status/route.ts`
- Error handling: Apify failures, timeout, validation errors
**Acceptance:** Can execute a People Search and Local Search end-to-end. Leads appear in database. Search history recorded.

### Task 2.2: Results Table Component
**Files:** `src/app/(dashboard)/lead-search/saved-lists/[listId]/page.tsx`, `src/components/lists/results-table.tsx`, `src/components/leads/lead-row.tsx`, `src/components/leads/lead-contact-info.tsx`
**Work:**
- Build list detail page with action bar and results table
- Action bar: History button, filter tabs (All | Email found | Email not found | Potential with counts), Status filter dropdown, More Filters button, Search button, Data Enrichment button, AI Agent button, List new search button
- Table with columns: Checkbox, Name, AI Assistant, Contact Info, Company, Custom Labels, Created At
- **Lead Name cell:** avatar (or initials), full name (clickable), job title, location with pin icon, social links (LinkedIn, Facebook icons)
- **Contact Info cell:** email with status badge, "Get Phone Numbers" button, "Add Phone Number" button, "Add Email" button (if no email)
- **Company cell:** company name linked to website (external link icon), company LinkedIn link
- **Created At cell:** relative timestamp (e.g., "6mos ago")
- Bulk select checkbox in header + per row
- Pagination or infinite scroll
- React Query hook for fetching list leads with filters
- API route: `GET /api/lists/[id]` — returns list with paginated leads
**Acceptance:** Results table renders leads with all columns. Filter tabs work. Pagination works.

### Task 2.3: Custom Labels CRUD
**Files:** `src/app/(dashboard)/lead-search/custom-labels/page.tsx`, `src/components/leads/lead-labels.tsx`, `src/app/api/labels/route.ts`, `src/app/api/leads/[id]/labels/route.ts`
**Work:**
- Custom Labels page: "Add Custom Lead Label" text input + "+ Add Label" button, "Available Custom Lead Labels" section showing label chips (deletable)
- API routes: `GET /api/labels`, `POST /api/labels`, `DELETE /api/labels/[id]`
- Lead label assignment: `POST /api/leads/[id]/labels` (body: { labelId }), `DELETE /api/leads/[id]/labels/[labelId]`
- In results table: "Add" button in Custom Labels column opens a dropdown of available labels. Applied labels shown as tag chips.
- Seed default labels on first access: Called, Messaged, Emailed, Exported to CSV
**Acceptance:** Labels CRUD works. Labels can be applied/removed from leads in the results table.

### Task 2.4: Search-to-List Integration
**Files:** Updates to search forms + new search page
**Work:**
- Wire all 5 search forms to their API routes
- "Select List" dropdown populated from `useLists()` hook
- "Create new list" opens inline dialog, creates list, selects it
- On "→ Continue": submit search, show loading state, on completion navigate to the list detail page showing results
- Handle search status polling for long-running Apify actors
- Show progress/loading indicator during search
**Acceptance:** Full end-to-end flow: select search type → fill form → select/create list → submit → see results in list.

---

## Phase 3: Enrichment + AI (Parallel — 4 Subagents)

### Task 3.1: Data Enrichment
**Files:** `src/services/enrich-service.ts`, `src/app/api/enrich/email/route.ts`, `src/app/api/enrich/phone/route.ts`, `src/app/api/enrich/bulk/route.ts`
**Work:**
- `enrich-service.ts`: call Apify enrichment actors for email and phone lookup
- Per-lead email enrichment: `POST /api/enrich/email` (body: { leadId }) — calls Apify actor, updates Lead.email and Lead.emailStatus
- Per-lead phone enrichment: `POST /api/enrich/phone` (body: { leadId }) — calls Apify actor, updates Lead.phone and Lead.phoneStatus
- Bulk enrichment: `POST /api/enrich/bulk` (body: { listId }) — enriches all leads in a list
- Wire "Get Phone Numbers", "Add Email", and "Data Enrichment" buttons in results table
- Show loading spinners during enrichment
- Update UI optimistically via React Query cache invalidation
**Acceptance:** Clicking "Get Phone Numbers" on a lead triggers enrichment and shows the phone number. Bulk enrichment processes all leads in a list.

### Task 3.2: Knowledge Base / Business Profile
**Files:** `src/app/(dashboard)/ai/knowledge-base/page.tsx`, `src/services/knowledge-base-service.ts`, `src/app/api/ai/knowledge-base/route.ts`, `src/app/api/ai/knowledge-base/sources/route.ts`
**Work:**
- Business Profile form: Business Name, Business Website, What do you sell, Who does it help, What does it do for them, Contact person name, Personality — all text inputs with "Update info" button
- API routes: `GET /api/ai/knowledge-base` (returns profile), `PUT /api/ai/knowledge-base` (update profile)
- Data Sources section: tabs for Website | Text | Q&A | PDF
- Website tab: "Add a new website" input + "Crawl Web" button, "Or, add a single link" input + "Crawl Link" button
- Text tab: textarea for pasting content + save button
- Q&A tab: question/answer pair inputs + add button
- PDF tab: file upload
- API: `POST /api/ai/knowledge-base/sources` — stores data source, for websites uses Firecrawl to extract content
- `knowledge-base-service.ts`: Firecrawl integration for website crawling, content storage
**Acceptance:** Can save business profile, add website data source (crawled via Firecrawl), add text/Q&A data sources.

### Task 3.3: AI Assistant (Inline Actions)
**Files:** `src/components/leads/lead-ai-actions.tsx`, `src/services/ai-service.ts`, `src/app/api/ai/assistant/route.ts`, `src/hooks/useAI.ts`
**Work:**
- `ai-service.ts`: construct prompts using lead data + business profile context, call Vercel AI SDK
- API route: `POST /api/ai/assistant` — streaming endpoint using Vercel AI SDK `streamText()`
  - Body: `{ leadId, actionType, customPrompt? }`
  - Loads lead data, business profile, and any data sources as context
  - Constructs system prompt based on actionType
  - Streams response
- Built-in action prompts:
  - **Similar People**: "Based on this person's profile, suggest search criteria to find similar professionals"
  - **Direct Message**: "Write a personalized direct message to {name} at {company}..."
  - **Summary**: "Provide a brief research summary of {name} and their role at {company}..."
  - **Subject Line**: "Generate 3 compelling email subject lines for reaching out to {name}..."
  - **Intro**: "Write a personalized email opening paragraph for {name}..."
  - **Custom**: user-provided prompt with lead data injected
  - **Library**: load saved prompt template, inject lead data
- `lead-ai-actions.tsx`: render 7 action buttons per lead row. Clicking opens a slide-out panel or modal showing streaming AI response.
- `useAI.ts`: React hook wrapping the streaming API call
- Store AI results in AiResult table for re-access
**Acceptance:** Clicking "Direct Message" on a lead streams a personalized message. All 7 action types work. Results saved to database.

### Task 3.4: AI Assistant Settings + Prompt Library
**Files:** `src/app/(dashboard)/ai/ai-assistant/page.tsx`
**Work:**
- AI Assistant page for managing saved prompts (Library)
- Create/edit/delete custom prompt templates
- Each template: name, prompt text (with `{name}`, `{company}`, `{title}` placeholder variables)
- Templates available in the "Library" action button dropdown per lead
- Store templates in a new `PromptTemplate` model or in BusinessProfile JSON
**Acceptance:** Can create prompt templates. Templates appear in the Library action dropdown. Running a template generates content with lead data injected.

---

## Phase 4: Agents + Polish (Parallel — 4 Subagents)

### Task 4.1: AI Agent Builder
**Files:** `src/app/(dashboard)/ai/ai-agent/page.tsx`, `src/app/(dashboard)/ai/ai-agent/[agentId]/page.tsx`, `src/app/api/ai/agent/route.ts`
**Work:**
- Agent list page: status filter dropdown (All Statuses, Draft, Active, Paused), "New AI Agent" button
- Agent cards: name, created date, action/connection/lead counts, play/pause + delete buttons
- "New AI Agent" dialog: Name, Description, Auto-save checkbox, Save/Cancel
- Agent builder page (`[agentId]`): visual pipeline builder
  - Step 1: Select search type + configure search parameters
  - Step 2: Add actions (Enrich, AI Research, Content Generation)
  - Step 3: Add connections (Webhook URL, future CRM integrations)
  - Step 4: Schedule (manual, daily, weekly) or trigger
- Agent config stored as JSON in `AiAgent.config`
- API routes: `GET /api/ai/agent`, `POST /api/ai/agent`, `PATCH /api/ai/agent/[id]`, `DELETE /api/ai/agent/[id]`, `POST /api/ai/agent/[id]/run` (manual trigger)
**Acceptance:** Can create an agent, configure search + actions, save config. Manual run executes the pipeline.

### Task 4.2: CSV Export
**Files:** `src/app/api/lists/[id]/export/route.ts`
**Work:**
- Export endpoint: `POST /api/lists/[id]/export` — generates CSV from all leads in a list
- Include columns: Name, Title, Email, Phone, Company, Website, LinkedIn, Location, Labels, Created At
- Return as downloadable file (Content-Disposition header)
- Add "Export CSV" button to list detail action bar
- No credit charge for exports
**Acceptance:** Clicking export downloads a CSV with all lead data from the list.

### Task 4.3: Admin Placeholder Pages
**Files:** `src/app/(dashboard)/admin/[...slug]/page.tsx`
**Work:**
- Catch-all route for all admin pages
- Render placeholder card for each admin section: Business Account, Packages, Stripe, Subscriptions, Custom Links, SMTP, Webhook, Email Templates, Training Content, Partners
- Each placeholder: section title, "Coming Soon" message, brief description of what it will do
- Resources section: same placeholder treatment
- Credits sidebar: static display showing "Credits Remaining: 0" + "Credit Wallet" button (links to external billing portal URL from env var)
**Acceptance:** All admin nav links render a placeholder page. No 404s.

### Task 4.4: Mobile Responsive + Final Polish
**Files:** Various component updates
**Work:**
- Sidebar: collapses to icon-only on mobile, hamburger menu toggle
- Results table: horizontal scroll on mobile, or card layout for narrow screens
- Search forms: stack fields vertically on mobile
- All modals/dialogs: full-screen on mobile
- Theme selector: accessible from mobile menu
- Loading states: skeleton loaders for lists, table rows, search results
- Empty states: "No lists yet", "No results found", "Run your first search"
- Error states: Apify failures, network errors, validation errors
- Toast notifications for actions: "Lead enriched", "Label applied", "Search started"
**Acceptance:** Full app is usable on mobile (375px+). All loading/empty/error states present.

---

## Phase Summary

| Phase | Tasks | Can Parallelize? | Estimated Subagents |
|-------|-------|-------------------|---------------------|
| 0: Foundation | 3 tasks | Sequential | 1 (sequential) |
| 1: Core Search & Lists | 6 tasks | Yes — all parallel | 6 |
| 2: Search Execution + Results | 4 tasks | Yes — all parallel | 4 |
| 3: Enrichment + AI | 4 tasks | Yes — all parallel | 4 |
| 4: Agents + Polish | 4 tasks | Yes — all parallel | 4 |

**Total: 21 tasks across 5 phases, up to 6 parallel subagents per phase.**

---

## Subagent Instructions Template

When dispatching a subagent for any task above, include:

```
You are building Pipe-LeadFinder, an AI-powered lead intelligence platform.

TASK: {task title and description from above}

KEY REFERENCES:
- PRD: docs/PRD.md (feature requirements)
- Technical Requirements: docs/Technical-Requirements-Doc.md (schema, APIs, architecture)
- CLAUDE.md (dev commands, auth pattern, styling)

STACK: Next.js 15 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui, Prisma 7 (PostgreSQL), React Query, Zod, React Hook Form, Apify, Vercel AI SDK

CONSTRAINTS:
- Use shadcn/ui components (install with `npx shadcn@latest add <component>`)
- All API inputs validated with Zod
- All database access through Prisma (`import { PrismaClient } from "@/generated/prisma"`)
- Use React Query for all data fetching
- Theme uses data-theme attribute (amber/indigo) + .dark class — use Tailwind color tokens (bg-background, text-foreground, etc.)
- Auth: `import { auth } from "@/auth"` in server code

FILES TO CREATE/MODIFY: {list from task}

ACCEPTANCE CRITERIA: {from task}
```
