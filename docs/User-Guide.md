# User Guide

## Pipe-LeadFinder — AI-Powered Lead Intelligence Platform

**Last Updated:** March 2026

---

## Getting Started

### First Login

In development mode, you're automatically signed in as `admin@GrooveDigital.com`. No credentials needed — visit any page and you're authenticated.

In production, users will authenticate through the login page.

### Dashboard Overview

After login, you land on the dashboard with a collapsible sidebar navigation:

- **Credits Remaining** — displays your current credit balance
- **AI Tools** — Knowledge Base, AI Assistant, AI Agent
- **Lead Search** — New Search, Saved Lists, Custom Labels
- **Admin** — account and configuration settings
- **Resources** — help and documentation
- **User menu** — account settings, theme, logout

---

## Lead Search

### Starting a New Search

Navigate to **Lead Search → New Search**. You'll see five search type cards:

| Search Type | What It Finds | Credits |
|-------------|--------------|---------|
| **People Search** | Individuals by role, industry, location | 3 per record |
| **Local Search** | Local businesses by type and area | 1 per company (free if no email found) |
| **Company Search** | Companies by industry, size, technology | 1 per company |
| **Domain Search** | All contacts at a specific company/domain | 1 per individual |
| **Influencer Search** | Social media influencers by platform/niche | 2 per record (+5 for enrichment) |

**To run a search:**
1. Click a search type card (selected card shows a checkmark)
2. Fill in the search form that appears below
3. Select an existing list or click "Create new list"
4. Click **→ Continue**

### People Search

The most detailed search type. Start with:
- **Description** — what kind of person (e.g., "Web Designer")
- **Location** — where to search
- **Results Limit** — how many results to return

Click **Advanced filters** to access 15+ additional filters: Job Title, Department, Management Level, Skills, Years of Experience, Company, Industry, Education, and more.

**Pro Tip:** Start broad. Over-filtering reduces results significantly.

### Local Search

The simplest search. Just enter:
- **Business Type** — e.g., "Hairdresser", "Restaurant", "Dentist"
- **Location** — e.g., "Seattle", "Miami, FL"

No credits charged if no email is found for a business.

### Company Search

Search for companies with filters for:
- Description, Location, Radius
- Industry, Company Name, Domain
- Technologies used, Keywords
- Employee Count, Revenue range

### Domain Search

Enter a **Company Name or Website** (e.g., "Amazon" or "amazon.com") to find all contacts with publicly available email addresses at that company.

Example: If 7 staff have emails, 7 credits are consumed.

### Influencer Search

Search across **Instagram**, **TikTok**, or **YouTube** (select platform tab).

Filter by: Hashtags, Followers, Age, Engagement Rate, Language, Gender, Category, Account Type, Verified status, Sponsored Posts, and Audience demographics.

You can also **Search by Username** directly.

---

## Saved Lists

Navigate to **Lead Search → Saved Lists** to view all your lead lists.

### List Index

- **Filter tabs** — All, People, Domain, Local, Company, Influencer (with counts)
- **Search** — find lists by name
- **Active / Archive** — toggle between active and archived lists
- **Grid / List view** — switch display format
- **+ Create New** — create an empty list

Each list card shows:
- Type icon and label
- Record count and email-found count
- Creation date
- Settings gear for rename/archive/delete

### List Detail (Results Table)

Click a list to open its results. The table shows all leads with these columns:

**Name Column:**
- Avatar, full name, job title
- Location with map pin
- Social media links (LinkedIn, Facebook)
- Edit button to modify lead data

**AI Assistant Column:**
- One-click AI actions per lead (see AI Assistant section)

**Contact Info Column:**
- Email address with verification status (Found / Not Found / Potential)
- "Get Phone Numbers" button — enrichment action
- "Add Phone Number" / "Add Email" — manual entry

**Company Column:**
- Company name linked to website
- Company LinkedIn link

**Custom Labels Column:**
- Applied label tags
- "Add" button to apply labels

**Created At Column:**
- Relative timestamp

### Action Bar

Above the results table:
- **History** — view search history for this list
- **Filter tabs** — All | Email found | Email not found | Potential
- **Status filter** — filter by outreach status (Unsent, etc.)
- **More Filters** — additional filtering options
- **Search** — run another search into this list
- **Data Enrichment** — bulk enrich all leads
- **AI Agent** — create an agent for this list
- **List new search** — add more leads via new search

---

## Custom Labels

Navigate to **Lead Search → Custom Labels**.

Labels let you tag leads for tracking outreach status:
- Type a label name and click **+ Add Label**
- Default labels: Called, Messaged, Emailed, Exported to CSV
- Labels appear as tags on leads in the results table
- Apply labels from the "Add" button in the Custom Labels column

---

## AI Tools

### Knowledge Base (Business Profile)

Navigate to **AI Tools → Knowledge Base**.

Your business profile powers all AI-generated content. Fill in:
- **Business Name** — your company name
- **Business Website** — your website URL
- **What do you sell?** — your product/service
- **Who does it help?** — your target audience
- **What does it do for them?** — your value proposition
- **Contact person name** — who the outreach is from
- **Personality** — tone of generated content (e.g., "Professional, Friendly")

**Data Sources** allow the AI to learn more about your business:
- **Website** — crawl your entire site or a single page
- **Text** — paste custom context
- **Q&A** — structured question/answer pairs
- **PDF** — upload documents

### AI Assistant

The AI Assistant generates personalized outreach content per lead. Access it from the AI Assistant column in any results table:

| Action | What It Does |
|--------|-------------|
| **Similar People** | Find leads similar to this person |
| **Direct Message** | Generate a personalized DM |
| **Summary** | Generate a prospect research summary |
| **Subject Line** | Generate email subject line options |
| **Intro** | Generate an email opening paragraph |
| **Custom** | Run any custom prompt against this lead's data |
| **Library** | Use a saved prompt template |

All AI actions are **zero credit cost** — they use your AI API keys, not search credits.

### AI Agents

Navigate to **AI Tools → AI Agent**.

AI Agents automate your prospecting workflow:
1. Click **New AI Agent**
2. Give it a name and description
3. Configure: search type, parameters, actions (enrich, research, content), and connections (webhook, CRM)
4. Set schedule or trigger
5. Monitor from the agent dashboard

Agent statuses: **Draft** (building), **Active** (running), **Paused** (stopped)

---

## Data Enrichment

Enrich leads with additional contact data:

**Per-lead enrichment** (from results table):
- Click "Get Phone Numbers" to find phone numbers
- Click "Add Email" if email wasn't found in initial search

**Bulk enrichment** (from action bar):
- Click "Data Enrichment" to enrich all leads in the list

Enrichment consumes credits based on the data found.

---

## Exporting Data

Export any list to CSV from the list detail page. **No credits are charged for exports.**

---

## Theme & Display

The application supports two color themes and two display modes:

- **Warm (Amber)** — warm, golden accent colors
- **Cool (Indigo)** — cool, blue accent colors
- **Light Mode** — light backgrounds
- **Dark Mode** — dark backgrounds

Access the theme selector from the user menu or settings.
