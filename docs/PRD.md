# Product Requirements Document (PRD)

## Pipe-LeadFinder — AI-Powered Lead Intelligence Platform

**Status:** Active Development
**Last Updated:** March 2026
**Owner:** Mike Filsaime / GrooveDigital / Scale.gg

---

## 1. Executive Summary

Pipe-LeadFinder is a lead intelligence SaaS platform that enables users to find, enrich, and manage business leads through five specialized search types powered by Apify. The platform replaces a third-party white-label service (WhiteLabelSuite/AiXUP) with a fully owned, ground-up rebuild using Next.js, Apify actors, and AI-powered research capabilities.

The application provides real-time lead discovery, contact data enrichment, AI-assisted outreach content generation, and automated prospecting agents — all accessible through a clean, modern dashboard.

---

## 2. Problem Statement

The current lead finding solution is a white-label service with limited customization, ongoing licensing costs, and no ownership of the underlying technology. Pipe-LeadFinder eliminates this dependency by building a proprietary platform that:

- Reduces per-lead costs through direct Apify integration
- Provides full control over data pipeline, UX, and feature roadmap
- Integrates natively with the Scale.gg / GrooveDigital ecosystem
- Enables AI-powered lead research and outreach personalization

---

## 3. Goals & Success Metrics

### Goals
1. Feature parity with the reference application (5 search types, saved lists, data enrichment, AI assistant, AI agents)
2. Direct Apify integration as the sole data engine — no third-party lead data middlemen
3. AI-powered lead research and content generation via Vercel AI SDK
4. Clean, responsive dashboard using the existing Next.js + shadcn/ui stack

### Success Metrics
- All 5 search types return results via Apify actors
- Leads can be saved, organized into lists, enriched, labeled, and exported
- AI Assistant generates personalized outreach content per lead
- AI Agents run automated search + enrich + action pipelines

---

## 4. User Personas

### Primary: Sales Professional / Business Owner
- Needs to find qualified leads by role, location, industry
- Wants verified contact information (email, phone, social)
- Values speed — results in seconds, not hours
- Uses AI to personalize outreach at scale

### Secondary: Agency Owner
- Manages lead finding for multiple clients
- Needs sub-accounts and white-label capabilities (future)
- Exports data to external CRMs via webhook/integration

---

## 5. Feature Requirements

### 5.1 Lead Search — Five Search Types

All searches are backed by Apify actors. Each search type has a specific form, sends parameters to an Apify actor, and stores results in a Saved List.

#### 5.1.1 People Search (3 credits/record)
Find individuals by role, industry, and location.

**Form Fields:**
- Description (e.g., "Web Designer") — text input
- Location — searchable dropdown
- Results Limit — dropdown (default: 10)

**Advanced Filters (collapsible):**
- Job Title — searchable dropdown
- Department — searchable dropdown
- Management Levels — dropdown (Choose Level)
- Changed Jobs Within — dropdown (Choose Period)
- Skills — searchable text (e.g., "Communication")
- Years of Experience — dropdown
- Company Name or Domain — searchable text
- Employee Count — dropdown (Choose Count)
- Revenue — dropdown (Choose Revenue)
- Industry — searchable dropdown
- Contact Method — dropdown (Select)
- Major — searchable text
- School — searchable text
- Degree — searchable text
- Social Link — text (e.g., LinkedIn URL)
- Contact Info Email — text
- Contact Info Phone — text

**Data Returned Per Lead:**
- Full name, job title, location
- Avatar/photo
- Email (verified status: found / not found / potential)
- Phone (enrichable separately)
- LinkedIn profile URL
- Facebook profile URL (if available)
- Company name, company website, company LinkedIn

#### 5.1.2 Local Search (1 credit/company)
Find local businesses by type and location. No credits charged if no email found.

**Form Fields:**
- Business Type (e.g., "Hairdresser") — text input
- Location (e.g., "Seattle") — searchable dropdown
- Select List — dropdown + "Create new list" button

**Data Returned Per Lead:**
- Business name, address, phone
- Email addresses
- Website URL
- Business category/type

#### 5.1.3 Company Search (1 credit/company)
Find and gather information about companies.

**Form Fields:**
- Description (e.g., "Web Designer") — text input
- Location — searchable dropdown
- Radius (km) — dropdown
- Results Limit — dropdown (default: 10)
- Industry — searchable dropdown
- Company Name — searchable text
- Domain — searchable text
- Technologies — searchable text
- Keyword — searchable text
- Employee Count — dropdown
- Revenue — dropdown

**Data Returned Per Company:**
- Company name, description
- Website, domain
- Industry, employee count, revenue range
- Technologies used
- Social profiles
- Contact emails

#### 5.1.4 Domain Search (1 credit/individual result)
Find contacts at a specific company from its domain or name.

**Form Fields:**
- Company Name or Website (e.g., "Amazon") — text input
- Select List — dropdown + "Create new list" button

**Data Returned:**
- All staff with publicly available email addresses
- Each person: name, title, email, LinkedIn
- Example: 7 staff with emails = 7 credits

#### 5.1.5 Influencer Search (2 credits/record, +5 for manual enrichment)
Find social media influencers by platform, niche, and engagement metrics.

**Platform Tabs:** Instagram | TikTok | YouTube

**Form Fields:**
- Hashtags (without #) — tag input
- Description (e.g., "music") — text input
- Followers — from/to range
- Age — from/to dropdown
- Reels Plays — from/to range
- Engagements — from/to range
- Engagement Rate — text (e.g., 0.8)
- Language — searchable dropdown
- Gender — dropdown
- Last Post (days) — text (e.g., 40)
- Contact Details — dropdown (Choose Social)
- Partnership — searchable dropdown
- Category — dropdown (Select Category)
- Account Type — dropdown (Choose Type)
- Followers Growth Rate — Interval dropdown + Operator dropdown + Value text
- Verified — checkbox
- Has Sponsored Posts — checkbox

**Audience Section:**
- Age — dropdown
- Credibility — text (e.g., 0.8)
- Gender — dropdown
- Language — searchable dropdown
- Interests — dropdown
- Locations — searchable dropdown

**Search by Username:**
- Username — searchable text
- Location — searchable dropdown
- Select List — dropdown + "Create new list"

**Data Returned Per Influencer:**
- Username, display name, bio
- Follower count, engagement rate
- Platform-specific metrics
- Contact info (if available)
- Profile URL

### 5.2 Saved Lists

Lists are the primary organizational unit for leads. Each search saves results to a list.

**List Index Page:**
- Filter tabs: All | People | Domain | Local | Company | Influencer (with counts)
- Search bar
- "+ Create New" button
- Active / Archive radio toggle
- Grid / List view toggle
- List cards showing: icon (by type), name, type label, record counts ("All (9), Email found (6)"), relative timestamp
- Settings gear menu per card

**List Detail Page (Results Table):**

**Action Bar:**
- History button
- Filter tabs: All | Email found | Email not found | Potential Emails Found (with counts)
- Status filter dropdown (Unsent, etc.)
- More Filters button
- Search button (run additional search into this list)
- Data Enrichment button
- AI Agent button
- List new search button

**Table Columns:**
| Column | Content |
|--------|---------|
| Checkbox | Bulk select for batch operations |
| Name | Avatar, full name, job title, location, social links (LinkedIn, Facebook), Edit button |
| AI Assistant | Similar People, Direct Message, Summary, Subject Line, Intro, Custom, Library buttons |
| Contact Info | Email (with verified/not found/potential status), Get Phone Numbers, Add Phone Number, Add Email buttons |
| Company | Company name (linked to website), company LinkedIn link |
| Custom Labels | Add label button, applied labels shown as tags |
| Created At | Relative timestamp |

### 5.3 Custom Labels

User-defined tags for categorizing leads within lists.

- Add Custom Lead Label — text input + "+ Add Label" button
- Available Custom Lead Labels displayed as removable tag chips
- Default labels: Called, Messaged, Emailed, Exported to CSV
- Labels can be applied to any lead from the results table

### 5.4 Data Enrichment

One-click enrichment of existing leads to fill in missing contact data.

- Triggered from the list detail action bar ("Data Enrichment" button)
- Per-lead enrichment: "Get Phone Numbers", "Add Email" buttons in the Contact Info column
- Enrichment uses Apify actors to find additional contact data
- Enrichment consumes credits

### 5.5 AI Assistant (Zero Credit Cost)

Inline AI-powered actions available per lead in the results table. Uses Vercel AI SDK with OpenAI/Gemini.

**Built-in Actions:**
- **Similar People** — find leads similar to this person
- **Direct Message** — generate a personalized DM
- **Summary** — generate a prospect summary
- **Subject Line** — generate email subject lines
- **Intro** — generate an email introduction
- **Custom** — user-defined prompt
- **Library** — saved prompt templates

AI Assistant uses the Knowledge Base (Business Profile) to personalize all generated content.

### 5.6 AI Agents

Automated prospecting pipelines that run search + enrichment + actions on a schedule or trigger.

**Agent Settings:**
- Name — text input
- Description (optional) — text input
- Auto-save changes — checkbox

**Agent Builder (Future Detail):**
- Select search type
- Configure search parameters
- Add actions: enrichment, AI research, content generation
- Add connections: webhook, CRM sync, email
- Set schedule or trigger

**Agent Dashboard:**
- List of agents with status (Active, Paused, Draft)
- Filter by status
- Card view: name, created date, action count, connection count, lead count
- Play/pause and delete controls

### 5.7 Knowledge Base (Business Profile)

AI context that powers personalized outreach. Feeds into the AI Assistant.

**Business Profile Fields:**
- Business Name
- Business Website
- What do you sell?
- Who does it help?
- What does it do for them?
- Contact person name
- Personality (e.g., "Professional, Friendly")

**Data Sources (for AI context):**
- Website — crawl entire site or single link
- Text — paste custom text
- Q&A — structured question/answer pairs
- PDF — upload documents

### 5.8 Placeholders (Out of Scope for V1)

These features will have navigation entries and placeholder pages but no functional implementation:

**Credits System:**
- Credits Remaining display (sidebar)
- Credit Wallet button
- Credit consumption tracking
- Handled by external billing portal

**Admin Section:**
- Business Account
- Packages
- Stripe integration
- Subscriptions
- Custom Links
- SMTP configuration
- Webhook management
- Email Templates
- Training Content
- Partners

**Resources Section:**
- Support links
- Tutorial content
- Documentation

---

## 6. Data Flow Architecture

```
User → Search Form → Next.js API Route → Apify Actor → Raw Results
                                                           ↓
                                              Normalize & Store in PostgreSQL
                                                           ↓
                                              Return to UI → Display in List
                                                           ↓
                                              Enrichment → Apify Enrichment Actor
                                                           ↓
                                              AI Assistant → Vercel AI SDK → OpenAI/Gemini
```

### Search Flow:
1. User selects search type and fills form
2. User selects or creates a target list
3. Clicks "Continue" — frontend calls Next.js API route
4. API route validates input (Zod), calls Apify actor with parameters
5. Apify returns raw lead data
6. API normalizes data and stores in PostgreSQL via Prisma
7. Returns results to frontend, displayed in list detail table

### Enrichment Flow:
1. User clicks "Data Enrichment" or per-lead enrich button
2. API sends lead data to Apify enrichment actor
3. Updated contact info stored in database
4. UI updates to show new data

### AI Assistant Flow:
1. User clicks AI action button (e.g., "Direct Message") on a lead
2. Frontend calls AI API route with lead data + business profile context
3. API uses Vercel AI SDK to stream response from OpenAI/Gemini
4. Generated content displayed inline or in modal

---

## 7. Non-Functional Requirements

- **Performance:** Search results should begin streaming within 5 seconds of submission
- **Responsiveness:** Full mobile and tablet support
- **Data Privacy:** No lead data shared with third parties beyond Apify processing
- **Export:** CSV export of any list (no credit charge for export)
- **Theme:** Warm (amber) and Cool (indigo) themes with light/dark mode support

---

## 8. Apify Actor Mapping

Each search type maps to one or more Apify actors. Specific actor IDs will be configured via environment variables.

| Search Type | Apify Actor Purpose | Notes |
|-------------|-------------------|-------|
| People Search | Professional/people data enrichment | LinkedIn-adjacent data |
| Local Search | Google Maps / local business scraping | By business type + location |
| Company Search | Company intelligence / firmographic data | Technologies, employee count, revenue |
| Domain Search | Email finder by domain | Extract all contacts at a company |
| Influencer Search | Social media profile scraping | Instagram, TikTok, YouTube APIs |
| Data Enrichment | Email verification, phone lookup | Per-lead enrichment |

---

## 9. Integration Points

- **Apify** — all lead data sourcing and enrichment
- **OpenAI / Gemini** — AI Assistant content generation via Vercel AI SDK
- **Firecrawl** — Knowledge Base website crawling
- **Webhooks** — outbound data to external CRMs (placeholder for V1)
- **CSV Export** — download list data

---

## 10. Timeline

### Phase 1: Core Search & Lists
- Database schema (leads, lists, labels, searches)
- Sidebar navigation + layout
- New Search page with 5 search type forms
- Apify integration for at least People + Local searches
- Saved Lists (index + detail table view)
- Custom Labels CRUD

### Phase 2: Enrichment & AI
- Data Enrichment via Apify
- Knowledge Base / Business Profile
- AI Assistant inline actions (all 7 action types)
- Phone number lookup enrichment

### Phase 3: Agents & Automation
- AI Agent builder
- Agent scheduling and execution
- Agent dashboard with status management

### Phase 4: Polish & Placeholders
- Admin section placeholder pages
- Credits display (static/placeholder)
- CSV export
- Mobile responsive refinement
- Theme selector integration
