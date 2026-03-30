"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ExternalLink,
  Headset,
  MessageCircle,
  BookOpen,
  Clock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const SUPPORT_URL = "https://support.groovedigital.com/"

export default function SupportPage() {
  const [opened, setOpened] = useState(false)

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            style={{ animation: "fadeInUp 0.5s ease-out both" }}
          >
            <Headset className="h-8 w-8" />
          </div>

          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ animation: "fadeInUp 0.5s ease-out 0.1s both" }}
          >
            We're Here to Help
          </h1>

          <p
            className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed"
            style={{ animation: "fadeInUp 0.5s ease-out 0.2s both" }}
          >
            {opened
              ? "Your support portal opened in a new tab. You can also use the resources below to find quick answers."
              : "Get answers fast — our support team and knowledge base are ready for you."}
          </p>

          <div style={{ animation: "fadeInUp 0.5s ease-out 0.3s both" }}>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpened(true)}
            >
              <Button size="lg" className="gap-2 px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                <MessageCircle className="h-4 w-4" />
                {opened ? "Open Support Again" : "Open Support Center"}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </a>
          </div>
        </div>

        {/* Quick help cards */}
        <div
          className="grid gap-4 sm:grid-cols-2"
          style={{ animation: "fadeInUp 0.6s ease-out 0.4s both" }}
        >
          <Card className="group relative overflow-hidden border-border/60 hover:border-primary/30 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="relative p-5 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Knowledge Base</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Browse articles, how-to guides, and troubleshooting steps written
                  for every feature in PipeLeads.
                </p>
              </div>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Browse articles
                <ArrowRight className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/60 hover:border-primary/30 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="relative p-5 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">In-App Tutorials</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Step-by-step walkthroughs for every search type, enrichment,
                  AI actions, labels, and exports — right inside the app.
                </p>
              </div>
              <Link
                href="/resources/tutorials"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open tutorials
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* FAQ quick answers */}
        <div style={{ animation: "fadeInUp 0.6s ease-out 0.5s both" }}>
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Common Questions — Quick Answers
              </h3>

              <div className="space-y-3">
                {[
                  {
                    q: "How do I add more credits?",
                    a: 'Click the "Credit Wallet" button in the sidebar, or visit credits.scaleplus.gg. Credits are added to your account instantly.',
                  },
                  {
                    q: "Why did my search return zero results?",
                    a: "Usually too many filters. Try removing advanced filters and double-check that your location was selected from the autocomplete dropdown (not typed manually).",
                  },
                  {
                    q: "How do I find someone's email address?",
                    a: 'Open your lead list and click "Add Email" next to the lead, or use the "Data Enrichment" button to enrich all leads at once. You\'re only charged if an email is actually found.',
                  },
                  {
                    q: "Can I export my leads?",
                    a: "Yes — click \"Export CSV\" in the action bar above any lead list. Exports are always free, no credits charged. The CSV includes 22 columns and opens in Excel, Google Sheets, or your CRM.",
                  },
                ].map((item) => (
                  <div key={item.q} className="flex gap-3">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
                    <div>
                      <p className="text-xs font-semibold">{item.q}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {item.a}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer note */}
        <p
          className="text-center text-xs text-muted-foreground/50"
          style={{ animation: "fadeInUp 0.6s ease-out 0.6s both" }}
        >
          Can't find what you need? Our team typically responds within a few hours at{" "}
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/60 hover:text-primary underline"
          >
            support.groovedigital.com
          </a>
        </p>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
