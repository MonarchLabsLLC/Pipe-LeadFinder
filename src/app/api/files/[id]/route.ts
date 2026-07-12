import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { deleteFromSpaces } from "@/lib/storage"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const file = await prisma.fileUpload.findUnique({ where: { id } })
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
  if (file.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(file)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const file = await prisma.fileUpload.findUnique({ where: { id } })
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
  if (file.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Remove the database record first so an object-storage outage cannot leave
  // the application pointing at a file that no longer exists.
  await prisma.fileUpload.delete({ where: { id } })
  await deleteFromSpaces(file.storageKey).catch((error) => {
    console.error("[Files] Failed to delete orphaned storage object:", error)
  })

  return NextResponse.json({ success: true })
}
