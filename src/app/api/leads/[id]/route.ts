import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { publicLead } from "@/lib/public-lead"

type RouteContext = { params: Promise<{ id: string }> }

const updateLeadSchema = z.object({
  email: z.string().trim().email().max(320).nullable().optional(),
  emailStatus: z.enum(["UNKNOWN", "FOUND", "NOT_FOUND", "POTENTIAL"]).optional(),
  phone: z.string().trim().min(1).max(50).nullable().optional(),
  phoneStatus: z.enum(["UNKNOWN", "FOUND", "NOT_FOUND"]).optional(),
}).strict()

// PATCH /api/leads/[id] - update editable contact fields for an owned lead.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const parsed = updateLeadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const lead = await prisma.lead.findFirst({
    where: session.user.role === "admin"
      ? { id }
      : { id, listEntries: { some: { list: { userId: session.user.id } } } },
  })

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  )

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "At least one editable field is required" },
      { status: 400 }
    )
  }

  if ("email" in data && !("emailStatus" in data)) {
    data.emailStatus = data.email ? "FOUND" : "NOT_FOUND"
  }
  if ("phone" in data && !("phoneStatus" in data)) {
    data.phoneStatus = data.phone ? "FOUND" : "NOT_FOUND"
  }

  const resultingEmail = "email" in data ? data.email : lead.email
  const resultingPhone = "phone" in data ? data.phone : lead.phone
  if (data.emailStatus === "FOUND" && !resultingEmail) {
    return NextResponse.json(
      { error: "An email is required when email status is FOUND" },
      { status: 400 }
    )
  }
  if (data.phoneStatus === "FOUND" && !resultingPhone) {
    return NextResponse.json(
      { error: "A phone number is required when phone status is FOUND" },
      { status: 400 }
    )
  }

  const updated = await prisma.lead.update({
    where: { id },
    data,
  })

  return NextResponse.json(publicLead(updated))
}
