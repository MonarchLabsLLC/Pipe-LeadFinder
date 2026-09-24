"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

import { cn } from "@/lib/utils"
import { LEAD_FINDER_HOME, pageTitles, sectionLabels } from "@/components/layout/nav-config"

type Crumb = { key: string; label: string; href: string | null }

/** Section > page, e.g. "Lead Search > Saved Lists". Pure, so it is testable. */
export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return []

  const crumbs: Crumb[] = []
  const section = sectionLabels[segments[0]]
  if (section) crumbs.push({ key: segments[0], label: section, href: null })

  const pageUrl = `/${segments.slice(0, 2).join("/")}`
  const title = pageTitles[pageUrl]
  if (title && segments.length >= 2) {
    crumbs.push({ key: pageUrl, label: title, href: segments.length > 2 ? pageUrl : null })
  }
  if (segments.length > 2 && title) {
    crumbs.push({ key: pathname, label: "Details", href: null })
  }
  return crumbs
}

/** The trail in the header, drawn like PipeLeads Suite's breadcrumb. */
export function AppBreadcrumb() {
  const pathname = usePathname()
  const crumbs = React.useMemo(() => buildCrumbs(pathname), [pathname])
  const lastIndex = crumbs.length - 1

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <li className="hidden lg:flex">
          <Link
            href={LEAD_FINDER_HOME}
            className="flex items-center transition-colors hover:text-foreground"
          >
            <Home aria-hidden="true" className="size-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {crumbs.map((crumb, index) => {
          const isLast = index === lastIndex
          return (
            <React.Fragment key={crumb.key}>
              <li aria-hidden="true" className="hidden items-center lg:flex">
                <ChevronRight className="size-4 text-muted-foreground/50" />
              </li>
              <li className={cn("min-w-0", !isLast && "hidden lg:block")}>
                {isLast ? (
                  <span aria-current="page" className="block truncate font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="block truncate transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="block truncate">{crumb.label}</span>
                )}
              </li>
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
