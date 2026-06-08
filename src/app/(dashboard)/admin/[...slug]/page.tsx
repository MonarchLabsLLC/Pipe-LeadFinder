import { notFound } from "next/navigation"
import { Settings } from "lucide-react"
import { auth } from "@/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

function isAdminUser(email?: string | null, role?: string | null) {
  if (role === "admin") return true
  if (!email) return false

  const normalized = email.toLowerCase()
  return (
    ADMIN_EMAILS.includes(normalized) ||
    ADMIN_DOMAINS.some((domain) => normalized.endsWith(domain))
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
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          <Settings className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {page.title}
          </h1>
          <Badge variant="secondary">Coming Soon</Badge>
          <p className="text-muted-foreground">{page.description}</p>
          <p className="text-sm text-muted-foreground/70">
            This feature is under development and will be available in a
            future update.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
