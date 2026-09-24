import { notFound } from "next/navigation"
import { Settings } from "lucide-react"
import { auth } from "@/auth"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const adminPages: Record<string, { title: string; description: string }> = {
  "business-account": {
    title: "Business Account",
    description:
      "Manage your business account settings, billing, and team members.",
  },
  packages: {
    title: "Packages",
    description:
      "Configure and manage subscription packages for your clients.",
  },
  stripe: {
    title: "Stripe Integration",
    description: "Connect and manage your Stripe payment processing.",
  },
  subscriptions: {
    title: "Subscriptions",
    description: "View and manage active subscriptions.",
  },
  "custom-links": {
    title: "Custom Links",
    description: "Create branded links for your lead finder portal.",
  },
  smtp: {
    title: "SMTP Configuration",
    description:
      "Configure email sending settings for outreach campaigns.",
  },
  webhooks: {
    title: "Webhook Management",
    description:
      "Set up webhooks to connect with external CRMs and tools.",
  },
  "email-templates": {
    title: "Email Templates",
    description:
      "Create and manage email templates for automated outreach.",
  },
  "training-content": {
    title: "Training Content",
    description:
      "Manage onboarding and training resources for your team.",
  },
  partners: {
    title: "Partners",
    description: "Manage partner and affiliate relationships.",
  },
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@groovedigital.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
const ADMIN_DOMAINS = (process.env.ADMIN_DOMAINS || "")
  .split(",")
  .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean)

function isAdminUser(email?: string | null, role?: string | null) {
  if (role?.toLowerCase() === "admin") return true
  if (!email) return false

  const normalized = email.toLowerCase()
  return (
    ADMIN_EMAILS.includes(normalized) ||
    ADMIN_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`))
  )
}

export default async function AdminCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const session = await auth()
  if (!isAdminUser(session?.user?.email, session?.user?.role)) {
    notFound()
  }

  const { slug } = await params
  const key = slug[0]
  const page = adminPages[key] ?? {
    title: "Admin",
    description: "This admin page is not yet available.",
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={<Badge variant="secondary">Coming soon</Badge>}
      />
      <Card>
        <CardHeader>
          <CardTitle>{page.title}</CardTitle>
          <CardDescription>Admin settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <div className="relative">
              <div aria-hidden="true" className="absolute -inset-3 rounded-full border border-dashed border-border" />
              <div className="relative flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Settings aria-hidden="true" className="size-5" />
              </div>
            </div>
            <div className="mt-2 max-w-sm space-y-1">
              <h2 className="text-base font-semibold tracking-tight">Coming soon</h2>
              <p className="text-sm text-muted-foreground">
                This feature is under development and will be available in a future update.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
