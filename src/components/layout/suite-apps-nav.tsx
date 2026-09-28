"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { appItems } from "@/components/layout/nav-config"

/** Same key in every PipeLeads-family app, so the choice follows the viewer. */
const STORAGE_KEY = "suite-apps-nav-open"

// Kept in memory too, so the toggle still works when storage is blocked.
let memoryOpen = true
const listeners = new Set<() => void>()

function readStoredOpen(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === null ? memoryOpen : stored !== "0"
  } catch {
    return memoryOpen
  }
}

function writeStoredOpen(open: boolean) {
  memoryOpen = open
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0")
  } catch {
    // Storage blocked (private window, policy): memory keeps the choice.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/** Expanded on the server and on first paint, then the viewer's choice. */
function useStoredOpen() {
  return React.useSyncExternalStore(subscribe, readStoredOpen, () => true)
}

/**
 * The suite's shared "Client Services Suite" section: all six apps in one
 * fixed order, expanded by default, the viewer's choice remembered. It reads
 * as one block: a dark title band over a lifted panel. Lead Finder is the
 * current app: bold with a dot, no fill (the fill marks the current page).
 */
export function SuiteAppsNav() {
  const { state, isMobile } = useSidebar()
  const open = useStoredOpen()

  // On the icon rail the header is hidden, so the six icons always show.
  const iconRail = state === "collapsed" && !isMobile

  return (
    <Collapsible
      open={open || iconRail}
      onOpenChange={writeStoredOpen}
      className="group/apps"
    >
      <SidebarGroup>
        {/* One rounded block: the band alone when collapsed, band over panel
            when open, and just the panel of icons on the icon rail. */}
        <div className="overflow-hidden rounded-lg bg-suite-nav-panel">
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger
              className="h-9 w-full cursor-pointer rounded-none bg-suite-nav-header px-3 text-sidebar-muted-foreground transition-[margin,opacity,color] hover:text-sidebar-foreground focus-visible:ring-inset"
            >
              Client Services Suite
              <ChevronDown
                aria-hidden
                className="ml-auto size-3.5! transition-transform duration-200 group-data-[state=closed]/apps:-rotate-90 motion-reduce:transition-none"
              />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
            <SidebarGroupContent className="p-1 group-data-[collapsible=icon]:p-0">
              <SidebarMenu>
                {appItems.map((app) => (
                  <SidebarMenuItem key={app.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={app.title}
                      className={cn(
                        "hover:bg-suite-nav-hover hover:text-sidebar-foreground active:bg-suite-nav-hover active:text-sidebar-foreground",
                        app.current && "font-semibold"
                      )}
                    >
                      {app.current ? (
                        <Link href={app.url} aria-current="true">
                          <app.icon className="size-4" />
                          <span>{app.title}</span>
                          <span
                            aria-hidden
                            className="ml-auto size-1.5 shrink-0 rounded-full bg-primary"
                          />
                        </Link>
                      ) : (
                        <a href={app.url}>
                          <app.icon className="size-4" />
                          <span>{app.title}</span>
                        </a>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </div>
      </SidebarGroup>
    </Collapsible>
  )
}
