import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/labels/[id] — delete a label (cascade deletes LeadEntryLabel entries)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify label belongs to current user
  const label = await prisma.customLabel.findUnique({
    where: { id },
  })

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 })
  }

  if (label.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Delete label — cascade will remove LeadEntryLabel entries (defined in schema)
  await prisma.customLabel.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
