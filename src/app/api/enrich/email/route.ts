import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"
import { enrichEmail } from "@/services/enrich-service"
import { guardCredits, deductCredits } from "@/lib/credit-guard"
import { publicLead } from "@/lib/public-lead"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "POST",
    path: "/api/enrich/email",
  })
  if (!scope.ok) {
    return scope.response
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const { leadId } = body as { leadId?: string }

  if (!leadId || typeof leadId !== "string") {
    return NextResponse.json(
      { error: "leadId is required" },
      { status: 400 }
    )
  }

  // Verify the lead is reachable through one of the current user's lists.
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      listEntries: { some: { list: { userId: scope.tenantUserId } } },
    },
  })
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }
  if (lead.email && (lead.emailStatus === "FOUND" || lead.emailStatus === "POTENTIAL")) {
    return NextResponse.json(publicLead(lead))
  }

  const blocked = await guardCredits(scope.tenantUserId, scope.tenantEmail)
  if (blocked) return blocked

  try {
    const updated = await enrichEmail(leadId)

    // Only charge if we actually found something
    if (
      updated.email &&
      !lead.email &&
      (updated.emailStatus === "FOUND" || updated.emailStatus === "POTENTIAL")
    ) {
      await deductCredits(
        scope.tenantUserId,
        "enrich:email",
        1,
        { leadId },
        scope.tenantEmail
      )
    }

    return NextResponse.json(publicLead(updated))
  } catch (error) {
    console.error("Email enrichment failed:", error)
    return NextResponse.json(
      { error: "Email enrichment failed" },
      { status: 500 }
    )
  }
}
