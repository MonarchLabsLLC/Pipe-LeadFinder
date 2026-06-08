#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadDotEnv(file = ".env") {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return

  const content = readFileSync(path, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue

    const value = rawValue
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
    process.env[key] = value
  }
}

loadDotEnv()

const baseUrl = process.env.BASE_URL || process.env.AUTH_URL || process.env.APP_URL
const secret = process.env.PIPELEADS_AGENT_CRON_SECRET

if (!baseUrl) {
  console.error("BASE_URL, AUTH_URL, or APP_URL is required")
  process.exit(1)
}

if (!secret) {
  console.error("PIPELEADS_AGENT_CRON_SECRET is required")
  process.exit(1)
}

const url = new URL("/api/ai/agent/run-scheduled", baseUrl)

const res = await fetch(url, {
  method: "POST",
  headers: {
    "x-cron-secret": secret,
  },
})

const body = await res.text()
if (!res.ok) {
  console.error(`Scheduled agent run failed with HTTP ${res.status}`)
  console.error(body)
  process.exit(1)
}

console.log(body)
