# User Guide

## Pipe-LeadFinder — AI-Powered Lead Intelligence Platform

**Last Updated:** September 2026 (focused Agent, opt-in rollout)

---

## Getting Started

### First Login

In development mode, you're automatically signed in as `admin@GrooveDigital.com`. No credentials needed — visit any page and you're authenticated.

In production, PipeLeads uses your Keycloak account. Sign in through the Keycloak prompt when it appears. Your account must have the PipeLeads app role; if you see **Access Denied**, contact your administrator to request access.

### Dashboard Overview

After login, you land on the dashboard. Lead Finder uses the same frame as the rest of PipeLeads, so the sidebar and header look and work the same whichever PipeLeads app you are in.

The collapsible sidebar holds:

- **Apps** — PipeLeads CRM, Lead Finder (marked with a dot while you are here) and ProjectBaser. Choosing another app opens it in the same tab.
- **Lead Search** — New Search, Saved Lists, Custom Labels, and the **AI Tools** submenu (Knowledge Base, AI Assistant, AI Agent)
- **Admin** — account and configuration settings (administrators only)
- **Resources** — Integrations, Support and Tutorials

Your credit balance sits in the slim **credits bar** pinned to the bottom of every screen (see "The credits bar" under Credits).

The header shows where you are (for example *Lead Search › Saved Lists*), a **Search** box (press ⌘K or Ctrl+K) that jumps to any page or PipeLeads app, the ScalePlus **Apps** launcher, the **Agent** button, the light/dark theme toggle, and your avatar menu (Tutorials, Integrations, Support, Log out).

---

## Lead Search

### The Pro Max Agent

When enabled for your account, **Agent** in the top header opens a private conversation panel. Select an existing saved list and describe the prospects you want. The Agent asks for missing details and shows the current maximum cost before a paid search starts. To enrich or score saved leads, select the exact records in the panel, review the preview, then approve or reject it.

Answers support Markdown, including links, lists, tables and code. **Copy message** copies the original text of either your message or the answer. Use the history menu to reopen conversations after refresh, or **New conversation** to start fresh. Long jobs show progress and results; you can close the panel and return. Failed or uncertain paid jobs are not silently repeated.

Pro Max unlocks access; Scale Credits meter AI usage and existing paid product operations. The approval card uses current configured pricing, which takes precedence over example prices in this guide. Scoring uses actual token billing rather than an invented fixed quote. The focused Agent does not create prospecting schedules, send outbound messages, delete records, or overwrite existing non-empty contact details.

**Connect to Superpowers** opens the private Codex/Claude installation and ClickCampaigns OAuth guide. No customer API key is required. Sharing your selected list is optional; external conversations remain in Codex or Claude. Your app history remains private. This Agent requires a verified Keycloak sign-in, even in development; the existing automatic development login does not unlock it. See [Focused Agent operations](Focused-Agent.md) for rollout prerequisites.

When CRM transfers are enabled, select saved leads, open **Send selected leads to CRM**, and choose an authorized CRM workspace, pipeline, and stage. Review the exact contact/deal fields, skipped rows, duplicates, and possible workflow effects. **Review and approve in CRM** opens the destination approval card; nothing is created until you approve it there (or through the external client's human approval form). Existing matches are skipped, not overwritten. Records need a name and email; incomplete or ambiguous matches stay flagged. Use **Refresh progress** or **Restore transfer** to return to results and record links. Do not repeat an uncertain transfer: review its saved outcome first.

### Starting a New Search

Navigate to **Lead Search → New Search**. You'll see five search type cards:

| Search Type | What It Finds | Credits |
|-------------|--------------|---------|
| **People Search** | Individuals by role, industry, location | 50 credits per contact |
| **Local Search** | Local businesses by type and area | 25 credits per business; no charge when no email is returned |
| **Company Search** | Companies by industry, size, technology | 25 credits per company |
| **Domain Search** | All contacts at a specific company/domain | 25 credits per contact |
| **Influencer Search** | Social media influencers by platform/niche | 25 credits per profile |

**To run a search:**
1. Click a search type card (selected card shows a checkmark)
2. Fill in the search form that appears below
3. Select an existing list or click "Create new list"
4. Click **→ Continue**

### People Search

The most detailed search type. Start with:
- **Description** — what kind of person (e.g., "Web Designer")
- **Location** — where to search (supports autocomplete — type 3+ characters to see suggestions)
- **Results Limit** — how many results to return

Click **Advanced filters** to access 15+ additional filters: Job Title, Department, Management Level, Skills, Years of Experience, Company, Industry, Education, and more.

**Pro Tip:** Start broad. Over-filtering reduces results significantly.

### Local Search

The simplest search. Just enter:
- **Business Type** — e.g., "Hairdresser", "Restaurant", "Dentist"
- **Location** — e.g., "Seattle", "Miami, FL" (supports autocomplete)

No credits charged if no email is found for a business.

### Company Search

Search for companies with filters for:
- Description, Location, Radius (location field supports autocomplete)
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
- One **AI** menu per lead (see "The AI menu and email badges" below)

**Lead Score Column:**
- Shows an AI fit score when your list has been scored
- Select the score to see the fit label, outreach angle, suggested opener, and next action

**Contact Info Column:**
- Email address with a plain-language status badge (Email found / Possible email / No email)
- "Get Phone Numbers" button — enrichment action
- "Add Phone Number" / "Add Email" — manual entry

**Company Column:**
- Company name linked to website
- Company LinkedIn link

**Send to Column** (only when PipeLeads or MailBaser is connected):
- **PipeLeads** / **MailBaser** buttons — see "Sending leads to PipeLeads and MailBaser"

**Custom Labels Column:**
- Applied label tags
- "Add" button to apply labels

**Created At Column:**
- Relative timestamp

### The AI menu and email badges

**The AI menu.** Each lead has one **AI** button in the AI Assistant column. Open it (click, or Tab to it and press Enter) to choose Similar People, Direct Message, Summary, Subject Lines, Email Intro, Custom Prompt or Prompt Library. Use the arrow keys to move through the menu and Enter to pick. The result opens in the side panel exactly as before; closing the panel puts you back on that lead's AI button.

**Email badges.** Hover over or Tab to a badge to see what it means:

| Badge | Meaning |
|-------|---------|
| **Email found** | Found — not yet verified |
| **Possible email** | Potential — guessed from the company website |
| **No email** | Not found (use **Add Email** to look it up) |

Lead Finder does not verify email addresses yet, so treat even a found address as unverified.

### Action Bar

Above the results table:
- **History** — opens a side sheet showing all past searches run into this list (date, type, parameters, result count)
- **Filter tabs** — All | Email found | Email not found | Potential
- **Data Enrichment** — bulk enrich all leads in this list that are missing emails (calls Apify `code_crafter/personal-email-finder` per lead)
- **Score Leads** — rank the leads by fit using your Knowledge Base context
- **AI Agent** — navigate to the AI Agent page to create an agent for this list
- **Export CSV** — download the leads currently in the list

---

## Search History

Every search run into a list is recorded automatically. To view the history for a list:

1. Open the list detail page
2. Click **History** in the action bar
3. A side sheet opens showing the last 50 searches, newest first

Each history entry shows: search type, parameters used, number of results returned, and the date/time the search was run.

---

## Custom Labels

Navigate to **Lead Search → Custom Labels**.

Labels let you tag leads for tracking outreach status:
- Type a label name and click **+ Add Label**
- Default labels: Called, Messaged, Emailed, Exported to CSV
- Labels appear as tags on leads in the results table
- Apply labels from the "Add" button in the Custom Labels column
- Remove labels by clicking the × on an applied tag

Labels are applied per lead entry (a lead can have different labels in different lists).

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

### AI Assistant and Prompt Templates

The **AI Assistant** page is where you create and manage reusable prompt templates. A template can include `{name}`, `{company}`, and `{title}` so it adapts to each lead.

To use AI with an individual lead, open a saved list and open the **AI** menu in that lead's **AI Assistant** column:

| Action | What It Does |
|--------|-------------|
| **Similar People** | Find leads similar to this person |
| **Direct Message** | Generate a personalized DM |
| **Summary** | Generate a prospect research summary |
| **Subject Line** | Generate email subject line options |
| **Intro** | Generate an email opening paragraph |
| **Custom** | Run any custom prompt against this lead's data |
| **Library** | Choose and run a saved prompt template |

Generated content appears in a side panel, where you can copy it to your clipboard. AI Assistant responses use token-based credits.

### Lead Scoring

Use **Score Leads** from a saved list when you want to focus on the prospects most likely to fit your offer. PipeLeads compares the leads to the Business Profile and data sources in your Knowledge Base, then ranks them from 0 to 100.

1. Open a saved list and click **Score Leads**.
2. Wait for the completion notice. Lists with scores are automatically ordered from highest to lowest score.
3. Select a score in the **Lead Score** column to review its fit label, reasons, suggested opener, and recommended next action.

Lead scoring uses token-based credits.

### AI Agents

Navigate to **AI Tools → AI Agent**.

AI Agents automate a prospecting workflow:
1. Click **New AI Agent**
2. Give it a name, optional description, and optional auto-save setting.
3. Open the agent and configure its search type, description, location, actions, webhook connections, and schedule.
4. Select the actions to run on each result: email enrichment, phone enrichment, AI summary, or AI direct message.
5. Click **Save**, then **Run** to execute it immediately. Set the agent to **Active** for scheduled runs.

Agent statuses: **Draft** (building), **Active** (running), **Paused** (stopped)

Schedules can be Manual, Daily, Weekly, or Monthly. Scheduled runs require the application scheduler to be configured by your administrator.

---

## Data Enrichment

Enrich leads with additional contact data. All enrichment uses person-level Apify actors powered by the lead's LinkedIn URL (falls back to name + company if no LinkedIn URL is available).

**Per-lead email enrichment** (from results table):
1. Find a lead whose email shows "Not Found"
2. Click **Add Email** in the Contact Info column
3. The system calls `code_crafter/personal-email-finder` with the lead's LinkedIn URL
4. The email and verification status update in place when the enrichment completes

**Per-lead phone enrichment** (from results table):
1. Find a lead in the Contact Info column
2. Click **Get Phone Numbers**
3. The system calls `code_crafter/mobile-finder` with the lead's LinkedIn URL
4. The phone number updates in place when the enrichment completes

**Bulk enrichment** (from action bar):
1. Click **Data Enrichment** in the action bar
2. The system enriches all leads in the list where email status is `NOT_FOUND` or `UNKNOWN`
3. A progress summary is returned showing how many leads were enriched out of the total eligible

Enrichment consumes 25 credits when a matching email or phone number is found. There is no enrichment charge when no result is found.

---

## Sending leads to PipeLeads and MailBaser

When the app is connected to the PipeLeads CRM and/or MailBaser, each lead row has a
**Send to** column and the selection bar (shown when you tick leads) has the same buttons.
Leads arrive in **your own** CRM and MailBaser account: you are matched by your Scale Plus
sign-in.

- **PipeLeads** — one click adds the lead as a contact with its company. Leads already in the
  CRM are updated, not duplicated. The arrow next to the button lets you also create a deal
  (choose pipeline and stage) and add tags; these choices are remembered in this browser and
  reused by the next one-click send.
- **MailBaser** — the first click asks which lists and tags to use; after that one click sends
  with the same choices (the arrow changes them). Leads without an email address are skipped.
  Contacts are added as prospects, not as consenting subscribers. You need a MailBaser account;
  if you do not have one the error message says so.
- A message reports how many leads were added (new / updated / skipped) with an **Open** link.
- Large selections are sent 50 at a time.
- Only the workspace owner can send; inside a shared team workspace the buttons are hidden.

---

## Exporting Data

Export any list to CSV from the list detail page:

1. Open a list detail page
2. Click **Export CSV** in the action bar (or results header)
3. A CSV file downloads automatically — named `<list-name>-leads.csv`

**Exported columns:** Full Name, First Name, Last Name, Title, Email, Email Status, Phone, Phone Status, Company, Company Website, Company LinkedIn, Industry, Location, City, State, Country, LinkedIn, Facebook, Instagram, Twitter, Labels, Created At.

**No credits are charged for exports.**

---

## Theme & Display

Lead Finder uses the PipeLeads colour theme, the same one as PipeLeads CRM and ProjectBaser, in a light and a dark mode. It follows your device's setting until you choose one: click the moon (or sun) button in the header to switch between light and dark. Your choice is remembered in this browser.

---

## Credits

### The credits bar

Your live balance sits in a slim bar pinned to the bottom of every Lead Finder screen, for example **273,281 credits**. It stays put while the page scrolls and fits on one line on a phone. The balance updates automatically every 30 seconds, and every 5 seconds while a search or enrichment is running.

- **Normal:** the balance shows in quiet grey.
- **Running low:** the balance turns amber once it no longer covers a 25-result People search at the current price.
- **Out of credits:** at zero or below the balance turns red and a **Top up** link appears on the right.

Hover over the balance (or click it, tap it, or Tab to it and press Enter) to open the details: your balance, the credits you have used, the price per result for each search type, a reminder that you are only charged for results we find, and an **Open Credit Wallet** button.

### Buying Credits

Open the credits bar and choose **Open Credit Wallet** (or **Top up** when you are out) to open the ScaleCredits purchase portal in a new tab. Purchase credits there and your balance updates in the app automatically.

### Credit Checks

Credits are checked **before every search and enrichment operation**. If your balance is negative, the operation is blocked and you will be prompted to add credits before continuing.

### Credit Costs

| Operation | Cost |
|-----------|------|
| People Search | 50 credits per contact |
| Local Search | 25 credits per business (free if no email found) |
| Company Search | 25 credits per company |
| Domain Search | 25 credits per contact found |
| Influencer Search | 25 credits per profile |
| Email enrichment | 25 credits per lead when found |
| Phone enrichment | 25 credits per lead when found |
| AI Assistant | Token-based (charged per response) |
| Lead scoring | Token-based (charged per scoring run) |
| CSV Export | Free |

The credit service can supply current per-hit pricing, so the amount shown in the app is the amount to rely on before you run an operation.

## Saved-lead automations

When the coordinated Scale Plus connection is enabled, you can start a workflow when an existing prospect is added to one of your active lists or receives a label. Conditions check whether the current contact is already in that list or has a selected label. The available action applies one of your existing labels to that contact's existing list entry.

The contact's email must match a saved lead that you own in the selected list. If several entries match, choose the intended entry; the system will not guess. Archived or foreign lists, leads and labels are unavailable. The action does not create a lead or label, run searches, enrich contact information, call AI, send messages, or spend credits.

Saved prospects are not automatically subscribed or granted email permission. This connection is separate from PipeLeads CRM. Adapter rollout includes the source, automation platform and neutral-prospect delivery protections; see [setup and detailed behavior](ScalePlus-Automations.md).
