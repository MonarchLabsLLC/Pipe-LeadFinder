import type { CSSProperties } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import Script from "next/script"
import {
  LeadFinderHeader,
  LEADFINDER_APP_URL,
  LEADFINDER_SEARCH_URL,
  PIPELEADS_CRM_URL,
  PipeLeadsMark,
} from "@/components/marketing/leadfinder-header"
import {
  ArrowIcon,
  DownloadIcon,
  KnowledgeBoard,
  modeIcons,
  SearchWorkspacePreview,
  SparkIcon,
  WebhookIcon,
} from "@/components/marketing/leadfinder-visuals"
import "@/components/marketing/pipeleads-marketing.css"

const ATLAS_URL = "https://scale.gg/feature-atlas/pipeleads-leadfinder/"
const YOUTUBE_ID = "ICNvg_pUN4s"
const VIDEO_TITLE = "Introducing PipeLeads LeadFinder"
const VIDEO_DURATION = "1:56"
// Bump when public/marketing/*.js changes so cached copies are never reused.
const SCRIPT_VERSION = "20260929facelift1"

export const metadata: Metadata = {
  title: "PipeLeads LeadFinder — AI Prospect Discovery Software",
  description: "Search five prospect types, organize saved lists, enrich selected records when available, and review AI fit guidance before anything moves forward.",
  authors: [{ name: "Pipeleads.ai" }],
  creator: "Pipeleads.ai",
  publisher: "Scale.gg",
  category: "technology",
  keywords: ["lead generation", "AI lead finder", "B2B lead discovery", "lead enrichment", "contact discovery", "company intelligence", "influencer search", "people search", "domain search", "Scale.gg"],
  alternates: { canonical: "https://pipeleads.ai" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: "PipeLeads LeadFinder",
    title: "PipeLeads LeadFinder — AI Prospect Discovery Software",
    description: "Search five prospect types, add business context, and review AI fit guidance and outreach drafts before anything moves forward.",
    url: "https://pipeleads.ai",
    images: [{ url: "https://pipeleads.ai/social/pipeleads.webp", width: 1200, height: 630, alt: "PipeLeads LeadFinder prospect discovery workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@pipeleadsai",
    title: "PipeLeads LeadFinder — AI Prospect Discovery Software",
    description: "Search five prospect types, add business context, and review AI fit guidance before anything moves forward.",
    images: ["https://pipeleads.ai/social/pipeleads.webp"],
  },
}

const searchModes = [
  { number: "01", label: "People Search", copy: "Find professional records by role, location, company, skills, experience, industry, and other supported filters.", tone: "coral" },
  { number: "02", label: "Local Search", copy: "Look for local businesses by business type and location, then review the fields the source returned.", tone: "mint" },
  { number: "03", label: "Company Search", copy: "Research companies by market, location, size, technology, revenue range, domain, and related criteria.", tone: "lilac" },
  { number: "04", label: "Domain Search", copy: "Start with a company name or domain and look for associated professional contact records.", tone: "lime" },
  { number: "05", label: "Influencer Search", copy: "Explore Instagram, TikTok, or YouTube profiles by niche, audience, engagement, and platform criteria.", tone: "sky" },
] as const

const workflow = [
  { number: "01", label: "INPUT", title: "Define the market", copy: "Choose a search mode, enter useful filters, and select or create the list where returned records should live." },
  { number: "02", label: "PROVIDER WORK", title: "Search for records", copy: "PipeLeads sends the criteria to the configured data provider and stores the supported fields it returns." },
  { number: "03", label: "YOUR REVIEW", title: "Inspect and organize", copy: "Review each record, optional enrichment result, label, search history entry, and fit explanation before acting." },
  { number: "04", label: "HANDOFF", title: "Export what matters", copy: "Download an approved list as CSV or configure a webhook handoff. Native message sending is not assumed." },
]

const faqs = [
  { question: "What is PipeLeads LeadFinder?", answer: "It is a prospect discovery workspace for searching five record types, organizing results into lists, optionally enriching selected records, scoring fit against business context, and preparing reviewable AI guidance." },
  { question: "Is every record complete, current, or verified?", answer: "No. Coverage, freshness, and enrichment availability depend on the configured provider and the specific record. PipeLeads shows what was returned so you can review it." },
  { question: "Does LeadFinder contact prospects automatically?", answer: "No native sending workflow has been established. AI actions produce drafts or guidance that you review and copy; webhook handoffs run only when you configure them." },
  { question: "How does lead scoring work?", answer: "PipeLeads compares a saved record with the business profile and knowledge sources you supplied, then returns a 0–100 fit score, label, reasons, a suggested angle or opener, and next-action guidance. It is not a conversion prediction." },
  { question: "Is LeadFinder the same as PipeLeads CRM?", answer: "No. LeadFinder discovers, enriches, scores, organizes, and exports prospect records. PipeLeads CRM is the separate product for managing sales relationships and deals." },
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
      "@type": "VideoObject",
      "@id": "https://pipeleads.ai/#video",
      name: VIDEO_TITLE,
      description: "PipeLeads LeadFinder: Find, Score & Convert the Right Prospects",
      thumbnailUrl: ["https://pipeleads.ai/images/videos/pipeleads-leadfinder-poster.jpg"],
      uploadDate: "2026-09-28",
      duration: "PT1M56S",
      embedUrl: `https://www.youtube.com/embed/${YOUTUBE_ID}`,
      contentUrl: `https://youtu.be/${YOUTUBE_ID}`,
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
    },
  ],
}

type Shot = { file: string; title: string; text: string; alt: string }

const collectionShots: Shot[] = [
  { file: "agent-approval-cards", title: "Lead Finder agent", text: "The agent shows the search and its cost. Nothing runs until you approve.", alt: "Lead Finder agent side panel beside the lead table, showing a conversation about 10 plumbers in Miami and a Search approval card with criteria chips, target list and an estimated cost of up to 250 credits" },
  { file: "agent-front-door", title: "New search", text: "Describe who you want to find in one sentence.", alt: "PipeLeads Lead Finder New Search page with a large 'Who do you want to find?' prompt box, quick chips for Find people, local businesses, companies and creators, three suggested prompts, and a Recent Conversations list" },
  { file: "ai-agents", title: "AI agents", text: "Schedule agents that search and score leads on their own.", alt: "AI Agent page with twelve agent cards in Active, Paused and Draft states, each showing its action, connection and lead counts, daily, weekly, monthly or manual schedule, and pause, play and delete controls, with an All Statuses filter and a New AI Agent button" },
]

const rowShots = {
  results: { file: "results-table", title: "Lead results table", text: "Every lead scored, explained and one click from your CRM.", alt: "Lead list table of Florida salons with avatars, addresses, AI lead scores with Warm badges and reasons, AI menu, Send to PipeLeads and MailBaser buttons, business phone numbers and company links" },
  modes: { file: "search-type-cards", title: "Search type cards", text: "Five ways to find leads, with the price shown up front.", alt: "Five search type rows: People, Local, Company, Domain and Influencer search, each listing the data you get, a clickable example prompt, and a per-result credit price" },
  bulk: { file: "bulk-actions", title: "Bulk actions bar", text: "Select every lead and enrich, label or send them in one move.", alt: "All 22 leads selected with a bulk bar offering Email, Phone and Score enrichment, label apply, copy or move to list, Remove, ScaleMail CSV, and send to PipeLeads or MailBaser" },
  ai: { file: "lead-ai-menu", title: "AI menu for each lead", text: "Research, messages and subject lines for any lead, on demand.", alt: "AI dropdown opened on a lead row listing Similar People, Direct Message, Summary, Subject Lines, Email Intro, Custom Prompt and Prompt Library" },
  handoff: { file: "send-to-pipeleads-mailbaser", title: "Send a lead to PipeLeads CRM", text: "Push a lead into your CRM as a contact, with a deal if you want one.", alt: "Add to PipeLeads popover on a salon lead with an Also create a deal toggle, a tags field and Cancel / Add lead buttons" },
} satisfies Record<string, Shot>

const ROW_SIZES = "(min-width: 1100px) 700px, (min-width: 768px) 50vw, 100vw"
const COLLECTION_MAIN_SIZES = "(min-width: 1180px) 860px, (min-width: 768px) 68vw, 100vw"
const COLLECTION_SIDE_SIZES = "(min-width: 1180px) 350px, (min-width: 768px) 27vw, (min-width: 480px) 50vw, 100vw"

function ShotFigure({ shot, className, sizes, label }: { shot: Shot; className?: string; sizes: string; label?: string }) {
  const base = `/images/atlas/pipeleads-leadfinder/${shot.file}`
  return (
    <figure className={className ? `shot ${className}` : "shot"} data-shot data-shot-group="pipeleads-leadfinder" data-shot-title={shot.title} data-shot-text={shot.text}>
      <button className="shot-frame" type="button" aria-label={`View larger: ${shot.title}`}>
        <span className="shot-chrome" aria-hidden="true"><i /><i /><i /></span>
        {/* eslint-disable-next-line @next/next/no-img-element -- published static screenshots with an explicit srcset */}
        <img
          src={`${base}-768.webp`}
          srcSet={`${base}-768.webp 768w, ${base}.webp 1536w`}
          sizes={sizes}
          width={1536}
          height={784}
          alt={shot.alt}
          loading="lazy"
          decoding="async"
          data-full={`${base}.webp`}
        />
        <span className="shot-glint" aria-hidden="true" />
      </button>
      {label ? <p className="fr-collection-label">{label}</p> : null}
    </figure>
  )
}

export default function LandingPage() {
  return (
    <div className="pl-site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <LeadFinderHeader />

      <main>
        <div className="pl-marketing">
          <section className="pl-hero pl-hero--video">
            <div className="pl-shell pl-hero__grid pl-hero__grid--video">
              <div className="pl-hero__copy pl-hero__lead">
                <span className="pl-eyebrow"><i /> PIPELEADS · PROSPECT DISCOVERY</span>
                <h1>Find the right <span>prospects.</span> Keep the reasoning.</h1>
                <p className="pl-hero__definition">Search people, local businesses, companies, domains, or influencers. Keep the criteria, returned records, business context, and next-action guidance in one reviewable workspace.</p>
              </div>

              <div
                className="video-card video-card--hero"
                id="product-video"
                data-video-card
                data-youtube-id={YOUTUBE_ID}
                data-title={VIDEO_TITLE}
                data-duration={VIDEO_DURATION}
                style={{ "--vc-plate": "var(--pl-coral)" } as CSSProperties}
              >
                <button className="video-card-poster" type="button" aria-label={`Play video: ${VIDEO_TITLE} (${VIDEO_DURATION})`}>
                  <picture>
                    <source
                      type="image/webp"
                      srcSet="/images/videos/pipeleads-leadfinder-poster-640.webp 640w, /images/videos/pipeleads-leadfinder-poster.webp 1280w"
                      sizes="(min-width: 1180px) 680px, (min-width: 941px) 54vw, 100vw"
                    />
                    <img src="/images/videos/pipeleads-leadfinder-poster.jpg" width={1280} height={720} alt="" loading="eager" fetchPriority="high" decoding="async" />
                  </picture>
                  <span className="video-card-glint" aria-hidden="true" />
                  <span className="video-card-play" aria-hidden="true" />
                  <span className="video-card-badge" aria-hidden="true">{VIDEO_DURATION}</span>
                </button>
                <p className="video-card-hero-label">Product video · {VIDEO_DURATION}</p>
              </div>

              <div className="pl-hero__copy pl-hero__more">
                <p className="pl-hero__mechanism">Choose the market. Save the records worth examining. Enrich selected fields when available, score fit against your context, and decide what moves forward.</p>
                <div className="pl-button-row">
                  <a className="pl-button pl-button--coral" href={LEADFINDER_SEARCH_URL}>Open LeadFinder <ArrowIcon /></a>
                  <a className="pl-button pl-button--outline" href="#how-it-works">See the workflow</a>
                </div>
                <p className="pl-truth-note"><span>✓</span>Source coverage, freshness, and enrichment availability vary by provider and record.</p>
              </div>
            </div>
          </section>

          <section className="fr-collection-section" id="inside-pipeleads-leadfinder" aria-labelledby="pipeleads-leadfinder-collection-title">
            <div className="pl-shell">
              <div className="fr-collection-head">
                <span className="pl-section-label">INSIDE PIPELEADS LEADFINDER</span>
                <h2 className="fr-collection-title" id="pipeleads-leadfinder-collection-title">See PipeLeads LeadFinder in action.</h2>
                <p className="fr-collection-text">Real screens from the workspace: approve each search before it runs, start a new search in one sentence, and schedule AI agents that keep your lists growing.</p>
              </div>
              <div className="fr-collection fr-plate-mint">
                <ShotFigure shot={collectionShots[0]} className="fr-collection-main" sizes={COLLECTION_MAIN_SIZES} label="Lead Finder agent" />
                <ShotFigure shot={collectionShots[1]} sizes={COLLECTION_SIDE_SIZES} label="New search" />
                <ShotFigure shot={collectionShots[2]} sizes={COLLECTION_SIDE_SIZES} label="AI agents" />
              </div>
              <div className="fr-collection-aside"><SearchWorkspacePreview /></div>
            </div>
          </section>

          <section className="pl-facts" aria-label="PipeLeads LeadFinder facts">
            <div className="pl-shell pl-facts__grid">
              <div><strong>5</strong><span>distinct search modes</span></div>
              <div><strong>4</strong><span>knowledge-source types</span></div>
              <div><strong>0–100</strong><span>explainable fit guidance</span></div>
              <div><strong>CSV</strong><span>approved-list export</span></div>
            </div>
          </section>

          <section className="pl-section pl-problem">
            <div className="pl-shell">
              <div className="fr fr--image-right fr-plate-lilac">
                <div className="fr-copy"><span className="pl-section-label">THE LIST IS ONLY THE START</span><h2>A mystery spreadsheet is not a prospecting strategy.</h2><p>Rows without criteria, context, or source boundaries leave the next person guessing. PipeLeads keeps the search, the record, and the reasoning close enough to review.</p></div>
                <ShotFigure shot={rowShots.results} className="fr-media" sizes={ROW_SIZES} />
              </div>
              <div className="pl-contrast-cards pl-contrast-cards--pair pl-row-after"><article><small>DISCONNECTED PROSPECTING</small><strong>Search → export → lose the criteria → guess what matters</strong><p>The file travels, but the reasoning behind it disappears.</p></article><article><small>PIPELEADS LEADFINDER</small><strong>Define → search → review → organize → hand off</strong><p>You control what is enriched, scored, drafted, exported, or sent to a webhook.</p></article></div>
            </div>
          </section>

          <section id="features" className="pl-section pl-modes">
            <div className="pl-shell">
              <div className="fr fr--image-left fr-plate-paper">
                <ShotFigure shot={rowShots.modes} className="fr-media" sizes={ROW_SIZES} />
                <div className="fr-copy"><span className="pl-section-label">FIVE WAYS INTO THE MARKET</span><h2>Start with the record type the job actually needs.</h2><p>Each mode has its own criteria and provider mapping. Returned fields depend on the source and target—not a universal completeness promise.</p></div>
              </div>
              <div className="pl-mode-grid pl-row-after">
                {searchModes.map((mode) => {
                  const ModeIcon = modeIcons[mode.tone]
                  return (
                    <article key={mode.label} data-tone={mode.tone}>
                      <div><span>{mode.number}</span><ModeIcon /></div>
                      <h3>{mode.label}</h3>
                      <p>{mode.copy}</p>
                      <a href={LEADFINDER_SEARCH_URL}>Open search <ArrowIcon /></a>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>

          <section id="how-it-works" className="pl-section pl-workflow">
            <div className="pl-shell">
              <div className="fr fr--image-right fr-plate-lime">
                <div className="fr-copy"><span className="pl-section-label">INPUT → WORK → OUTPUT → REVIEW</span><h2>Know what the software does—and what stays yours.</h2><p>Search is provider-backed. AI does not invent the source record, and a score does not turn into a promised outcome.</p></div>
                <ShotFigure shot={rowShots.bulk} className="fr-media" sizes={ROW_SIZES} />
              </div>
              <div className="pl-workflow-grid pl-row-after">{workflow.map((step) => <article key={step.number}><div><span>{step.number}</span><small>{step.label}</small></div><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
            </div>
          </section>

          <section className="pl-section pl-intelligence">
            <div className="pl-shell">
              <div className="fr fr--image-left fr-plate-paper">
                <ShotFigure shot={rowShots.ai} className="fr-media" sizes={ROW_SIZES} />
                <div className="fr-copy">
                  <span className="pl-section-label">BUSINESS-CONTEXT INTELLIGENCE</span>
                  <h2>Give the guidance something real to compare against.</h2>
                  <p>Build a business profile, then add Website, pasted Text, Q&amp;A, or PDF sources. PipeLeads combines that approved context with a selected record to explain fit or prepare the chosen draft.</p>
                  <div className="pl-output-list">
                    <article><SparkIcon /><div><strong>Fit guidance</strong><span>Score, label, reasons, angle, opener, next action</span></div></article>
                    <article><DownloadIcon /><div><strong>Reviewable outputs</strong><span>Summary, draft, custom prompt, saved template, or CSV</span></div></article>
                    <article><WebhookIcon /><div><strong>Controlled handoff</strong><span>Export or send through a webhook you configure</span></div></article>
                  </div>
                </div>
              </div>
              <div className="pl-context-aside"><KnowledgeBoard /></div>
            </div>
          </section>

          <section className="pl-section pl-separation">
            <div className="pl-shell">
              <div className="fr fr--image-right fr-plate-lilac">
                <div className="fr-copy">
                  <span className="pl-section-label">TWO PIPELEADS PRODUCTS</span>
                  <h2>LeadFinder discovers. CRM manages the relationship.</h2>
                  <p>This page is about prospect discovery, enrichment, fit guidance, organization, drafts, and handoff. Deal stages, activities, inboxes, and pipelines belong to the separate PipeLeads CRM.</p>
                  <div className="pl-product-links"><a href={LEADFINDER_SEARCH_URL}>Open LeadFinder <ArrowIcon /></a><a href={PIPELEADS_CRM_URL}>Open PipeLeads CRM <ArrowIcon /></a></div>
                </div>
                <ShotFigure shot={rowShots.handoff} className="fr-media" sizes={ROW_SIZES} />
              </div>
            </div>
          </section>

          <section id="faq" className="pl-section pl-faq">
            <div className="pl-shell pl-faq__grid"><div><span className="pl-section-label">STRAIGHT ANSWERS</span><h2>Before you run the first search.</h2></div><div className="pl-faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div></div>
          </section>

          <section className="atlas-cta-band" id="feature-atlas" aria-labelledby="atlas-cta-title">
            <div className="pl-shell">
              <div className="atlas-cta">
                <div className="atlas-cta-copy">
                  <p className="atlas-cta-kicker"><span aria-hidden="true" />Feature Atlas · PipeLeads LeadFinder</p>
                  <h2 id="atlas-cta-title">See every PipeLeads LeadFinder feature—and <em>what each one gets you.</em></h2>
                  <p>Browse every PipeLeads LeadFinder feature, see exactly where it lives in the app, and find the one that moves your business forward today.</p>
                  <div className="atlas-cta-actions"><a className="pl-button" href={ATLAS_URL}>Explore the PipeLeads LeadFinder atlas <span aria-hidden="true">→</span></a><small>65 features across 8 areas</small></div>
                </div>
                <ul className="atlas-cta-peek" aria-label="A few features from the Atlas">
                  <li><a href={`${ATLAS_URL}agent-front-door/`}><small>&quot;Who do you want to find?&quot; front door</small><b>You go from idea to lead search in one sentence.</b></a></li>
                  <li><a href={`${ATLAS_URL}agent-front-door/agent-approval-cards/`}><small>Approval cards</small><b>You stay in charge of every credit.</b></a></li>
                  <li><a href={`${ATLAS_URL}agent-front-door/agent-results-card/`}><small>Results card with one-tap follow-ups</small><b>A search turns into a scored, enriched, CRM-ready list in a few taps.</b></a></li>
                </ul>
              </div>
            </div>
          </section>

          <section className="pl-final-cta">
            <div className="pl-shell pl-final-cta__inner"><div><span className="pl-section-label">THE SCALE.GG FAMILY</span><h2>One membership. A focused app for every marketing job.</h2></div><div><p>PipeLeads LeadFinder is included in Scale.gg—the AI-powered marketing suite for planning, creating, publishing, selling, and supporting your business.</p><div className="pl-button-row"><a className="pl-button pl-button--coral" href="https://scale.gg/">Explore Scale.gg <ArrowIcon /></a><a className="pl-button pl-button--light" href="https://app.scaleplus.gg/apps">See all apps</a></div></div></div>
          </section>
        </div>
      </main>

      <footer className="pl-footer">
        <div className="pl-shell pl-footer__top">
          <div className="pl-footer__brand"><Link className="pl-brand" href="/"><PipeLeadsMark /><span>PipeLeads <b>LeadFinder</b></span></Link><p>Prospect discovery, optional enrichment, business-context guidance, and a reviewable handoff.</p><span>Part of the Scale.gg product family</span></div>
          <div className="pl-footer__links">
            <div><strong>Product</strong><Link href="/#features">Search modes</Link><Link href="/#how-it-works">How it works</Link><a href={ATLAS_URL}>Feature Atlas</a><a href={LEADFINDER_SEARCH_URL}>Open LeadFinder</a></div>
            <div><strong>PipeLeads</strong><a href={LEADFINDER_APP_URL}>LeadFinder app</a><a href={PIPELEADS_CRM_URL}>CRM app</a><a href="https://scale.gg/pipeleads/">Compare both products</a></div>
            <div><strong>Scale.gg family</strong><a href="https://scale.gg/">Scale.gg</a><a href="https://app.scaleplus.gg/apps">Explore all apps</a><a href="https://scale.gg/pricing/">Pricing</a></div>
          </div>
        </div>
        <div className="pl-shell pl-footer__bottom"><span>© {new Date().getFullYear()} PipeLeads LeadFinder — A Scale.gg product</span><div><a href="https://scale.gg/privacy-policy/">Privacy</a><a href="https://scale.gg/terms-of-service/">Terms</a></div></div>
      </footer>

      <Script src={`/marketing/shots.js?v=${SCRIPT_VERSION}`} strategy="afterInteractive" />
      <Script src={`/marketing/video-card.js?v=${SCRIPT_VERSION}`} strategy="afterInteractive" />
    </div>
  )
}
