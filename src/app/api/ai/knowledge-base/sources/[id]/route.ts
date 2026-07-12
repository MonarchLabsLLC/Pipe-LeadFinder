import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { deleteFromSpaces } from "@/lib/storage"

// DELETE /api/ai/knowledge-base/sources/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership: source -> profile -> user
  const source = await prisma.dataSource.findUnique({
    where: { id },
    include: {
      profile: { select: { userId: true } },
      fileUpload: true,
    },
  })

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (source.profile.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.dataSource.delete({ where: { id } })
    if (source.fileUploadId) {
      await tx.fileUpload.delete({ where: { id: source.fileUploadId } })
    }
  })
  if (source.fileUpload) {
    await deleteFromSpaces(source.fileUpload.storageKey).catch((error) => {
      console.error("Failed to delete knowledge-base object", error)
    })
  }
  return NextResponse.json({ success: true })
}
