"use client"

import { usePathname } from "next/navigation"
import { Sun, Moon, Flame, Sparkles } from "lucide-react"

import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

const routeTitles: Record<string, string> = {
  "/lead-search/new-search": "New Search",
  "/lead-search/saved-lists": "Saved Lists",
  "/lead-search/custom-labels": "Custom Labels",
  "/ai/knowledge-base": "Knowledge Base",
  "/ai/ai-assistant": "AI Assistant",
  "/ai/ai-agent": "AI Agent",
  "/admin/business-account": "Business Account",
  "/admin/packages": "Packages",
  "/admin/stripe": "Stripe",
  "/admin/subscriptions": "Subscriptions",
  "/admin/custom-links": "Custom Links",
  "/admin/smtp": "SMTP",
  "/admin/webhooks": "Webhooks",
  "/admin/email-templates": "Email Templates",
  "/admin/training-content": "Training Content",
  "/admin/partners": "Partners",
  "/resources/support": "Support",
  "/resources/tutorials": "Tutorials",
  "/resources/documentation": "Documentation",
}

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname]

  // Try matching prefix for dynamic routes
  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route + "/")) return title
  }

  return "Dashboard"
}

export function Topbar() {
  const pathname = usePathname()
  const { theme, colorMode, setTheme, toggleColorMode } = useTheme()

  const title = getPageTitle(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant={theme === "amber" ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme("amber")}
          title="Warm theme"
        >
          <Flame className="h-4 w-4" />
        </Button>
        <Button
          variant={theme === "indigo" ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme("indigo")}
          title="Cool theme"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleColorMode}
          title={colorMode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {colorMode === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  )
}
