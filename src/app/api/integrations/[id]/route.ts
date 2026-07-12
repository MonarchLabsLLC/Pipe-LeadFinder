import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await prisma.integrationConnection.deleteMany({
    where: { id: (await params).id, userId: session.user.id },
  })
  if (!result.count) return NextResponse.json({ error: "Integration not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
