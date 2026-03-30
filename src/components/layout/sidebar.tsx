"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ChevronRight,
  Lightbulb,
  Radar,
  Search,
  Settings,
  HelpCircle,
  BookOpen,
  Bot,
  BrainCircuit,
  ListPlus,
  Bookmark,
  Tags,
  Building2,
  Package,
  CreditCard,
  Link2,
  Mail,
  Webhook,
  FileText,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

const navSections = [
  {
    label: "AI Tools",
    icon: Lightbulb,
    defaultOpen: false,
    items: [
      { label: "Knowledge Base", href: "/ai/knowledge-base", icon: BookOpen },
      { label: "AI Assistant", href: "/ai/ai-assistant", icon: Bot },
      { label: "AI Agent", href: "/ai/ai-agent", icon: BrainCircuit },
    ],
  },
  {
    label: "Lead Search",
    icon: Search,
    defaultOpen: true,
    items: [
      { label: "New Search", href: "/lead-search/new-search", icon: ListPlus },
      { label: "Saved Lists", href: "/lead-search/saved-lists", icon: Bookmark },
      { label: "Custom Labels", href: "/lead-search/custom-labels", icon: Tags },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    defaultOpen: false,
    items: [
      { label: "Business Account", href: "/admin/business-account", icon: Building2 },
      { label: "Packages", href: "/admin/packages", icon: Package },
      { label: "Stripe", href: "/admin/stripe", icon: CreditCard },
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
      { label: "Custom Links", href: "/admin/custom-links", icon: Link2 },
      { label: "SMTP", href: "/admin/smtp", icon: Mail },
      { label: "Webhooks", href: "/admin/webhooks", icon: Webhook },
      { label: "Email Templates", href: "/admin/email-templates", icon: FileText },
      { label: "Training Content", href: "/admin/training-content", icon: GraduationCap },
      { label: "Partners", href: "/admin/partners", icon: Users },
    ],
  },
  {
    label: "Resources",
    icon: HelpCircle,
    defaultOpen: false,
    items: [
      { label: "Support", href: "/resources/support", icon: HelpCircle },
      { label: "Tutorials", href: "/resources/tutorials", icon: GraduationCap },
      { label: "Documentation", href: "/resources/documentation", icon: FileText },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  const userName = session?.user?.name ?? "Admin User"
  const userEmail = session?.user?.email ?? "admin@GrooveDigital.com"
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/")
  }

  function isSectionActive(items: { href: string }[]) {
    return items.some((item) => isActive(item.href))
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radar className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">
                PipeLeads
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                LeadFinder AI
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {!isCollapsed && (
        <>
          <div className="px-4 pb-2">
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
                Credits Remaining
              </p>
              <p className="text-2xl font-bold text-sidebar-foreground">0</p>
              <a
                href="https://credits.scaleplus.gg/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-semibold no-underline"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              >
                <Wallet className="h-3.5 w-3.5" style={{ color: '#1a1a1a' }} />
                <span style={{ color: '#1a1a1a' }}>Credit Wallet</span>
              </a>
            </div>
          </div>
          <Separator className="bg-sidebar-border" />
        </>
      )}

      <SidebarContent>
        <ScrollArea className="flex-1">
          {navSections.map((section) => {
            const sectionActive = isSectionActive(section.items)
            return (
              <Collapsible
                key={section.label}
                defaultOpen={section.defaultOpen || sectionActive}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                      <section.icon className="h-4 w-4" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{section.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </>
                      )}
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {section.items.map((item) => {
                          const active = isActive(item.href)
                          return (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton
                                asChild
                                isActive={active}
                                tooltip={item.label}
                              >
                                <Link href={item.href}>
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          )
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )
          })}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="bg-sidebar-border" />
        <div className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {userName}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {userEmail}
                </span>
              </div>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
