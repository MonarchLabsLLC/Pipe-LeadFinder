import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
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
  const scope = await resolveWorkspaceScope(session, {
    method: "DELETE",
    path: "/api/labels/[id]",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id } = await params

  // Verify label belongs to current user
  const label = await prisma.customLabel.findUnique({
    where: { id },
  })

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 })
  }

  if (label.userId !== scope.tenantUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Delete label — cascade will remove LeadEntryLabel entries (defined in schema)
  await prisma.customLabel.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
