import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

async function authorizedList(id: string, userId: string) {
  return prisma.leadList.findFirst({ where: { id, userId } })
}

function escapeCsvField(value: string | null | undefined): string {
  if (value == null || value === "") return ""
  const str = String(value)
  // Prevent spreadsheet applications from interpreting exported lead data as
  // a formula when a cell begins with a formula control character.
  const safe = /^\s*[=+\-@]/.test(str) ? `'${str}` : str
  // Wrap in double quotes if the field contains commas, quotes, or newlines
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

// GET /api/lists/[id]/export — download CSV of all leads in the list
// No credit charge for CSV export
export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "GET",
    path: "/api/lists/[id]/export",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id } = await context.params

  const list = await authorizedList(id, scope.tenantUserId)

  if (!list) {
    return new Response("List not found", { status: 404 })
  }

  const entries = await prisma.leadListEntry.findMany({
    where: { listId: id },
    include: {
      lead: true,
      labels: {
        include: { label: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const headers = [
    "Full Name",
    "First Name",
    "Last Name",
    "Title",
    "Email",
    "Email Status",
    "Phone",
    "Phone Status",
    "Company",
    "Company Website",
    "Company LinkedIn",
    "Industry",
    "Location",
    "City",
    "State",
    "Country",
    "LinkedIn",
    "Facebook",
    "Instagram",
    "Twitter",
    "Labels",
    "Created At",
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = entries.map((entry: any) => {
    const lead = entry.lead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const labels = entry.labels.map((l: any) => l.label.name).join("; ")
    return [
      lead.fullName,
      lead.firstName,
      lead.lastName,
      lead.title,
      lead.email,
      lead.emailStatus,
      lead.phone,
      lead.phoneStatus,
      lead.companyName,
      lead.companyWebsite,
      lead.companyLinkedin,
      lead.companyIndustry,
      lead.location,
      lead.city,
      lead.state,
      lead.country,
      lead.linkedinUrl,
      lead.facebookUrl,
      lead.instagramUrl,
      lead.twitterUrl,
      labels,
      lead.createdAt?.toISOString() ?? "",
    ].map(escapeCsvField)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const csv = [headers.map(escapeCsvField).join(","), ...rows.map((r: any) => r.join(","))].join("\r\n")

  // Sanitize list name for use in filename
  const safeName = list.name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "leads"
  const filename = `${safeName}-leads.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

// POST /api/lists/[id]/export — export only selected leads in ScaleMail's
// contact-import column format.
export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  const scope = await resolveWorkspaceScope(session, {
    method: "POST",
    path: "/api/lists/[id]/export",
  })
  if (!scope.ok) {
    return scope.response
  }
  const { id } = await context.params
  const list = await authorizedList(id, scope.tenantUserId)
  if (!list) return new Response("List not found", { status: 404 })
  const body = await req.json().catch(() => null)
  const rawEntryIds: unknown[] = Array.isArray(body?.entryIds) ? body.entryIds : []
  const entryIds: string[] = [
    ...new Set(rawEntryIds.filter((value): value is string => typeof value === "string")),
  ]
  if (!entryIds.length || entryIds.length > 100) {
    return new Response("Select between 1 and 100 leads", { status: 400 })
  }
  const entries = await prisma.leadListEntry.findMany({
    where: { id: { in: entryIds }, listId: id },
    include: { lead: true },
    orderBy: { createdAt: "desc" },
  })
  if (entries.length !== entryIds.length) return new Response("Invalid lead selection", { status: 400 })

  const headers = ["email", "first_name", "last_name", "full_name", "phone", "company", "job_title", "website", "linkedin_url"]
  const rows = entries.map(({ lead }) => [
    lead.email,
    lead.firstName,
    lead.lastName,
    lead.fullName,
    lead.phone,
    lead.companyName,
    lead.title,
    lead.companyWebsite,
    lead.linkedinUrl,
  ].map(escapeCsvField))
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n")
  const safeName = list.name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "leads"
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeName}-scalemail.csv"`,
    },
  })
}
