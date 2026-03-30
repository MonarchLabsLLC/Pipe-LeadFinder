import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { enrichPhone } from "@/services/enrich-service"

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

  // Verify lead exists
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  try {
    const updated = await enrichPhone(leadId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Phone enrichment failed:", error)
    return NextResponse.json(
      { error: "Phone enrichment failed" },
      { status: 500 }
    )
  }
}
