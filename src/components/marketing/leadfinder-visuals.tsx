import {
  ArrowDown,
  Building2,
  Check,
  Database,
  FileOutput,
  FileText,
  Globe,
  MapPin,
  MessageSquareText,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react"

const modes = [
  { label: "People", icon: Users, tone: "coral" },
  { label: "Local", icon: MapPin, tone: "mint" },
  { label: "Company", icon: Building2, tone: "lilac" },
  { label: "Domain", icon: Globe, tone: "lime" },
  { label: "Influencer", icon: Star, tone: "peach" },
]

export function SearchWorkspacePreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`pl-product-window${compact ? " pl-product-window--compact" : ""}`} role="img" aria-label="Illustration of the PipeLeads five-mode search workspace">
      <div className="pl-window-bar"><span><i /><i /><i /></span><strong>PipeLeads · New Search</strong><em>DEMO WORKSPACE</em></div>
      <div className="pl-search-preview">
        <aside><span><Search /></span><i /><i /><i /><i /></aside>
        <div className="pl-search-preview__main">
          <div className="pl-search-preview__head"><div><small>NEW SEARCH</small><b>What are you searching for?</b></div><span>LeadFinder</span></div>
          <div className="pl-mode-row">
            {modes.map(({ icon: Icon, ...mode }, index) => (
              <article className={index === 0 ? "is-selected" : ""} key={mode.label} data-tone={mode.tone}>
                <span><Icon /></span><b>{mode.label}</b><small>{index === 0 ? "Selected" : "Search mode"}</small>
              </article>
            ))}
          </div>
          <div className="pl-search-form-demo">
            <div><small>DESCRIPTION</small><strong>Revenue operations leaders</strong></div>
            <div><small>LOCATION</small><strong>United States</strong></div>
            <div><small>RESULTS</small><strong>10 records</strong></div>
            <span className="pl-search-form-demo__action">Review search <Search /></span>
          </div>
          <p><i /> Search coverage and returned fields vary by source and record.</p>
        </div>
      </div>
    </div>
  )
}

const records = [
  { initials: "AC", name: "Avery Chen", role: "Growth lead · Example Studio", score: "86", label: "Hot", angle: "Expansion planning", status: "Email available" },
  { initials: "ML", name: "Morgan Lee", role: "Founder · Sample Works", score: "72", label: "Warm", angle: "Manual reporting", status: "Review enrichment" },
  { initials: "JR", name: "Jordan Rivera", role: "Operations · Demo Company", score: "61", label: "Warm", angle: "Workflow clarity", status: "Source record only" },
]

export function SavedListPreview() {
  return (
    <div className="pl-list-preview" role="img" aria-label="Sanitized demonstration of a PipeLeads saved list with fit guidance">
      <div className="pl-window-bar"><span><i /><i /><i /></span><strong>PipeLeads · Saved List</strong><em>SANITIZED DEMO</em></div>
      <div className="pl-list-preview__body">
        <div className="pl-list-preview__title"><div><small>SAVED LIST</small><strong>Revenue operations shortlist</strong></div><div><span>Score leads</span><span>Export CSV</span></div></div>
        <div className="pl-list-table">
          <div className="pl-list-table__head"><span>Prospect record</span><span>Fit guidance</span><span>Availability</span></div>
          {records.map((record) => (
            <article key={record.name}>
              <div className="pl-record"><i>{record.initials}</i><span><b>{record.name}</b><small>{record.role}</small></span></div>
              <div className="pl-score"><b>{record.score}</b><span><strong>{record.label}</strong><small>{record.angle}</small></span></div>
              <div className="pl-availability"><i /><span>{record.status}</span></div>
            </article>
          ))}
        </div>
        <p><Sparkles /> Scores and next-action suggestions are guidance based on the record and configured business context.</p>
      </div>
    </div>
  )
}

export function KnowledgePreview() {
  return (
    <div className="pl-knowledge-preview" role="img" aria-label="Illustration of the PipeLeads business knowledge and draft review workflow">
      <div className="pl-window-bar"><span><i /><i /><i /></span><strong>PipeLeads · Knowledge Base</strong><em>USER-SUPPLIED CONTEXT</em></div>
      <div className="pl-knowledge-preview__body">
        <div className="pl-source-tabs"><span className="is-active"><Globe />Website</span><span><FileText />Text</span><span><MessageSquareText />Q&amp;A</span><span><FileOutput />PDF</span></div>
        <div className="pl-knowledge-grid">
          <div className="pl-profile-card"><small>BUSINESS PROFILE</small><strong>What do you sell?</strong><span>Define the offer and audience</span><strong>Who does it help?</strong><span>Give scoring a comparison point</span><strong>What does it do?</strong><span>Ground the suggested angle</span></div>
          <div className="pl-guidance-card"><div><Sparkles /><small>REVIEWABLE OUTPUT</small></div><strong>Fit guidance + outreach draft</strong><p>Record facts are combined with the business context for a score explanation, suggested opener, next action, or selected draft.</p><span><Check />Copy after review</span></div>
        </div>
      </div>
    </div>
  )
}

export function AgentPreview() {
  const steps = [
    { label: "Search", icon: Search },
    { label: "Optional enrich", icon: Database },
    { label: "AI draft", icon: Sparkles },
    { label: "Webhook", icon: FileOutput },
  ]
  return (
    <div className="pl-agent-preview" aria-label="Configured PipeLeads agent sequence">
      {steps.map(({ label, icon: Icon }, index) => <div key={label}><article><span>{String(index + 1).padStart(2, "0")}</span><Icon /><strong>{label}</strong></article>{index < steps.length - 1 && <ArrowDown />}</div>)}
    </div>
  )
}
