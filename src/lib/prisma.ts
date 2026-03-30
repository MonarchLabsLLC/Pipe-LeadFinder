import { readFileSync, existsSync } from "fs"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { PoolConfig } from "pg"

/** DO managed Postgres CA on this infrastructure — same path and rules as HighTicketGPT / chatbaserai `server/db.ts`. */
const CA_CERT_PATH = "/etc/ssl/digitalocean/ca-certificate.crt"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getSslConfig(): PoolConfig["ssl"] {
  const isLocalhost = process.env.DATABASE_URL?.includes("localhost")
  if (isLocalhost) return false
  if (existsSync(CA_CERT_PATH)) {
    return { ca: readFileSync(CA_CERT_PATH, "utf-8"), rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}

function getConnectionString(): string {
  return process.env.DATABASE_URL!.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "")
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getConnectionString(),
    ssl: getSslConfig(),
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
