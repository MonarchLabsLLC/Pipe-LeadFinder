import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const removeLabelSchema = z.object({
  entryId: z.string().min(1),
  labelId: z.string().min(1),
})

// POST /api/labels/remove — remove a label from a lead list entry
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = removeLabelSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { entryId, labelId } = parsed.data

  // Verify the label belongs to the user
  const label = await prisma.customLabel.findFirst({
    where: { id: labelId, userId: session.user.id },
  })

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 })
  }

  // Delete the LeadEntryLabel record
  const deleted = await prisma.leadEntryLabel.deleteMany({
    where: { entryId, labelId },
  })

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Label was not applied to this entry" },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
