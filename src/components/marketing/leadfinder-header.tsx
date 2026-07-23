"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Menu, X } from "lucide-react"

export function PipeLeadsMark() {
  return (
    <span className="pl-mark" aria-hidden="true">
      <svg viewBox="0 0 44 44">
        <circle cx="17" cy="17" r="7" />
        <path d="m22 22 7 7M29 29h7M29 29v7" />
        <circle cx="35" cy="35" r="2.5" />
      </svg>
    </span>
  )
}

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#ai-tools", label: "AI Tools" },
]

export function LeadFinderHeader() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  return (
    <header className="pl-header">
      <div className="pl-shell pl-header__inner">
        <Link className="pl-brand" href="/" aria-label="PipeLeads LeadFinder home">
          <PipeLeadsMark />
          <span>PipeLeads <b>LeadFinder</b></span>
        </Link>

        <nav className="pl-nav" aria-label="Primary navigation">
          {navItems.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
        </nav>

        <div className="pl-header__actions">
          <a className="pl-family-link" href="https://scale.gg/pipeleads/">Compare PipeLeads</a>
          <a className="pl-button pl-button--small pl-button--outline" href="/lead-search/new-search">Sign In</a>
          <a className="pl-button pl-button--small pl-button--black" href="/lead-search/new-search">
            Open LeadFinder <ArrowRight aria-hidden="true" />
          </a>
        </div>

        <button
          ref={buttonRef}
          className="pl-menu-button"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="pl-mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <div id="pl-mobile-menu" className={`pl-mobile-nav${open ? " is-open" : ""}`} aria-hidden={!open} inert={!open}>
        <nav aria-label="Mobile navigation">
          {navItems.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
          <a href="https://scale.gg/pipeleads/">Compare PipeLeads</a>
          <a href="/lead-search/new-search">Sign In</a>
          <a className="pl-button pl-button--black" href="/lead-search/new-search">Open LeadFinder <ArrowRight /></a>
        </nav>
      </div>
    </header>
  )
}
