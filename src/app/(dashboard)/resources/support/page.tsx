"use client"

/* eslint-disable react/no-unescaped-entities */

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Sparkles,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const SUPPORT_URL = "https://support.groovedigital.com/"

const QUICK_ANSWERS = [
  {
    q: "How do I add more credits?",
    a: 'Click the "Credit Wallet" button in the sidebar, or visit credits.scaleplus.gg. Credits are added to your account instantly.',
  },
  {
    q: "Why did my search return zero results?",
    a: "Usually there are too many filters. Start with a broader description and location, then add filters after you see the first results.",
  },
  {
    q: "How do I find someone's email address?",
    a: 'Open your lead list and click "Add Email" next to the lead, or use the "Data Enrichment" button to enrich all leads at once. You\'re only charged if an email is actually found.',
  },
  {
    q: "Can I export my leads?",
    a: "Yes — click \"Export CSV\" above any lead list. Exports are free and download the full list as a CSV you can open in Excel, Google Sheets, or import into a CRM.",
  },
]

export default function SupportPage() {
  const [opened, setOpened] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Support"
        description={
          opened
            ? "Your support portal opened in a new tab. You can also use the resources below to find quick answers."
            : "Get answers fast — our support team and knowledge base are ready for you."
        }
        actions={
          <Button asChild>
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
              <MessageCircle aria-hidden="true" className="size-4" />
              {opened ? "Open Support Again" : "Open Support Center"}
              <ExternalLink aria-hidden="true" className="size-3.5 opacity-70" />
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl border bg-card p-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen aria-hidden="true" className="size-5" />
          </div>
          <h2 className="mb-1 font-semibold text-foreground">Knowledge Base</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Browse articles, how-to guides, and troubleshooting steps written for every feature in
            PipeLeads.
          </p>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Browse articles
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </a>
        </div>

        <div className="flex flex-col rounded-xl border bg-card p-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles aria-hidden="true" className="size-5" />
          </div>
          <h2 className="mb-1 font-semibold text-foreground">In-App Tutorials</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Step-by-step walkthroughs for every search type, enrichment, AI actions, labels, and
            exports — right inside the app.
          </p>
          <Link
            href="/resources/tutorials"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open tutorials
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
            Common Questions — Quick Answers
          </CardTitle>
          <CardDescription>The questions our support team hears most.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {QUICK_ANSWERS.map((item) => (
              <li key={item.q} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.q}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Can't find what you need? Our team typically responds within a few hours at{" "}
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          support.groovedigital.com
        </a>
      </p>
    </div>
  )
}
