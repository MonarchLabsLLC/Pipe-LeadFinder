import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encryptIntegrationSecret } from "@/lib/integration-crypto"
import { assertSafePublicUrl } from "@/lib/safe-url"
import { createIntegrationSchema } from "@/lib/validators/integration"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const connections = await prisma.integrationConnection.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, type: true, url: true, enabled: true, createdAt: true, updatedAt: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(connections)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = createIntegrationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration", details: parsed.error.flatten() }, { status: 400 })
  try {
    await assertSafePublicUrl(parsed.data.url)
    const connection = await prisma.integrationConnection.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        url: parsed.data.url,
        ...encryptIntegrationSecret(parsed.data.secret),
      },
      select: { id: true, name: true, type: true, url: true, enabled: true, createdAt: true },
    })
    return NextResponse.json(connection, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Integration could not be created" }, { status: 400 })
  }
}
