import {
  BarChart3,
  BookOpen,
  Bookmark,
  Bot,
  BrainCircuit,
  Building2,
  CreditCard,
  FileText,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Link2,
  ListPlus,
  Mail,
  Package,
  Search,
  Settings,
  Tags,
  Webhook,
  type LucideIcon,
} from "lucide-react"

/**
 * Where PipeLeads Suite (the CRM and ProjectBaser) lives. The sidebar's Apps
 * group links into it in the same tab, exactly as the Suite links to Lead
 * Finder, so switching apps feels like one product.
 */
export const PIPELEADS_SUITE_URL = (
  process.env.NEXT_PUBLIC_PIPELEADS_SUITE_URL || "https://go.pipeleads.ai"
).replace(/\/+$/, "")

/** Lead Finder's own home, used by the header block and the Apps group. */
export const LEAD_FINDER_HOME = "/lead-search/new-search"

export type NavItem = { title: string; url: string; icon: LucideIcon }

export type AppItem = NavItem & { current: boolean }

/** Same three apps, same order and icons as the Suite's Apps group. */
export const appItems: AppItem[] = [
  {
    title: "PipeLeads CRM",
    url: `${PIPELEADS_SUITE_URL}/crm/pipeline`,
    icon: BarChart3,
    current: false,
  },
  { title: "Lead Finder", url: LEAD_FINDER_HOME, icon: Search, current: true },
  {
    title: "ProjectBaser",
    url: `${PIPELEADS_SUITE_URL}/pm/boards`,
    icon: FolderKanban,
    current: false,
  },
]

export const leadSearchItems: NavItem[] = [
  { title: "New Search", url: "/lead-search/new-search", icon: ListPlus },
  { title: "Saved Lists", url: "/lead-search/saved-lists", icon: Bookmark },
  { title: "Custom Labels", url: "/lead-search/custom-labels", icon: Tags },
]

export const aiToolsMenu = {
  title: "AI Tools",
  icon: Lightbulb,
  items: [
    { title: "Knowledge Base", url: "/ai/knowledge-base", icon: BookOpen },
    { title: "AI Assistant", url: "/ai/ai-assistant", icon: Bot },
    { title: "AI Agent", url: "/ai/ai-agent", icon: BrainCircuit },
  ] satisfies NavItem[],
}

export const adminMenu = {
  title: "Admin",
  icon: Settings,
  items: [
    { title: "Business Account", url: "/admin/business-account", icon: Building2 },
    { title: "Packages", url: "/admin/packages", icon: Package },
    { title: "Stripe", url: "/admin/stripe", icon: CreditCard },
    { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
    { title: "Custom Links", url: "/admin/custom-links", icon: Link2 },
    { title: "SMTP", url: "/admin/smtp", icon: Mail },
    { title: "Webhooks", url: "/admin/webhooks", icon: Webhook },
    { title: "Email Templates", url: "/admin/email-templates", icon: FileText },
    { title: "Training Content", url: "/admin/training-content", icon: GraduationCap },
  ] satisfies NavItem[],
}

export const resourceItems: NavItem[] = [
  { title: "Integrations", url: "/resources/integrations", icon: Webhook },
  { title: "Support", url: "/resources/support", icon: HelpCircle },
  { title: "Tutorials", url: "/resources/tutorials", icon: GraduationCap },
]

/** Section names used by the breadcrumb, keyed by the first path segment. */
export const sectionLabels: Record<string, string> = {
  "lead-search": "Lead Search",
  ai: "AI Tools",
  admin: "Admin",
  resources: "Resources",
}

/** Every page the header can name, for the breadcrumb and the search palette. */
export const pageTitles: Record<string, string> = {
  ...Object.fromEntries(
    [...leadSearchItems, ...aiToolsMenu.items, ...adminMenu.items, ...resourceItems].map(
      (item) => [item.url, item.title]
    )
  ),
  "/admin/partners": "Partners",
  "/resources/documentation": "Documentation",
}

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "admin@groovedigital.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
const ADMIN_DOMAINS = (process.env.NEXT_PUBLIC_ADMIN_DOMAINS || "")
  .split(",")
  .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean)

export function isAdminUser(email?: string | null, role?: string | null) {
  if (role?.toLowerCase() === "admin") return true
  if (!email) return false
  const normalized = email.toLowerCase()
  return (
    ADMIN_EMAILS.includes(normalized) ||
    ADMIN_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`))
  )
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
