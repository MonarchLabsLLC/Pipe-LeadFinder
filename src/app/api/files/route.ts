import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const folder = searchParams.get("folder")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (folder) where.folder = folder

  const files = await prisma.fileUpload.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(files)
}
