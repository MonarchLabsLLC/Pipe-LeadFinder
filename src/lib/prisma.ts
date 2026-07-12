import { readFileSync, existsSync } from "fs"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { PoolConfig } from "pg"

/** DO managed Postgres CA on this infrastructure — same path and rules as HighTicketGPT / chatbaserai `server/db.ts`. */
const CA_CERT_PATH = "/etc/ssl/digitalocean/ca-certificate.crt"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getSslConfig(): PoolConfig["ssl"] {
  const isLocalhost = process.env.DATABASE_URL?.includes("localhost")
  if (isLocalhost) return false
  if (existsSync(CA_CERT_PATH)) {
    return { ca: readFileSync(CA_CERT_PATH, "utf-8"), rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}

export function getDatabaseConfig() {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error("DATABASE_URL is required")

  const url = new URL(value)
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const schema = url.searchParams.get("schema") || (isLocalhost ? "pipeleads" : "public")
  url.searchParams.delete("schema")
  url.searchParams.delete("sslmode")

  return { connectionString: url.toString(), schema }
}

function createPrismaClient() {
  const { connectionString, schema } = getDatabaseConfig()
  const adapter = new PrismaPg({
    connectionString,
    ssl: getSslConfig(),
  }, { schema })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
