import {
  Search,
  Users,
  Building2,
  Globe,
  Video,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  AtSign,
  BriefcaseBusiness,
  ShieldCheck,
  Bot,
  MessageSquare,
  FileText,
  Sparkles,
  PenLine,
  Lightbulb,
  Workflow,
  ArrowRight,
  Zap,
  Send,
  BookOpenCheck,
  ChevronRight,
  Star,
} from "lucide-react"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Search className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">PipeLeads</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How It Works
            </a>
            <a
              href="#ai-tools"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              AI Tools
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/lead-search/new-search"
              className="hidden rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href="/lead-search/new-search"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get Started
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_50%)] opacity-[0.07]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--chart-1)_0%,transparent_50%)] opacity-[0.05]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center md:pb-32 md:pt-36">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            100% compliant live data APIs
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            Find your next customer{" "}
            <span className="bg-gradient-to-r from-primary to-[var(--chart-1)] bg-clip-text text-transparent">
              with AI precision
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            AI-powered lead discovery with live data enrichment. Find companies,
            people, and influencers with real-time contact details, social
            profiles, and deep intelligence.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/lead-search/new-search"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 hover:shadow-xl hover:shadow-primary/30"
            >
              Start Finding Leads
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-8 py-3.5 text-base font-medium transition-colors hover:bg-accent"
            >
              See How It Works
            </a>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required. Start searching in seconds.
          </p>
        </div>
      </section>

      {/* Five Search Types */}
      <section id="features" className="scroll-mt-20 bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
              Search Types
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Five Powerful Ways to Find Leads
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Unlike tools that scrape stale databases, LeadFinder pulls from
              live data sources through compliant APIs -- giving you fresh,
              accurate results every time.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* People Search */}
            <div className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">People Search</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Find decision-makers by role, location, skills, and experience.
                Target by department, management level, company size, and
                revenue.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />1 credit per lead
              </div>
            </div>

            {/* Local Search */}
            <div className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Local Search</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Discover local businesses by location and category. Get phone
                numbers, addresses, reviews, ratings, and website information
                instantly.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />1 credit per lead
              </div>
            </div>

            {/* Company Search */}
            <div className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Company Search</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Search by vertical, niche, or business type worldwide. Access
                company details, websites, phone numbers, locations, social
                profiles, and employee counts.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />1 credit per lead
              </div>
            </div>

            {/* Domain Search */}
            <div className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Domain Search</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Enter any company website to discover multiple contacts. Perfect
                for account-based marketing strategies and targeted outreach
                campaigns.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />1 credit per lead
              </div>
            </div>

            {/* Influencer Search */}
            <div className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Influencer Search</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Find Instagram, TikTok, and YouTube influencers by follower
                count, engagement rate, audience demographics, and hashtags.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />1 credit per lead
              </div>
            </div>

            {/* Highlight Card */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center">
              <Star className="mb-3 h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold">Live Data</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Every search pulls fresh, real-time data from compliant APIs.
                No stale databases. No outdated records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Enrichment */}
      <section id="how-it-works" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
                Enrichment
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Enrich any lead in one click
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Go beyond basic contact info. Our enrichment engine verifies
                emails, finds direct phone numbers, and uncovers social profiles
                -- all in a single click.
              </p>
              <div className="mt-8">
                <Link
                  href="/lead-search/new-search"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Try Enrichment Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Mail, label: "Verified Emails", desc: "Multiple addresses per contact" },
                { icon: Phone, label: "Phone Numbers", desc: "Direct dials and cell phones" },
                { icon: Linkedin, label: "Social Profiles", desc: "LinkedIn, X, Instagram, Facebook" },
                { icon: BriefcaseBusiness, label: "Job History", desc: "Career progression and titles" },
                { icon: Building2, label: "Company Intel", desc: "Employee count, tech stack, revenue" },
                { icon: AtSign, label: "Lookalikes", desc: "Similar companies and contacts" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <item.icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant */}
      <section id="ai-tools" className="scroll-mt-20 bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="order-2 lg:order-1">
              <div className="space-y-4">
                {[
                  {
                    icon: MessageSquare,
                    title: "Personalized DMs",
                    desc: "Craft unique direct messages for each prospect based on their profile and interests.",
                  },
                  {
                    icon: FileText,
                    title: "Company Summaries",
                    desc: "Get instant AI-generated briefs on any company before you reach out.",
                  },
                  {
                    icon: PenLine,
                    title: "Email Subject Lines",
                    desc: "Generate high-open-rate subject lines tailored to each prospect.",
                  },
                  {
                    icon: Lightbulb,
                    title: "ICP Suggestions",
                    desc: "AI analyzes your business and suggests new markets you should target.",
                  },
                  {
                    icon: Sparkles,
                    title: "Custom Prompts",
                    desc: "Build your own AI workflows for any research or writing task.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
                AI Assistant
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Let AI do the research and writing
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Write personalized DMs, emails, subject lines, or conduct deep
                research on any lead -- all powered by AI. Pre-built prompts get
                you started instantly.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Zero credit cost for all AI features
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agents */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
              AI Agents
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Automate your entire prospecting pipeline
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Set your ideal prospect criteria once, and let AI agents
              continuously find, enrich, research, and prepare outreach -- on
              autopilot.
            </p>
          </div>

          <div className="mt-14 flex flex-col items-center gap-4 md:flex-row md:gap-0">
            {[
              { icon: Search, label: "Search", desc: "Define your ideal customer profile" },
              { icon: BookOpenCheck, label: "Enrich", desc: "Verify emails and phone numbers" },
              { icon: Bot, label: "Research", desc: "AI deep-dives on every prospect" },
              { icon: Send, label: "Outreach", desc: "Personalized messages at scale" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex w-56 flex-col items-center rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold">{step.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
                {i < 3 && (
                  <ArrowRight className="mx-2 hidden h-5 w-5 shrink-0 text-muted-foreground/50 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
            Integrations
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Connect to your existing stack
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Native Zapier integration connects PipeLeads to 5,000+ apps.
            Automatically sync leads, trigger workflows, and push data to your
            CRM, email tools, or spreadsheets.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {["Zapier", "Webhooks", "CRM Sync", "Email Tools", "Spreadsheets"].map(
              (name) => (
                <div
                  key={name}
                  className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium shadow-sm"
                >
                  {name}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-[0.06]" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Ready to find your next customer?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Join thousands of sales teams using PipeLeads to discover and
            connect with their ideal prospects.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/lead-search/new-search"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 hover:shadow-xl hover:shadow-primary/30"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required. Set up in under 60 seconds.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Search className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">PipeLeads</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#how-it-works" className="transition-colors hover:text-foreground">
                How It Works
              </a>
              <a href="#ai-tools" className="transition-colors hover:text-foreground">
                AI Tools
              </a>
              <span className="transition-colors hover:text-foreground">
                Privacy
              </span>
              <span className="transition-colors hover:text-foreground">
                Terms
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PipeLeads. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
