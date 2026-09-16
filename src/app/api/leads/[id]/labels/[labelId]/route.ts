import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
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
  const scope = await resolveWorkspaceScope(session, {
    method: "DELETE",
    path: "/api/leads/[id]/labels/[labelId]",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id: leadId, labelId } = await params

  // Find the entry label, ensuring the label belongs to this user
  const entryLabel = await prisma.leadEntryLabel.findFirst({
    where: {
      labelId,
      entry: {
        leadId,
        list: { userId: scope.tenantUserId },
      },
      label: { userId: scope.tenantUserId },
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
