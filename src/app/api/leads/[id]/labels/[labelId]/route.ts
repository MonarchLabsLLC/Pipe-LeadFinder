import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/leads/[id]/labels/[labelId] — remove a label from a lead entry
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: leadId, labelId } = await params

  // Find the entry label, ensuring the label belongs to this user
  const entryLabel = await prisma.leadEntryLabel.findFirst({
    where: {
      labelId,
      entry: { leadId },
      label: { userId: session.user.id },
    },
  })

  if (!entryLabel) {
    return NextResponse.json(
      { error: "Label assignment not found" },
      { status: 404 }
    )
  }

  await prisma.leadEntryLabel.delete({
    where: { id: entryLabel.id },
  })

  return NextResponse.json({ success: true })
}
