import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

function escapeCsvField(value: string | null | undefined): string {
  if (value == null || value === "") return ""
  const str = String(value)
  // Wrap in double quotes if the field contains commas, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/lists/[id]/export — download CSV of all leads in the list
// No credit charge for CSV export
export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id } = await context.params

  const list = await prisma.leadList.findUnique({
    where: { id },
  })

  if (!list) {
    return new Response("List not found", { status: 404 })
  }

  if (list.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 })
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
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
