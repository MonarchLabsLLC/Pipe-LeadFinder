# PipeLeads LeadFinder Marketing Redesign

## Scope

The redesigned public marketing surface is the root route (`/`). Authenticated LeadFinder routes, application components, data providers, billing, and the existing dashboard theme system are outside this redesign and remain unchanged.

The public page uses the Scale.gg product-family visual language through styles scoped beneath `.pl-marketing`. Its palette and typography are fixed marketing values; they do not read the app theme provider, `data-theme`, a cookie, an API, or `localStorage`. The logged-in application can therefore keep its amber, indigo, and dark themes without changing the public site.

The client session boundary explicitly treats `/` as public, so the production Keycloak bootstrap cannot replace the homepage with an authentication gate. All non-root application routes retain the existing Keycloak/NextAuth behavior. The credits provider also waits for an authenticated session before polling, preventing unauthenticated marketing visits from producing repeated `/api/credits` requests.

## Preserved Destination Coverage

The header keeps links to Features, How It Works, AI Tools, Sign In, and the main LeadFinder action. The footer repeats the product anchors and adds direct Scale.gg destinations for the PipeLeads comparison, LeadFinder and CRM overviews, pricing, products, privacy, and terms.

All product-entry actions continue to use `/lead-search/new-search`. No marketing action bypasses authentication or invokes a paid search.

## Product Truth Used on the Page

- Five distinct search modes: People, Local, Company, Domain, and Influencer.
- Saved lists, labels, and search history.
- Optional email and phone enrichment when the configured provider returns a match.
- CSV export and configured webhook handoff.
- Website, pasted Text, Q&A, and PDF knowledge sources.
- Per-lead summaries, outreach drafts, subject lines, intros, direct messages, and custom or saved-library prompts.
- A 0–100 fit score with a label, reasons, angle or opener, and suggested next action. This is guidance, not a conversion prediction.
- Manual or scheduled configured agents may combine search, optional enrichment, AI work, and a webhook. Scheduled execution requires application runtime and cron configuration.
- LeadFinder is separate from PipeLeads CRM. It does not claim deal stages, an inbox, a pipeline, or native message sending.

Search results are provider-backed. Coverage, freshness, completeness, and enrichment availability vary by provider and record. The marketing page does not claim universally verified data, guaranteed outcomes, a free trial, native Zapier support, automated outreach, fixed per-operation credit costs, or fabricated customer and performance metrics.

## Product Illustrations

The page's product windows are static, responsive illustrations built from the real LeadFinder concepts and field names. The saved-list example is explicitly marked `SANITIZED DEMO` and uses synthetic names and example organizations. No live customer record, session, database query, paid provider call, or authenticated dashboard screenshot is embedded.

## Verification Matrix

Before release, verify the public root at 1440, 1024, 768, 430, 390, and 320 pixels. Check horizontal overflow, broken assets, navigation and anchor destinations, keyboard focus, mobile-menu Escape behavior, metadata and JSON-LD, minimum mobile touch targets, and exact computed-style stability after forcing app dark/theme state.

Run the repository's documented lint, test, and production-build commands. Do not stage `.playwright-cli/` or other local browser artifacts.

### 2026-07-22 release verification

- `npm run lint`: passed with zero warnings or errors.
- `npm test`: 3 files and 7 tests passed.
- `npm run build`: passed; `/` remains a statically generated route and all existing application/API routes compiled.
- Production-mode browser test at 1440, 1024, 768, 430, 390, and 320 pixels: no horizontal overflow, broken images, missing anchors, invalid JSON-LD, public theme control, or interactive target below 44 pixels.
- Exact marketing theme-isolation comparison: 652 rendered marketing nodes checked across background, text, border, fill, stroke, and shadow properties; zero computed-style changes after forcing the app's dark class, indigo `data-theme`, and dark `localStorage` setting.
- Mobile navigation: fully expands to 358 pixels, exposes six destinations, closes with Escape, returns focus to the menu button, and becomes inert while closed.
- Production public-route check: `/` renders the complete marketing page with zero browser console errors and no Keycloak gate. `/lead-search/new-search` still enters the existing authenticated application boundary.
- All seven external Scale.gg destinations used by the page returned HTTP 200 during verification.
