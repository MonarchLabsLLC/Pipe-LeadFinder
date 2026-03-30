import { prisma } from "@/lib/prisma"

export async function ensureUser(session: {
  user?: { id?: string; email?: string | null; name?: string | null; role?: string }
}) {
  const id = session.user?.id
  const email = session.user?.email
  if (!id || !email) return null

  const existing = await prisma.user.findUnique({ where: { id } })
  if (existing) return existing

  return prisma.user.create({
    data: {
      id,
      email,
      name: session.user?.name ?? undefined,
      role: session.user?.role ?? "user",
    },
  })
}
