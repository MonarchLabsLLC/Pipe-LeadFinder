import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const applyLabelSchema = z.object({
  entryId: z.string().min(1),
  labelId: z.string().min(1),
})

// POST /api/labels/apply — apply a label to a lead list entry
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = applyLabelSchema.safeParse(body)

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

  // Check if already applied
  const existing = await prisma.leadEntryLabel.findUnique({
    where: { entryId_labelId: { entryId, labelId } },
  })

  if (existing) {
    return NextResponse.json(
      { error: "Label already applied" },
      { status: 409 }
    )
  }

  const entryLabel = await prisma.leadEntryLabel.create({
    data: { entryId, labelId },
  })

  return NextResponse.json(entryLabel, { status: 201 })
}

// DELETE /api/labels/apply — remove a label from a lead list entry
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = applyLabelSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { entryId, labelId } = parsed.data

  await prisma.leadEntryLabel.deleteMany({
    where: { entryId, labelId },
  })

  return NextResponse.json({ success: true })
}
