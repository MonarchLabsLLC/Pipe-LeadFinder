"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AgentButton } from "@/components/focused-agent/agent-panel"
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb"
import { HeaderSearch } from "@/components/layout/header-search"
import { HeaderThemeToggle } from "@/components/layout/header-theme-toggle"
import { HeaderUserMenu } from "@/components/layout/header-user-menu"
import { ScalePlusAppLauncher } from "@/components/layout/scaleplus-app-launcher"
import { MobileCreditsChip } from "@/components/layout/sidebar-account"

/**
 * Lead Finder's app header. Same height, border, spacing and controls as
 * PipeLeads Suite's app header; Lead Finder adds its Agent button and has no
 * notification centre, so there is no bell.
 */
export function Topbar() {
  return (
    <>
      <ScalePlusAppLauncher />
      <header className="flex h-16 shrink-0 items-center gap-1 border-b bg-background px-3 sm:gap-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {/* The ScalePlus launcher draws its "Apps" pill just right of this
              anchor and opens its menu down and to the right, so it sits at
              the left edge, where the menu has the whole page to open into.
              Same placement as PipeLeads Suite. */}
          <div className="mr-28 flex items-center" data-scaleplus-launcher-anchor="app-shell">
            <SidebarTrigger className="-ml-1" />
          </div>
          {/* Below sm the page heading carries the context; the header row has
              no room for a crumb once the launcher pill is reserved. */}
          <Separator orientation="vertical" className="mr-1 hidden h-4 sm:mr-2 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <AppBreadcrumb />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Phones only: the sidebar (and its account row) is a drawer there. */}
          <MobileCreditsChip />
          <HeaderSearch />

          <AgentButton />
          <HeaderThemeToggle />
          <HeaderUserMenu />
        </div>
      </header>
    </>
  )
}
