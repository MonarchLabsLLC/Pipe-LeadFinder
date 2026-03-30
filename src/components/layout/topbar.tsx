"use client"

import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Sun, Moon, Flame, Sparkles, User, BookOpen, Palette, LogOut, Check } from "lucide-react"

import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route + "/")) return title
  }
  return "Dashboard"
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.split(" ")
    return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return "U"
}

export function Topbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, colorMode, setTheme, toggleColorMode } = useTheme()

  const title = getPageTitle(pathname)
  const initials = getInitials(session?.user?.name, session?.user?.email)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{session?.user?.name || "User"}</span>
                <span className="text-xs text-muted-foreground">{session?.user?.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpen className="mr-2 h-4 w-4" />
              User Guide
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="mr-2 h-4 w-4" />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("amber")}>
                  <Flame className="mr-2 h-4 w-4" />
                  Warm
                  {theme === "amber" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("indigo")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Cool
                  {theme === "indigo" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleColorMode}>
                  {colorMode === "light" ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  {colorMode === "light" ? "Dark Mode" : "Light Mode"}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
