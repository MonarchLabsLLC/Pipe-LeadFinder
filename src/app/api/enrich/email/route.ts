import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { enrichEmail } from "@/services/enrich-service"
import { guardCredits, deductCredits } from "@/lib/credit-guard"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { leadId } = body as { leadId?: string }

  if (!leadId || typeof leadId !== "string") {
    return NextResponse.json(
      { error: "leadId is required" },
      { status: 400 }
    )
  }

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  // Verify lead exists
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  try {
    const updated = await enrichEmail(leadId)

    // Only charge if we actually found something
    if (updated.emailStatus === "FOUND" || updated.emailStatus === "POTENTIAL") {
      deductCredits(session.user.id, "enrich:email", 1, { leadId })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Email enrichment failed:", error)
    return NextResponse.json(
      { error: "Email enrichment failed" },
      { status: 500 }
    )
  }
}
