import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Database,
  Download,
  Globe,
  History,
  ListFilter,
  MapPin,
  MessageSquareText,
  Search,
  Sparkles,
  Star,
  Tags,
  Users,
  Webhook,
} from "lucide-react"
import { LeadFinderHeader, PipeLeadsMark } from "@/components/marketing/leadfinder-header"
import { AgentPreview, KnowledgePreview, SavedListPreview, SearchWorkspacePreview } from "@/components/marketing/leadfinder-visuals"

export const metadata: Metadata = {
  title: "PipeLeads LeadFinder — AI Prospect Discovery Software",
  description: "Search five prospect types, enrich selected records when available, organize lists, and review AI fit guidance and drafts before anything moves forward.",
  alternates: { canonical: "https://pipeleads.ai/" },
  openGraph: {
    type: "website",
    siteName: "PipeLeads LeadFinder",
    title: "PipeLeads LeadFinder — AI Prospect Discovery Software",
    description: "Search five prospect types, enrich selected records when available, organize lists, and review AI fit guidance and drafts before anything moves forward.",
    url: "https://pipeleads.ai/",
    images: [{ url: "https://pipeleads.ai/social/pipeleads.webp", width: 1200, height: 630, alt: "PipeLeads LeadFinder prospect discovery workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PipeLeads LeadFinder — AI Prospect Discovery Software",
    description: "Search five prospect types, add business context, and review AI fit guidance and outreach drafts before anything moves forward.",
    images: ["https://pipeleads.ai/social/pipeleads.webp"],
  },
}

const searchModes = [
  { number: "01", icon: Users, label: "People Search", copy: "Find professional records by role, location, company, skills, experience, industry, and other supported filters.", tone: "coral" },
  { number: "02", icon: MapPin, label: "Local Search", copy: "Look for local businesses by business type and location, then review the fields the source returned.", tone: "mint" },
  { number: "03", icon: Building2, label: "Company Search", copy: "Research companies by market, location, size, technology, revenue range, domain, and related criteria.", tone: "lilac" },
  { number: "04", icon: Globe, label: "Domain Search", copy: "Start with a company name or domain and look for associated professional contact records.", tone: "lime" },
  { number: "05", icon: Star, label: "Influencer Search", copy: "Explore Instagram, TikTok, or YouTube profiles by niche, audience, engagement, and platform criteria.", tone: "peach" },
]

const workflow = [
  { number: "01", label: "INPUT", title: "Define the market", copy: "Choose a search mode, enter the useful filters, and select or create the list where returned records should live." },
  { number: "02", label: "PROVIDER WORK", title: "Search for records", copy: "PipeLeads sends the criteria to the configured data provider and stores the supported fields it returns." },
  { number: "03", label: "YOUR REVIEW", title: "Inspect and organize", copy: "Review each record, optional enrichment result, label, search history entry, and fit explanation before acting." },
  { number: "04", label: "HANDOFF", title: "Export what matters", copy: "Download an approved list as CSV or configure a webhook handoff. Native message sending is not assumed." },
]

const faqs = [
  { question: "What is PipeLeads LeadFinder?", answer: "It is a prospect discovery workspace for searching five record types, organizing results into lists, optionally enriching selected records, scoring fit against business context, and preparing reviewable AI guidance." },
  { question: "Is every record complete, current, or verified?", answer: "No. Coverage, freshness, and enrichment availability depend on the configured provider and the specific record. PipeLeads shows what was returned so you can review it." },
  { question: "Does LeadFinder contact prospects automatically?", answer: "No native sending workflow has been established. AI actions produce drafts or guidance that you review and copy; webhook handoffs run only when you configure them." },
  { question: "How does lead scoring work?", answer: "PipeLeads compares a saved record with the business profile and knowledge sources you supplied, then returns a 0–100 fit score, label, reasons, suggested angle or opener, and next-action guidance. It is not a conversion prediction." },
  { question: "Is LeadFinder the same as PipeLeads CRM?", answer: "No. LeadFinder discovers, enriches, scores, organizes, and exports prospect records. PipeLeads CRM is the separate product intended for managing sales relationships and deals." },
  { question: "Where is PipeLeads LeadFinder included?", answer: "PipeLeads LeadFinder is included in the Scale.gg Pro membership. Current plan pricing, credits, and application availability live on Scale.gg." },
]

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://pipeleads.ai/#software",
      name: "PipeLeads LeadFinder",
      url: "https://pipeleads.ai/",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "A prospect discovery workspace with five search modes, optional enrichment, saved lists, knowledge-based fit guidance, reviewable AI drafts, CSV export, and configured webhook handoff.",
      featureList: ["People, Local, Company, Domain, and Influencer search", "Saved lists, labels, and search history", "Optional email and phone enrichment", "0–100 business-context fit guidance", "Reviewable per-lead AI actions", "CSV export and configured webhooks"],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
    },
  ],
}

export default function LandingPage() {
  return (
    <div className="pl-marketing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <LeadFinderHeader />

      <main>
        <section className="pl-hero">
          <div className="pl-shell pl-hero__grid">
            <div className="pl-hero__copy">
              <span className="pl-eyebrow"><i /> PIPELEADS · PROSPECT DISCOVERY</span>
              <h1>Prospect discovery software with five search modes and reviewable AI fit guidance.</h1>
              <p className="pl-hero__definition">Search people, local businesses, companies, domains, or influencers. Keep the criteria, returned records, business context, and next-action guidance in one reviewable workspace.</p>
              <p className="pl-hero__mechanism">Choose the market. Save the records worth examining. Enrich selected fields when available, score fit against your context, and decide what moves forward.</p>
              <div className="pl-button-row">
                <a className="pl-button pl-button--coral" href="/lead-search/new-search">Open LeadFinder <ArrowRight /></a>
                <a className="pl-button pl-button--outline" href="#how-it-works">See the workflow</a>
              </div>
              <p className="pl-truth-note"><Check />Source coverage, freshness, and enrichment availability vary by provider and record.</p>
            </div>
            <div className="pl-hero__visual"><div className="pl-hero__backdrop" aria-hidden="true" /><SearchWorkspacePreview /></div>
          </div>
        </section>

        <section className="pl-facts" aria-label="Verified PipeLeads LeadFinder facts">
          <div className="pl-shell pl-facts__grid">
            <div><strong>5</strong><span>distinct search modes</span></div>
            <div><strong>4</strong><span>knowledge-source types</span></div>
            <div><strong>0–100</strong><span>explainable fit guidance</span></div>
            <div><strong>CSV</strong><span>approved-list export</span></div>
          </div>
        </section>

        <section className="pl-section pl-problem">
          <div className="pl-shell pl-problem__grid">
            <div><span className="pl-section-label">THE LIST IS ONLY THE START</span><h2>A mystery spreadsheet is not a prospecting strategy.</h2><p>Rows without criteria, context, or source boundaries leave the next person guessing. PipeLeads keeps the search, the record, and the reasoning close enough to review.</p></div>
            <div className="pl-contrast-cards"><article><small>DISCONNECTED PROSPECTING</small><strong>Search → export → lose the criteria → guess what matters</strong><p>The file travels, but the reasoning behind it disappears.</p></article><article><small>PIPELEADS LEADFINDER</small><strong>Define → search → review → organize → hand off</strong><p>The user keeps control of what is enriched, scored, drafted, exported, or sent to a webhook.</p></article></div>
          </div>
        </section>

        <section id="features" className="pl-section pl-modes">
          <div className="pl-shell">
            <div className="pl-heading pl-heading--split"><div><span className="pl-section-label">FIVE WAYS INTO THE MARKET</span><h2>Start with the record type the job actually needs.</h2></div><p>Each mode has its own criteria and provider mapping. Returned fields depend on the source and target—not a universal completeness promise.</p></div>
            <div className="pl-mode-grid">{searchModes.map(({ icon: Icon, ...mode }) => <article key={mode.label} data-tone={mode.tone}><div><span>{mode.number}</span><Icon /></div><h3>{mode.label}</h3><p>{mode.copy}</p><a href="/lead-search/new-search">Open search <ArrowRight /></a></article>)}</div>
          </div>
        </section>

        <section id="how-it-works" className="pl-section pl-workflow">
          <div className="pl-shell">
            <div className="pl-heading pl-heading--split"><div><span className="pl-section-label">INPUT → WORK → OUTPUT → REVIEW</span><h2>Know what the software does—and what stays yours.</h2></div><p>Search is provider-backed. AI does not invent the source record, and a score does not turn into a promised outcome.</p></div>
            <div className="pl-workflow-grid">{workflow.map((step) => <article key={step.number}><div><span>{step.number}</span><small>{step.label}</small></div><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
          </div>
        </section>

        <section className="pl-section pl-lists">
          <div className="pl-shell pl-lists__grid">
            <div className="pl-lists__copy"><span className="pl-section-label">FROM RESULT TO WORKING LIST</span><h2>Keep the evidence beside the recommendation.</h2><p>Saved lists hold the returned record, its labels, the search history, enrichment status, and any business-context score. Open the score to inspect the reasons, suggested opener, and next action.</p><ul><li><History />Review the last searches run into a list</li><li><Tags />Apply custom labels per list entry</li><li><ListFilter />Filter by contact-data status</li><li><Download />Export the approved list as CSV</li></ul><p className="pl-truth-note"><Sparkles />Fit scores are guidance, not a guarantee that a prospect will respond or convert.</p></div>
            <SavedListPreview />
          </div>
        </section>

        <section className="pl-section pl-enrichment">
          <div className="pl-shell pl-enrichment__grid">
            <div><span className="pl-section-label">OPTIONAL ENRICHMENT</span><h2>Ask for more data only where it is useful.</h2><p>Run email or phone enrichment on selected records, or process eligible records in a saved list. The result updates the record when the configured provider finds a match.</p><a className="pl-text-link" href="/lead-search/new-search">Start with a search <ArrowRight /></a></div>
            <div className="pl-enrichment-cards"><article><span><Database /></span><small>BEFORE</small><strong>Source record</strong><p>Name, role, organization, profile, or location fields returned by the selected search.</p></article><article><span><Search /></span><small>REQUEST</small><strong>Selected lookup</strong><p>The user invokes email, phone, or eligible bulk enrichment where more contact detail is needed.</p></article><article><span><Check /></span><small>AFTER</small><strong>Available result</strong><p>A found value is stored with its status. No match remains an explicit no-result—not invented data.</p></article></div>
          </div>
        </section>

        <section id="ai-tools" className="pl-section pl-intelligence">
          <div className="pl-shell pl-intelligence__grid">
            <KnowledgePreview />
            <div><span className="pl-section-label">BUSINESS-CONTEXT INTELLIGENCE</span><h2>Give the guidance something real to compare against.</h2><p>Build a business profile, then add Website, pasted Text, Q&amp;A, or PDF sources. PipeLeads combines that approved context with a selected record to explain fit or prepare the chosen draft.</p><div className="pl-output-list"><article><Sparkles /><div><strong>Fit guidance</strong><span>Score, label, reasons, angle, opener, next action</span></div></article><article><MessageSquareText /><div><strong>Per-lead drafts</strong><span>Summary, direct message, subject line, intro, custom prompt, or saved template</span></div></article><article><Check /><div><strong>User review</strong><span>Inspect and copy the output before it leaves the workspace</span></div></article></div></div>
          </div>
        </section>

        <section className="pl-section pl-agents">
          <div className="pl-shell pl-agents__grid">
            <div><span className="pl-section-label">CONFIGURED AGENTS</span><h2>Automate the preparation. Keep the judgment.</h2><p>Configure a manual or scheduled sequence that combines a search, optional enrichment, selected AI work, and a webhook handoff. Scheduled execution depends on the application runtime and cron configuration.</p><div className="pl-pill-list"><span>Manual</span><span>Daily</span><span>Weekly</span><span>Monthly</span><span><Webhook />Configured webhooks</span></div></div>
            <AgentPreview />
          </div>
        </section>

        <section className="pl-section pl-separation">
          <div className="pl-shell pl-separation__inner"><div><span className="pl-section-label">TWO PIPELEADS PRODUCTS</span><h2>LeadFinder discovers. CRM manages the sales relationship.</h2></div><div><p>This page is only about prospect discovery, enrichment, fit guidance, organization, drafts, and handoff. Deal stages, activities, inboxes, and pipelines belong to the separate PipeLeads CRM.</p><a className="pl-text-link" href="https://scale.gg/pipeleads/">Compare both PipeLeads products <ArrowRight /></a></div></div>
        </section>

        <section className="pl-section pl-faq">
          <div className="pl-shell pl-faq__grid"><div><span className="pl-section-label">STRAIGHT ANSWERS</span><h2>Before you run the first search.</h2></div><div className="pl-faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown /></summary><p>{faq.answer}</p></details>)}</div></div>
        </section>

        <section className="pl-final-cta">
          <div className="pl-shell pl-final-cta__inner"><div><span className="pl-section-label">THE SCALE.GG FAMILY</span><h2>One membership. A focused app for every marketing job.</h2></div><div><p>PipeLeads LeadFinder is included in Scale.gg—the AI-powered marketing suite for planning, creating, publishing, selling, and supporting your business.</p><div className="pl-button-row"><a className="pl-button pl-button--coral" href="https://scale.gg/">Explore Scale.gg <ArrowRight /></a><a className="pl-button pl-button--light" href="https://app.scaleplus.gg/apps">See all apps</a></div></div></div>
        </section>
      </main>

      <footer className="pl-footer">
        <div className="pl-shell pl-footer__top">
          <div className="pl-footer__brand"><Link className="pl-brand" href="/"><PipeLeadsMark /><span>PipeLeads <b>LeadFinder</b></span></Link><p>Prospect discovery, optional enrichment, business-context guidance, and a reviewable handoff.</p><span>Part of the Scale.gg product family</span></div>
          <div className="pl-footer__links">
            <div><strong>Product</strong><a href="#features">Features</a><a href="#how-it-works">How It Works</a><a href="#ai-tools">AI Tools</a><a href="/lead-search/new-search">Open LeadFinder</a></div>
            <div><strong>PipeLeads</strong><a href="https://scale.gg/pipeleads/">Compare both apps</a><a href="https://scale.gg/pipeleads-leadfinder/">LeadFinder overview</a><a href="https://scale.gg/pipeleads-crm/">CRM overview</a></div>
            <div><strong>Scale.gg family</strong><a href="https://scale.gg/">Scale.gg</a><a href="https://app.scaleplus.gg/apps">Explore all apps</a><a href="https://scale.gg/pricing/">Pricing</a><a href="https://app.scaleplus.gg/">Sign in</a></div>
          </div>
        </div>
        <div className="pl-shell pl-footer__bottom"><span>© 2026 PipeLeads LeadFinder — A Scale.gg product</span><div><a href="https://scale.gg/privacy-policy/">Privacy</a><a href="https://scale.gg/terms-of-service/">Terms</a></div></div>
      </footer>
    </div>
  )
}
