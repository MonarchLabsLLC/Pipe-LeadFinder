import Link from "next/link"

export const LEADFINDER_APP_URL = "https://app.pipeleads.ai"
export const LEADFINDER_SEARCH_URL = "https://app.pipeleads.ai/lead-search/new-search"
export const PIPELEADS_CRM_URL = "https://crm.pipeleads.ai"

export function PipeLeadsMark() {
  return (
    <span className="pl-mark" aria-hidden="true">
      <svg viewBox="0 0 34 34">
        <path d="M8 9h10c5 0 5 6 0 6h-4c-4 0-4 5 0 5h6c5 0 5 6 0 6H10" />
        <circle cx="8" cy="9" r="2.2" />
        <circle cx="24" cy="26" r="2.2" />
      </svg>
    </span>
  )
}

export function LeadFinderHeader() {
  return (
    <header className="pl-header">
      <div className="pl-shell pl-header__inner">
        <div className="pl-brand-lockup">
          <Link className="pl-brand" href="/">
            <PipeLeadsMark />
            <span>PipeLeads <b>LeadFinder</b></span>
          </Link>
          <a className="pl-brand-family" href="https://scale.gg">A SCALE.GG PRODUCT</a>
        </div>

        <nav className="pl-nav" aria-label="Primary navigation">
          <Link href="/#features">Search modes</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#faq">FAQ</Link>
          <a href={PIPELEADS_CRM_URL}>PipeLeads CRM</a>
        </nav>

        <div className="pl-header__actions">
          <a className="pl-button pl-button--black pl-button--small" href={LEADFINDER_SEARCH_URL}>Open LeadFinder</a>
        </div>
      </div>
    </header>
  )
}
