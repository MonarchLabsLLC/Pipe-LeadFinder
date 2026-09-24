import {
  BarChart3,
  BookOpen,
  Bookmark,
  Bot,
  BrainCircuit,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  ListPlus,
  Search,
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

export const resourceItems: NavItem[] = [
  { title: "Integrations", url: "/resources/integrations", icon: Webhook },
  { title: "Support", url: "/resources/support", icon: HelpCircle },
  { title: "Tutorials", url: "/resources/tutorials", icon: GraduationCap },
]

/** Section names used by the breadcrumb, keyed by the first path segment. */
export const sectionLabels: Record<string, string> = {
  "lead-search": "Lead Search",
  ai: "AI Tools",
  resources: "Resources",
}

/** Every page the header can name, for the breadcrumb and the search palette. */
export const pageTitles: Record<string, string> = {
  ...Object.fromEntries(
    [...leadSearchItems, ...aiToolsMenu.items, ...resourceItems].map(
      (item) => [item.url, item.title]
    )
  ),
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
