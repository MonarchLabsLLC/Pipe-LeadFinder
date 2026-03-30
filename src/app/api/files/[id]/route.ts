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

  // Delete from DO Spaces first, then remove DB record
  await deleteFromSpaces(file.storageKey)
  await prisma.fileUpload.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
