"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  Search,
  List,
  Sparkles,
  Bot,
  Tags,
  Download,
  PlayCircle,
  ChevronDown,
  CheckCircle2,
  Lightbulb,
  Target,
  Zap,
  Users,
  MapPin,
  Building2,
  Globe,
  Instagram,
  Mail,
  Phone,
  HelpCircle,
  ExternalLink,
  Star,
  Clock,
  Filter,
  FileText,
  BrainCircuit,
  Radar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

// ─── Tip / Note / Warning callout boxes ──────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="text-foreground/80">{children}</div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/30">
      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="text-foreground/80">{children}</div>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="font-semibold mb-1">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

function VideoPlaceholder({ title }: { title: string }) {
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <PlayCircle className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">Video tutorial coming soon</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TutorialsPage() {
  const [activeTab, setActiveTab] = useState("getting-started")
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({
    "getting-started": "overview",
    "lead-search": "search-types",
    "saved-lists": "viewing-results",
    "enrichment": "what-is-enrichment",
    "ai-tools": "knowledge-base",
    "labels-export": "labels",
  })
  const [isVideoOpen, setIsVideoOpen] = useState(false)

  function subTab(main: string, value: string) {
    setActiveSubTab((prev) => ({ ...prev, [main]: value }))
  }

  const categories = [
    { id: "getting-started", label: "Getting Started", icon: BookOpen },
    { id: "lead-search", label: "Lead Search", icon: Search },
    { id: "saved-lists", label: "Saved Lists", icon: List },
    { id: "enrichment", label: "Data Enrichment", icon: Sparkles },
    { id: "ai-tools", label: "AI Tools", icon: Bot },
    { id: "labels-export", label: "Labels & Export", icon: Tags },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/lead-search/new-search">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Tutorials & User Guide</h1>
              <p className="text-xs text-muted-foreground">
                Everything you need to find, enrich, and connect with your ideal leads
              </p>
            </div>
          </div>
        </div>
        <a
          href="https://support.groovedigital.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Support Center
            <ExternalLink className="h-3 w-3" />
          </Button>
        </a>
      </div>

      {/* Video intro collapsible */}
      <Collapsible open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Watch: PipeLeads Overview (5 min)</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isVideoOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-b-lg border-x border-b p-4 pt-0 bg-card">
            <VideoPlaceholder title="Welcome to PipeLeads — Platform Overview" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Two-level Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Level 1 — Category tabs */}
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-full justify-start gap-1 bg-muted/50 p-1 inline-flex md:w-auto">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="gap-2 px-3 py-2 text-sm"
              >
                <cat.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── GETTING STARTED ─────────────────────────────────────────────── */}
        <TabsContent value="getting-started" className="space-y-4">
          <Tabs
            value={activeSubTab["getting-started"]}
            onValueChange={(v) => subTab("getting-started", v)}
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6">
              {[
                { value: "overview", label: "Overview" },
                { value: "dashboard", label: "Your Dashboard" },
                { value: "credits", label: "Credits" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radar className="h-5 w-5 text-primary" />
                    Welcome to PipeLeads
                  </CardTitle>
                  <CardDescription>
                    Your all-in-one AI platform for finding and connecting with your ideal customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    PipeLeads helps you find the right people to reach out to—whether that's
                    local business owners, professionals on LinkedIn, social media influencers,
                    or every contact at a specific company. Instead of spending hours manually
                    researching prospects, you describe who you're looking for and our system
                    finds them for you, complete with contact information.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Think of it like having a research assistant who never sleeps. You tell them
                    "find me dentists in Boca Raton who might need marketing help," and a few
                    minutes later you have a list of contacts with names, job titles, email
                    addresses, and LinkedIn profiles—ready for your outreach campaign.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        icon: Search,
                        title: "5 Search Types",
                        desc: "Find people, local businesses, companies, domain contacts, or influencers",
                      },
                      {
                        icon: Mail,
                        title: "Email & Phone Enrichment",
                        desc: "Add missing contact details to leads after your initial search",
                      },
                      {
                        icon: Bot,
                        title: "AI-Powered Outreach",
                        desc: "Generate personalized messages, subject lines, and prospect summaries",
                      },
                      {
                        icon: Download,
                        title: "Export to CSV",
                        desc: "Take your leads into any email or CRM tool you already use",
                      },
                    ].map((item) => (
                      <div key={item.title} className="flex gap-3 p-3 rounded-lg border bg-card">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Tip>
                    <strong>New here?</strong> The fastest way to get value is to run a
                    Local Search first. It's the simplest search type—just a business type
                    and a city—and you'll have a list of warm leads in under two minutes.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your Dashboard at a Glance</CardTitle>
                  <CardDescription>
                    Here's what you'll see every time you log in and where everything lives
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    The left sidebar is your main navigation. It has four sections you'll use
                    regularly. Here's a quick tour:
                  </p>

                  <div className="space-y-4">
                    {[
                      {
                        icon: Lightbulb,
                        label: "AI Tools",
                        desc: "Three powerful features: your Knowledge Base (where you store your business info), the AI Assistant (generates personalized outreach for each lead), and AI Agents (automates your entire prospecting workflow).",
                      },
                      {
                        icon: Search,
                        label: "Lead Search",
                        desc: "Start a new search, view your saved lead lists, and manage your custom labels. You'll spend most of your time in here.",
                      },
                      {
                        icon: HelpCircle,
                        label: "Resources",
                        desc: "Tutorials (you're here!), support, and documentation. Bookmark this page—it covers everything.",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Note>
                    At the top of the sidebar you'll see your <strong>Credits Remaining</strong>{" "}
                    balance. Each search and enrichment action uses credits. You can buy more by
                    clicking the <strong>Credit Wallet</strong> button.
                  </Note>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Quick-start checklist:</p>
                    <div className="space-y-2">
                      {[
                        "Fill in your Knowledge Base with your business details",
                        "Run your first search (try Local Search for the easiest start)",
                        "Open your saved list and review the results",
                        "Try the AI Assistant to generate a personalized message for one lead",
                        "Export your list to CSV when you're ready to start outreach",
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="credits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>How Credits Work</CardTitle>
                  <CardDescription>
                    Credits are the currency of PipeLeads—here's exactly what they cost
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Every time PipeLeads finds you a new lead or enriches contact data, it
                    uses a small number of credits. Think of it like a pay-per-result system—
                    you only spend credits when you actually get something back.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left pb-2 font-semibold">Action</th>
                          <th className="text-right pb-2 font-semibold">Credits Used</th>
                          <th className="text-right pb-2 font-semibold text-muted-foreground">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          ["People Search (per contact)", "3", "LinkedIn-sourced professional profiles"],
                          ["Local Search (per business)", "1", "Free if no email found"],
                          ["Company Search (per company)", "1", "Business profile data"],
                          ["Domain Search (per contact)", "1", "All contacts at one company"],
                          ["Influencer Search (per profile)", "2", "+5 if you enrich their email"],
                          ["Email Enrichment", "varies", "Depends on actor result"],
                          ["Phone Enrichment", "varies", "Depends on actor result"],
                          ["AI Actions (messages, etc.)", "0", "Free — uses your AI keys"],
                          ["CSV Export", "0", "Always free"],
                        ].map(([action, cost, note]) => (
                          <tr key={action}>
                            <td className="py-2">{action}</td>
                            <td className="py-2 text-right font-medium">{cost}</td>
                            <td className="py-2 text-right text-xs text-muted-foreground">{note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Tip>
                    <strong>Save credits:</strong> Run a Local Search first to validate your
                    target market before spending 3 credits per contact on a People Search.
                    Local searches are the most affordable way to test a new niche or city.
                  </Tip>

                  <p className="text-sm text-muted-foreground">
                    Your live credit balance is always visible in the sidebar so you know
                    exactly where you stand. If your balance ever goes negative, it'll turn
                    red to get your attention — and operations like searches and enrichment
                    will be paused until you add more credits.
                  </p>

                  <p className="text-sm text-muted-foreground">
                    To buy more credits, click the <strong>Credit Wallet</strong> button in
                    the sidebar — it links directly to{" "}
                    <a
                      href="https://credits.scaleplus.gg/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      credits.scaleplus.gg
                    </a>{" "}
                    where you can purchase more.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── LEAD SEARCH ─────────────────────────────────────────────────── */}
        <TabsContent value="lead-search" className="space-y-4">
          <Tabs
            value={activeSubTab["lead-search"]}
            onValueChange={(v) => subTab("lead-search", v)}
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6 overflow-x-auto">
              {[
                { value: "search-types", label: "Search Types" },
                { value: "people", label: "People Search" },
                { value: "local", label: "Local Search" },
                { value: "company-domain", label: "Company & Domain" },
                { value: "influencer", label: "Influencer" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-sm whitespace-nowrap"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="search-types" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Choosing the Right Search Type
                  </CardTitle>
                  <CardDescription>
                    PipeLeads has five ways to find leads — each one is designed for a different goal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    When you click <strong>Lead Search → New Search</strong>, you'll see five
                    cards. Each one is a different kind of search. Click a card to select it —
                    you'll see a checkmark appear — then fill in the form that appears below and
                    click <strong>→ Continue</strong>.
                  </p>

                  <div className="space-y-3">
                    {[
                      {
                        icon: Users,
                        label: "People Search",
                        cost: "3 credits/contact",
                        desc: "Find specific professionals on LinkedIn by role, industry, location, and 15+ advanced filters. Best when you know exactly who you're targeting (e.g., \"Marketing Directors at SaaS companies in Austin\").",
                        best: "B2B outreach, recruiting, partnership development",
                      },
                      {
                        icon: MapPin,
                        label: "Local Search",
                        cost: "1 credit/business",
                        desc: "Find local businesses by type and city. Just type a business category (like \"Dentist\" or \"Hair Salon\") and a location. Free if no email is found for a business.",
                        best: "Local lead generation, service businesses, community marketing",
                      },
                      {
                        icon: Building2,
                        label: "Company Search",
                        cost: "1 credit/company",
                        desc: "Find companies rather than individuals. Filter by industry, size, technology stack, revenue, and more. Good for building a target account list.",
                        best: "Account-based marketing, enterprise sales prospecting",
                      },
                      {
                        icon: Globe,
                        label: "Domain Search",
                        cost: "1 credit/contact",
                        desc: "Enter a company name or website (e.g., \"amazon.com\") and get all publicly available email contacts at that company. Great for when you already know which company you want to target.",
                        best: "Targeted outreach to a specific company",
                      },
                      {
                        icon: Instagram,
                        label: "Influencer Search",
                        cost: "2 credits/profile",
                        desc: "Find influencers on Instagram, TikTok, or YouTube. Filter by follower count, engagement rate, niche, language, and more. Add email enrichment for +5 credits.",
                        best: "Influencer marketing campaigns, partnership outreach",
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <item.icon className="h-4 w-4 text-primary" />
                            {item.label}
                          </div>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
                            {item.cost}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        <p className="text-xs text-primary/80">
                          <strong>Best for:</strong> {item.best}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Note>
                    Every search saves leads to a <strong>list</strong>. You can select an
                    existing list or create a new one each time you search. This lets you keep
                    different campaigns organized in separate lists. Your credit balance is
                    checked before every search — if it's negative, the search won't run
                    until you add more credits.
                  </Note>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="people" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    People Search
                  </CardTitle>
                  <CardDescription>
                    Find specific professionals on LinkedIn with powerful filtering
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The People Search is the most detailed search in PipeLeads. It searches
                    LinkedIn's professional database, so you'll get results with full professional
                    profiles—job title, company, location, and often an email address.
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">How to run a People Search:</p>
                    <div className="space-y-4">
                      <Step number={1} title="Select People Search">
                        On the New Search page, click the <strong>People Search</strong> card.
                        You'll see a checkmark appear on it, and the search form will open below.
                      </Step>
                      <Step number={2} title="Enter a Description">
                        In the <strong>Description</strong> field, describe the type of person
                        you're looking for. Examples: "Web Designer", "HR Manager at tech
                        companies", "Real Estate Agent". Be descriptive but not too narrow.
                      </Step>
                      <Step number={3} title="Set Location">
                        Start typing a city or region in the <strong>Location</strong> field.
                        After you type 3 or more characters, a dropdown will appear with matching
                        locations—select one from the list to make sure the spelling is exactly
                        right. This matters: LinkedIn search is location-sensitive.
                      </Step>
                      <Step number={4} title="Set Results Limit">
                        Choose how many contacts to return (up to 100 per search). Each contact
                        costs 3 credits, so start with 10–20 to test the waters.
                      </Step>
                      <Step number={5} title="Use Advanced Filters (optional)">
                        Click <strong>Advanced filters</strong> to access 15+ extra fields:
                        Job Title, Department, Management Level, Skills, Years of Experience,
                        Company Name, Industry, Company Size, Education, and more. Only fill in
                        what matters—leaving filters blank is fine.
                      </Step>
                      <Step number={6} title="Pick a List and Search">
                        Choose an existing list from the dropdown, or type a name and click
                        <strong> Create new list</strong>. Then click <strong>→ Continue</strong>.
                        Your search will run in the background—results appear in your list
                        within 1–3 minutes.
                      </Step>
                    </div>
                  </div>

                  <Tip>
                    <strong>Pro tip — Start broad, then narrow:</strong> If you over-filter,
                    LinkedIn returns fewer results or even zero. Start with just a Description
                    and Location. Once you see the results, you'll know what additional filters
                    would help refine them.
                  </Tip>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Common Questions:</p>
                    <div className="space-y-3">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs font-semibold mb-1">Why did I get zero results?</p>
                        <p className="text-xs text-muted-foreground">
                          Usually this means your filters are too specific. Try removing some
                          advanced filters, or check that your location was selected from the
                          dropdown (not typed manually).
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs font-semibold mb-1">Not all results have emails. Is that normal?</p>
                        <p className="text-xs text-muted-foreground">
                          Yes—email availability depends on what's publicly linked to a LinkedIn
                          profile. Use the <strong>Data Enrichment</strong> feature to find
                          missing emails after your search.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="local" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Local Search
                  </CardTitle>
                  <CardDescription>
                    The simplest way to find local businesses in any city
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Local Search finds brick-and-mortar businesses and local service providers
                    using Google Maps data. It's the easiest search to start with—just two
                    fields—and it's the most affordable option at 1 credit per business (and
                    free if no email is found).
                  </p>

                  <div className="space-y-4">
                    <Step number={1} title="Select Local Search">
                      Click the <strong>Local Search</strong> card on the New Search page.
                    </Step>
                    <Step number={2} title="Enter Business Type">
                      Type what kind of business you want to find. Examples: "Dentist",
                      "Hair Salon", "Auto Repair Shop", "Yoga Studio", "Real Estate Agency".
                      You can also be specific: "Italian Restaurant" or "Family Law Attorney".
                    </Step>
                    <Step number={3} title="Enter Location">
                      Type a city name (e.g., "Miami, FL" or "Seattle, WA"). After 3
                      characters, a dropdown appears with matching locations—pick one to
                      ensure the correct format.
                    </Step>
                    <Step number={4} title="Pick a List and Run">
                      Select or create a list, then click <strong>→ Continue</strong>. Results
                      typically arrive within 1–2 minutes.
                    </Step>
                  </div>

                  <Note>
                    Local Search results include the business name, address, phone number,
                    website, and email (when available). You'll also see their Google Maps
                    rating and review count, which is useful for qualifying prospects.
                  </Note>

                  <Tip>
                    <strong>Local Search is great for testing:</strong> Before spending 3 credits
                    each on People Search contacts, use Local Search to validate whether a
                    particular type of business in a city actually exists in large enough numbers
                    for your campaign.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="company-domain" className="space-y-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Company Search
                    </CardTitle>
                    <CardDescription>
                      Build a target account list by searching for companies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Company Search finds businesses—not individual people—based on filters
                      like industry, company size, technologies they use, and revenue range.
                      It's the starting point for account-based marketing: find the companies
                      first, then drill into their contacts with a Domain Search.
                    </p>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Available filters:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        {[
                          "Description / Keywords",
                          "Location & Radius",
                          "Industry",
                          "Company Name",
                          "Website / Domain",
                          "Technologies Used",
                          "Employee Count Range",
                          "Annual Revenue Range",
                        ].map((f) => (
                          <div key={f} className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Tip>
                      Use the <strong>Technologies</strong> filter to find companies running a
                      specific software stack—useful if you sell integrations or services that
                      complement a particular platform.
                    </Tip>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      Domain Search
                    </CardTitle>
                    <CardDescription>
                      Get every contact at a specific company with one search
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Domain Search takes a single company name or website address and returns
                      all publicly available email contacts at that company. If you already
                      know exactly which company you want to target, this is the fastest way
                      to get their team's contact details.
                    </p>

                    <div className="space-y-3">
                      <Step number={1} title="Select Domain Search">
                        Click the <strong>Domain Search</strong> card.
                      </Step>
                      <Step number={2} title="Enter Company Name or Website">
                        Type either the company name (e.g., "Amazon") or their website
                        (e.g., "amazon.com"). Either format works.
                      </Step>
                      <Step number={3} title="Run the Search">
                        Pick a list, click <strong>→ Continue</strong>, and wait. Credits are
                        charged per contact found—so if 7 staff members have public emails,
                        you'll use 7 credits.
                      </Step>
                    </div>

                    <Note>
                      Domain Search only finds contacts with <em>publicly available</em> email
                      addresses. For companies with strict privacy settings, you may get fewer
                      results than expected.
                    </Note>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="influencer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Instagram className="h-5 w-5 text-primary" />
                    Influencer Search
                  </CardTitle>
                  <CardDescription>
                    Find social media influencers on Instagram, TikTok, and YouTube
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Influencer Search helps you find content creators whose audiences match
                    your target customer. Whether you're looking for micro-influencers (10K
                    followers) for authentic brand partnerships or larger accounts for broad
                    exposure, you can filter precisely for what fits your campaign and budget.
                  </p>

                  <div className="space-y-4">
                    <Step number={1} title="Select Platform">
                      At the top of the Influencer Search form, choose your platform:
                      <strong> Instagram</strong>, <strong>TikTok</strong>, or{" "}
                      <strong>YouTube</strong>. Each has platform-specific filters.
                    </Step>
                    <Step number={2} title="Set Audience Filters">
                      The most important filters are:
                      <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                        <li><strong>Hashtags</strong> — content categories (e.g., #fitness, #entrepreneur)</li>
                        <li><strong>Followers</strong> — minimum and maximum follower range</li>
                        <li><strong>Engagement Rate</strong> — how active their audience is</li>
                        <li><strong>Language</strong> — the language the influencer posts in</li>
                        <li><strong>Category</strong> — niche (Beauty, Tech, Lifestyle, etc.)</li>
                      </ul>
                    </Step>
                    <Step number={3} title="Optional: Search by Username">
                      If you already know a specific influencer, click{" "}
                      <strong>Search by Username</strong> to look up their profile directly.
                    </Step>
                    <Step number={4} title="Add Email Enrichment (optional)">
                      Check the <strong>Include email enrichment</strong> option to
                      automatically try to find an email address for each influencer.
                      This costs an additional 5 credits per profile but saves you from
                      hunting down contact info manually.
                    </Step>
                  </div>

                  <Tip>
                    <strong>Micro-influencers (10K–100K followers)</strong> typically have
                    higher engagement rates and more niche audiences—often a better ROI than
                    mega-influencers for targeted products or services.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── SAVED LISTS ─────────────────────────────────────────────────── */}
        <TabsContent value="saved-lists" className="space-y-4">
          <Tabs
            value={activeSubTab["saved-lists"]}
            onValueChange={(v) => subTab("saved-lists", v)}
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6">
              {[
                { value: "viewing-results", label: "Viewing Results" },
                { value: "managing-leads", label: "Managing Leads" },
                { value: "history", label: "Search History" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="viewing-results" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5 text-primary" />
                    Viewing Your Lead Lists
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    All your search results are saved in <strong>Lead Search → Saved Lists</strong>.
                    You'll see a grid of list cards — each one represents a set of leads from one
                    or more searches.
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">On the Saved Lists page:</p>
                    {[
                      { label: "Filter tabs", desc: "Switch between All, People, Domain, Local, Company, and Influencer lists. The number in brackets shows how many lists of each type you have." },
                      { label: "Search", desc: "Find a specific list by typing its name." },
                      { label: "Active / Archive toggle", desc: "Lists you're actively working with appear in Active. Once you're done with a campaign, you can archive lists to keep things tidy." },
                      { label: "Grid / List view", desc: "Switch between a visual card grid and a compact list view." },
                      { label: "Each list card", desc: "Shows the list type, how many leads are in it, how many have verified emails, and when it was created." },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs font-semibold mb-0.5">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm font-semibold mt-4">Inside a List (the Results Table):</p>
                  <p className="text-sm text-muted-foreground">
                    Click any list card to open it. You'll see all your leads in a table with
                    these columns:
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {[
                      ["Name", "Photo, full name, job title, location, and social links"],
                      ["AI Assistant", "Quick-action buttons to generate messages, summaries, and more for this specific person"],
                      ["Contact Info", "Email status, phone number, and buttons to add missing contact details"],
                      ["Company", "Company name and LinkedIn link"],
                      ["Labels", "Tags you've applied to track outreach status"],
                      ["Created", "When this lead was added to your list"],
                    ].map(([col, desc]) => (
                      <div key={col} className="flex gap-2">
                        <span className="font-medium shrink-0 w-24">{col}</span>
                        <span>{desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="managing-leads" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>The Action Bar</CardTitle>
                  <CardDescription>
                    Everything you can do with your leads, right above the table
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    At the top of every list, you'll find an action bar with tools for working
                    with your leads. Here's what each button does:
                  </p>

                  <div className="space-y-3">
                    {[
                      {
                        icon: Clock,
                        label: "History",
                        desc: "See a record of every search that has added leads to this list—including the search type, parameters used, how many results came back, and whether the search succeeded.",
                      },
                      {
                        icon: Filter,
                        label: "Email filter tabs",
                        desc: "Filter leads by email status: All, Email found (verified address), Email not found, or Potential (unverified address). Useful for focusing on leads you can actually contact today.",
                      },
                      {
                        icon: Search,
                        label: "Search (add more leads)",
                        desc: "Run another search and add its results directly into this list. Great for building a larger list over multiple search sessions.",
                      },
                      {
                        icon: Sparkles,
                        label: "Data Enrichment",
                        desc: "Bulk-enrich all leads in the list that are missing email addresses. Runs in the background — refresh after a few minutes to see updated results.",
                      },
                      {
                        icon: BrainCircuit,
                        label: "AI Agent",
                        desc: "Open the AI Agent builder to create an automated workflow for this list (see the AI Tools section for more).",
                      },
                      {
                        icon: Download,
                        label: "Export CSV",
                        desc: "Download all leads in the current list as a CSV file. Free — no credits charged. Opens in Excel, Google Sheets, or your CRM.",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex gap-3 p-3 rounded-lg border">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Search History
                  </CardTitle>
                  <CardDescription>
                    See every search that's been run into a list
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Every list keeps a full log of the searches that added leads to it. This
                    helps you remember what you've already searched for and avoid duplicating
                    work.
                  </p>

                  <div className="space-y-3">
                    <Step number={1} title="Open Search History">
                      Inside any list, click the <strong>History</strong> button in the action
                      bar. A panel slides in from the right side of the screen.
                    </Step>
                    <Step number={2} title="Read the History Entries">
                      Each entry shows:
                      <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                        <li>The search type (People, Local, Company, etc.)</li>
                        <li>When the search was run</li>
                        <li>The search parameters used (description, location, etc.)</li>
                        <li>How many results were returned</li>
                        <li>The status: Completed ✓, Running ⟳, or Failed ✗</li>
                      </ul>
                    </Step>
                  </div>

                  <Note>
                    If a search shows "Running," it's still in progress. Wait a minute and
                    refresh the page — the results will appear in your list automatically.
                  </Note>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── DATA ENRICHMENT ──────────────────────────────────────────────── */}
        <TabsContent value="enrichment" className="space-y-4">
          <Tabs
            value={activeSubTab["enrichment"]}
            onValueChange={(v) => subTab("enrichment", v)}
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6">
              {[
                { value: "what-is-enrichment", label: "What Is Enrichment?" },
                { value: "email-enrichment", label: "Email Enrichment" },
                { value: "phone-enrichment", label: "Phone Enrichment" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="what-is-enrichment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    What Is Data Enrichment?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    When you first search for leads, PipeLeads pulls whatever contact information
                    is publicly available. Sometimes that means you'll get a name and LinkedIn
                    profile, but no email address. Data Enrichment fills those gaps.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enrichment uses the lead's LinkedIn profile to find a verified email address
                    or phone number through specialist tools. It's like hiring a researcher to
                    track down contact details for each person on your list.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Email Enrichment</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Finds a professional email address for leads who don't have one in
                        your list. Works best for LinkedIn-sourced leads.
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Phone Enrichment</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Finds a mobile phone number for a lead. Useful for direct outreach
                        via text message or phone calls.
                      </p>
                    </div>
                  </div>

                  <Tip>
                    <strong>Good news on pricing:</strong> Enrichment only charges credits
                    when contact info is actually found. If a lookup comes back empty, you
                    don't pay anything — so there's no risk in trying.
                  </Tip>

                  <Note>
                    Enrichment results include a status badge: <strong>Found</strong> (verified
                    address), <strong>Potential</strong> (likely correct but not fully verified),
                    or <strong>Not Found</strong> (no data available). Always respect email
                    deliverability best practices when using Potential emails.
                  </Note>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email-enrichment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Finding Email Addresses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You can find email addresses one at a time or in bulk for your entire list.
                    Here's how to do both:
                  </p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold mb-3">Option 1 — Enrich one lead at a time</p>
                      <div className="space-y-3">
                        <Step number={1} title="Find the lead in your list">
                          Open your list and locate the lead whose email you want to find.
                        </Step>
                        <Step number={2} title='Click "Add Email"'>
                          In the <strong>Contact Info</strong> column, you'll see a small
                          button labelled <strong>Add Email</strong>. Click it.
                        </Step>
                        <Step number={3} title="Wait for the result">
                          A loading spinner appears while the system searches. Within 30–60
                          seconds, the email address (if found) will appear in the column with
                          a status badge.
                        </Step>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold mb-3">Option 2 — Bulk enrich your entire list</p>
                      <div className="space-y-3">
                        <Step number={1} title='Click "Data Enrichment" in the action bar'>
                          Above your results table, click the <strong>Data Enrichment</strong>{" "}
                          button (the one with the sparkle icon).
                        </Step>
                        <Step number={2} title="Confirm the action">
                          The system starts enriching all leads with a "Not Found" or
                          "Unknown" email status. You'll see a success notification.
                        </Step>
                        <Step number={3} title="Refresh after a few minutes">
                          Bulk enrichment runs in the background. Come back in 3–5 minutes
                          and refresh the page to see updated email addresses across your list.
                        </Step>
                      </div>
                    </div>
                  </div>

                  <Tip>
                    <strong>Best time to enrich:</strong> After running a People Search,
                    use bulk enrichment immediately before reviewing your list. That way,
                    by the time you're ready to start outreach, most contacts will already
                    have verified email addresses.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="phone-enrichment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Finding Phone Numbers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Phone enrichment works the same way as email enrichment, but finds a mobile
                    number instead. This is useful if your outreach strategy includes text
                    messages, WhatsApp, or phone calls.
                  </p>

                  <div className="space-y-4">
                    <Step number={1} title="Find the lead in your list">
                      Open your list and find the lead you want a phone number for.
                    </Step>
                    <Step number={2} title='Click "Get Phone Numbers"'>
                      In the <strong>Contact Info</strong> column, click the{" "}
                      <strong>Get Phone Numbers</strong> button. A loading indicator appears.
                    </Step>
                    <Step number={3} title="See the result">
                      If a number is found, it appears directly in the column. If not found,
                      you'll see a "Not Found" status. You can also manually type in a phone
                      number using the <strong>Add Phone Number</strong> option.
                    </Step>
                  </div>

                  <Note>
                    Phone enrichment works best for People Search leads with LinkedIn profiles.
                    Local Search businesses usually already include a phone number from Google
                    Maps, so you may not need to enrich those.
                  </Note>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── AI TOOLS ────────────────────────────────────────────────────── */}
        <TabsContent value="ai-tools" className="space-y-4">
          <Tabs
            value={activeSubTab["ai-tools"]}
            onValueChange={(v) => subTab("ai-tools", v)}
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6">
              {[
                { value: "knowledge-base", label: "Knowledge Base" },
                { value: "ai-assistant", label: "AI Assistant" },
                { value: "ai-agents", label: "AI Agents" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="knowledge-base" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Knowledge Base (Your Business Profile)
                  </CardTitle>
                  <CardDescription>
                    Set this up first — it's what makes every AI action personalized to your business
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The Knowledge Base is where you tell PipeLeads about your business. Think of
                    it as briefing a new team member — the more you explain about who you are,
                    what you sell, and who your ideal customer is, the better the AI-generated
                    messages will sound. This is the single most important step to get great
                    results from AI Actions.
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Core Business Profile fields:</p>
                    {[
                      { label: "Business Name", desc: "Your company or brand name" },
                      { label: "Business Website", desc: "Your website URL (helps the AI learn more about you)" },
                      { label: "What do you sell?", desc: "Describe your product or service in plain language" },
                      { label: "Who does it help?", desc: "Describe your ideal customer — their role, industry, problem" },
                      { label: "What does it do for them?", desc: "The main benefit or outcome your offer delivers" },
                      { label: "Contact person name", desc: "The name that will appear in outreach messages (usually you)" },
                      { label: "Personality", desc: "The tone of voice for generated content (e.g., 'Professional but friendly')" },
                    ].map((item) => (
                      <div key={item.label} className="flex gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span>
                          <strong>{item.label}</strong>{" "}
                          <span className="text-muted-foreground">— {item.desc}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Data Sources (optional but powerful):</p>
                    <p className="text-sm text-muted-foreground">
                      Below the profile fields, you can add more context that the AI will draw
                      on when generating content:
                    </p>
                    {[
                      { label: "Website Crawl", desc: "Let PipeLeads read your website automatically" },
                      { label: "Text", desc: "Paste in any extra context — company history, FAQs, product details" },
                      { label: "Q&A pairs", desc: "Add specific questions and answers you want the AI to know" },
                      { label: "PDF Upload", desc: "Upload brochures, case studies, or other documents" },
                    ].map((item) => (
                      <div key={item.label} className="flex gap-2 text-sm">
                        <Star className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
                        <span>
                          <strong>{item.label}</strong>{" "}
                          <span className="text-muted-foreground">— {item.desc}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <Tip>
                    Fill in all seven core fields before you run your first AI action. Even
                    basic information dramatically improves message quality. You can always
                    come back and update it as your messaging evolves.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-assistant" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Generate personalized messages and content for each lead — for free
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The AI Assistant creates personalized outreach content for any lead in your
                    list. It uses the lead's name, job title, company, and location — combined
                    with your business profile — to generate messages that actually sound like
                    they were written for that specific person.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>All AI actions are free</strong> — they use your AI API keys (set up
                    in Settings), not your search credits.
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">How to use AI Assistant on a lead:</p>
                    <Step number={1} title="Open your list">
                      Navigate to Saved Lists and click on the list containing the lead.
                    </Step>
                    <Step number={2} title="Find the AI Assistant column">
                      In the results table, the second column is <strong>AI Assistant</strong>.
                      You'll see small icon buttons for each lead.
                    </Step>
                    <Step number={3} title="Click the action you want">
                      Each button triggers a different type of content. The result appears in
                      a panel alongside the lead's information.
                    </Step>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Available AI Actions:</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left pb-2 font-semibold">Action</th>
                            <th className="text-left pb-2 font-semibold pl-4">What It Creates</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[
                            ["Direct Message", "A short, personalized outreach message (perfect for LinkedIn DMs)"],
                            ["Summary", "A research brief on this prospect — great for sales call prep"],
                            ["Subject Line", "3–5 email subject line options, personalized to this person"],
                            ["Intro", "An opening paragraph for an email, in your voice"],
                            ["Custom", "Run any prompt you write — fully flexible"],
                            ["Library", "Use a saved prompt template from your library"],
                            ["Similar People", "Suggest search parameters to find more people like this lead"],
                          ].map(([action, desc]) => (
                            <tr key={action}>
                              <td className="py-2 font-medium pr-4 whitespace-nowrap">{action}</td>
                              <td className="py-2 text-muted-foreground pl-4">{desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Tip>
                    <strong>The Custom action is the most powerful.</strong> Try prompts like:
                    "Write a cold email referencing that they work in [their industry] and mention
                    our [specific benefit]" or "Generate 3 LinkedIn connection request messages
                    for this person, each with a different angle."
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-agents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    AI Agents
                  </CardTitle>
                  <CardDescription>
                    Set up automated prospecting workflows that run on their own
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    An AI Agent is like a mini-employee you create once. You tell it who to look
                    for, what to do when it finds them (enrich their data, generate outreach
                    content), and where to send the results (a webhook, a CRM, or just a list
                    in PipeLeads). Then you set it to run on a schedule — and it handles that
                    entire workflow automatically.
                  </p>

                  <div className="space-y-4">
                    <p className="text-sm font-semibold">Setting up your first agent:</p>
                    <Step number={1} title='Go to AI Tools → AI Agent'>
                      Click <strong>AI Agent</strong> in the sidebar under AI Tools. You'll
                      see your existing agents (or an empty state if this is your first).
                    </Step>
                    <Step number={2} title='Click "New AI Agent"'>
                      Give it a descriptive name, like "Weekly Dentist Prospector" or
                      "Monthly LinkedIn Outreach — SaaS Founders."
                    </Step>
                    <Step number={3} title="Configure the Search">
                      Choose which search type to use and fill in the search parameters —
                      exactly like setting up a regular search.
                    </Step>
                    <Step number={4} title="Add Actions">
                      Choose what happens after the leads are found:
                      <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                        <li><strong>Enrich emails</strong> — automatically find email addresses</li>
                        <li><strong>Generate outreach content</strong> — create messages for each lead</li>
                        <li><strong>Send to webhook</strong> — push leads to your CRM or automation tool</li>
                      </ul>
                    </Step>
                    <Step number={5} title="Set a Schedule (optional)">
                      Set the agent to run daily, weekly, or monthly. Or leave it as manual and
                      trigger it yourself from the dashboard.
                    </Step>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 pt-2">
                    {[
                      { icon: FileText, label: "Draft", desc: "Agent is being built, not running yet" },
                      { icon: Zap, label: "Active", desc: "Running on its schedule automatically" },
                      { icon: Target, label: "Paused", desc: "Temporarily stopped, can be resumed" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border p-3 text-center space-y-1">
                        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── LABELS & EXPORT ──────────────────────────────────────────────── */}
        <TabsContent value="labels-export" className="space-y-4">
          <Tabs
            value={activeSubTab["labels-export"]}
            onValueChange={(v) => subTab("labels-export", v)}
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6 mb-6">
              {[
                { value: "labels", label: "Custom Labels" },
                { value: "export", label: "Exporting CSV" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="labels" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tags className="h-5 w-5 text-primary" />
                    Custom Labels
                  </CardTitle>
                  <CardDescription>
                    Track your outreach progress with colour-coded tags on every lead
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Labels are tags you attach to individual leads to track where they are in your
                    outreach process. Think of them like sticky notes — you can mark a lead as
                    "Called," "Emailed," "Messaged," or create your own custom tags for your workflow.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold mb-3">Creating a new label:</p>
                      <div className="space-y-3">
                        <Step number={1} title="Go to Lead Search → Custom Labels">
                          Click <strong>Custom Labels</strong> in the sidebar.
                        </Step>
                        <Step number={2} title="Type a label name">
                          In the text field, type your new label name — for example,
                          "Follow Up," "Not Interested," "Hot Lead," or "Proposal Sent."
                        </Step>
                        <Step number={3} title='Click "+ Add Label"'>
                          Your new label is saved and immediately available to use on any lead.
                        </Step>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold mb-3">Applying a label to a lead:</p>
                      <div className="space-y-3">
                        <Step number={1} title="Open any list">
                          Go to Saved Lists and open the list containing the lead.
                        </Step>
                        <Step number={2} title='Click "Add" in the Labels column'>
                          In the <strong>Custom Labels</strong> column for that lead, click
                          the <strong>Add</strong> button. A small menu appears showing all
                          your available labels.
                        </Step>
                        <Step number={3} title="Select a label">
                          Click the label you want to apply. It instantly appears as a tag
                          on that lead. You can apply multiple labels to the same lead.
                        </Step>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    To <strong>remove</strong> a label, click the <strong>×</strong> on the
                    tag next to the lead's name. Labels are per-entry — the same lead can have
                    different labels in different lists.
                  </p>

                  <p className="text-sm text-muted-foreground">
                    <strong>Default labels</strong> already available: Called, Messaged, Emailed,
                    Exported to CSV. These cover the most common outreach tracking needs — you
                    may not need to create any additional ones to get started.
                  </p>

                  <Tip>
                    Use labels combined with the filter tabs (above the results table) to
                    focus on specific lead groups. For example: filter to "Email found" then
                    label those leads as you work through them one by one.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Exporting Your Leads to CSV
                  </CardTitle>
                  <CardDescription>
                    Take your leads into any email tool, CRM, or spreadsheet — always free
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    When you're ready to move leads into your email marketing tool, CRM, or
                    even just a spreadsheet to share with your team, you can export any list
                    as a CSV file with one click. This is completely free — no credits are
                    ever charged for exports.
                  </p>

                  <div className="space-y-3">
                    <Step number={1} title="Open the list you want to export">
                      Go to <strong>Lead Search → Saved Lists</strong> and click on the list.
                    </Step>
                    <Step number={2} title='Click "Export CSV" in the action bar'>
                      You'll find the <strong>Export CSV</strong> button in the action bar
                      above your results table (it has a download icon). Click it.
                    </Step>
                    <Step number={3} title="The file downloads automatically">
                      Your browser will download a CSV file named after your list (e.g.,
                      <em>Dentists-Boca-Raton.csv</em>). The file is saved to your
                      Downloads folder.
                    </Step>
                    <Step number={4} title="Open in your tool of choice">
                      Open the file in Excel, Google Sheets, or import it directly into your
                      CRM (Mailchimp, ActiveCampaign, HubSpot, etc.). The CSV includes 22
                      columns: Full Name, First Name, Last Name, Title, Email, Email Status,
                      Phone, Phone Status, Company, Company Website, Company LinkedIn,
                      Industry, Location, City, State, Country, LinkedIn, Facebook,
                      Instagram, Twitter, Labels, and Created At.
                    </Step>
                  </div>

                  <Note>
                    If you've applied an email filter (e.g., "Email found" only), the export
                    will include only the leads visible in the current filtered view. To export
                    everything, make sure the <strong>All</strong> filter tab is selected before
                    clicking Export.
                  </Note>

                  <Tip>
                    <strong>Before exporting:</strong> Run Data Enrichment first so that as
                    many leads as possible have email addresses. An export with 80% email
                    coverage is much more useful than one with 30%.
                  </Tip>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
