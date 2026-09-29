import type { ReactNode } from "react"

/* Inline icons used by the public pipeleads.ai page (same shapes as production). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const ArrowIcon = () => <Icon><path d="M5 12h14m-5-5 5 5-5 5" /></Icon>
export const SparkIcon = () => <Icon><path d="m12 3 1.2 3.4L16.5 8l-3.3 1.5L12 13l-1.2-3.5L7.5 8l3.3-1.6L12 3ZM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14ZM5 13l.7 1.8 1.8.7-1.8.7L5 18l-.7-1.8-1.8-.7 1.8-.7L5 13Z" /></Icon>
export const PersonIcon = () => <Icon><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" /></Icon>
export const PinIcon = () => <Icon><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.3" /></Icon>
export const BuildingIcon = () => <Icon><path d="M4 21V5l8-3v19M12 8h8v13M8 7v1M8 11v1M8 15v1M16 12v1M16 16v1M2 21h20" /></Icon>
export const GlobeIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></Icon>
export const StarIcon = () => <Icon><path d="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2-4.5-4.4 6.3-.9L12 2.8Z" /></Icon>
export const DownloadIcon = () => <Icon><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16" /></Icon>
export const WebhookIcon = () => <Icon><path d="M7 9a4 4 0 1 1 7-2l-4 7M17 15a4 4 0 1 1-5 6l-5-7M8 19a4 4 0 1 1-2-7h8" /></Icon>

export const modeIcons = { coral: PersonIcon, mint: PinIcon, lilac: BuildingIcon, lime: GlobeIcon, sky: StarIcon } as const

const previewModes = [
  { label: "People", tone: "coral" },
  { label: "Local", tone: "mint" },
  { label: "Company", tone: "lilac" },
  { label: "Domain", tone: "lime" },
  { label: "Influencer", tone: "sky" },
] as const

export function SearchWorkspacePreview() {
  return (
    <div className="pl-window" aria-label="Illustration of the LeadFinder search workspace">
      <div className="pl-window__bar"><span><i /><i /><i /></span><strong>NEW PROSPECT SEARCH</strong><em>LIVE</em></div>
      <div className="pl-search-preview">
        <aside><span><SparkIcon /></span><i /><i /><i /></aside>
        <div className="pl-search-preview__main">
          <div className="pl-preview-title"><div><small>SELECT A SEARCH TYPE</small><b>Who are you looking for?</b></div><span>5 modes</span></div>
          <div className="pl-preview-modes">
            {previewModes.map((mode, index) => {
              const ModeIcon = modeIcons[mode.tone]
              return (
                <div key={mode.label} className={index === 0 ? "is-selected" : ""}>
                  <span data-tone={mode.tone}><ModeIcon /></span><b>{mode.label}</b><small>{index === 0 ? "Selected" : "Choose"}</small>
                </div>
              )
            })}
          </div>
          <div className="pl-preview-form">
            <label><small>ROLE OR TITLE</small><strong>VP of Marketing</strong></label>
            <label><small>LOCATION</small><strong>United States</strong></label>
            <label><small>LIST</small><strong>Q3 prospects</strong></label>
            <span>Search provider records <ArrowIcon /></span>
          </div>
          <p><i />Criteria and returned fields stay together for review.</p>
        </div>
      </div>
    </div>
  )
}

const knowledgeSources = [
  { tag: "WEB", title: "Company website", copy: "Approved pages and positioning" },
  { tag: "TXT", title: "Ideal customer profile", copy: "Pasted audience and qualification notes" },
  { tag: "Q+A", title: "Sales questions", copy: "Answers your team uses to assess fit" },
  { tag: "PDF", title: "Offer brief", copy: "Uploaded product and market context" },
]

export function KnowledgeBoard() {
  return (
    <div className="pl-context-board">
      <div className="pl-context-board__head"><span>KNOWLEDGE SOURCES</span><em>4 connected</em></div>
      <div className="pl-context-board__sources">
        {knowledgeSources.map((source) => (
          <article key={source.tag}><span>{source.tag}</span><div><strong>{source.title}</strong><small>{source.copy}</small></div><b>READY</b></article>
        ))}
      </div>
      <div className="pl-score-card"><div><small>FIT GUIDANCE</small><strong>84</strong></div><p>Strong role and market match. Review the reasons before moving this record forward.</p></div>
    </div>
  )
}
