"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Command, CornerDownLeft, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  adminMenu,
  aiToolsMenu,
  appItems,
  isAdminUser,
  leadSearchItems,
  resourceItems,
  type NavItem,
} from "@/components/layout/nav-config"

type Destination = NavItem & { group: string; external: boolean }

/**
 * The header's search pill, drawn like PipeLeads Suite's, and the small jump
 * palette behind it (⌘K / Ctrl+K). It jumps between Lead Finder's pages and
 * the other PipeLeads apps.
 */
export function HeaderSearch() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden items-center gap-2 text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden="true" className="size-4" />
        <span className="text-sm">Search...</span>
        <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
          <Command aria-hidden="true" className="size-3" />K
        </kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open the command palette"
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden="true" className="size-4" />
      </Button>

      <JumpPalette open={open} onOpenChange={setOpen} />
    </>
  )
}

function useDestinations(): Destination[] {
  const { data: session } = useSession()
  const showAdmin = isAdminUser(session?.user?.email, session?.user?.role)

  return React.useMemo(() => {
    const local = (group: string, items: NavItem[]) =>
      items.map((item) => ({ ...item, group, external: false }))
    return [
      ...local("Lead Search", leadSearchItems),
      ...local("AI Tools", aiToolsMenu.items),
      ...(showAdmin ? local("Admin", adminMenu.items) : []),
      ...local("Resources", resourceItems),
      ...appItems
        .filter((app) => !app.current)
        .map((app) => ({ ...app, group: "Apps", external: true })),
    ]
  }, [showAdmin])
}

function JumpPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const destinations = useDestinations()
  const [query, setQuery] = React.useState("")
  const [cursor, setCursor] = React.useState(0)

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return destinations
    return destinations.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) || item.group.toLowerCase().includes(needle)
    )
  }, [destinations, query])

  const close = (value: boolean) => {
    onOpenChange(value)
    if (!value) {
      setQuery("")
      setCursor(0)
    }
  }

  const go = (item: Destination | undefined) => {
    if (!item) return
    close(false)
    if (item.external) window.location.assign(item.url)
    else router.push(item.url)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search Lead Finder</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a page in Lead Finder or another PipeLeads app.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setCursor((value) => Math.min(value + 1, results.length - 1))
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setCursor((value) => Math.max(value - 1, 0))
              } else if (event.key === "Enter") {
                event.preventDefault()
                go(results[cursor])
              }
            }}
            placeholder="Type a page or app name…"
            aria-label="Search pages"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No results.</li>
          ) : (
            results.map((item, index) => (
              <li
                key={`${item.group}-${item.url}`}
                role="option"
                aria-selected={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(item)}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  index === cursor && "bg-accent text-accent-foreground"
                )}
              >
                <item.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.group}</span>
                {index === cursor ? (
                  <CornerDownLeft aria-hidden="true" className="size-3.5 text-muted-foreground" />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
