/** The plugin credit rules (dashboard review list S1), without a database. */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/server/focused-agent/pricing", () => ({ requireCredits: async () => 0 }))

import { capDecision, monthStart, pluginCreditShortfall } from "./credits"

describe("a plugin never takes the balance below zero", () => {
  it("needs the whole maximum cost in the balance", () => {
    expect(pluginCreditShortfall(100, 100)).toBeNull()
    expect(pluginCreditShortfall(100, 0)).toBeNull()
    expect(pluginCreditShortfall(0, 0)).toBeNull()
    expect(pluginCreditShortfall(99, 100)).toMatch(/needs up to 100 Scale Credits and the balance is 99/)
    expect(pluginCreditShortfall(0, 1)).toMatch(/never takes the balance below zero/)
    expect(pluginCreditShortfall(-5, 0)).toMatch(/negative/)
    expect(pluginCreditShortfall(Number.NaN, 0)).toMatch(/could not be read/)
  })
})

describe("the monthly cap for unattended work", () => {
  it("no cap: never unattended", () => {
    expect(capDecision({ cap: null, used: 0, cost: 0 })).toEqual({ ok: false, reason: "no_cap" })
  })

  it("counts the maximum cost of each run, up to the cap and not past it", () => {
    expect(capDecision({ cap: 100, used: 0, cost: 100 })).toEqual({ ok: true, remaining: 0 })
    expect(capDecision({ cap: 100, used: 60, cost: 40 })).toEqual({ ok: true, remaining: 0 })
    expect(capDecision({ cap: 100, used: 60, cost: 41 })).toEqual({ ok: false, reason: "cap_reached" })
    expect(capDecision({ cap: 100, used: 60, cost: 39.2 })).toEqual({ ok: true, remaining: 0 })
  })

  it("resets on the first of the month, UTC", () => {
    expect(monthStart(new Date("2026-11-21T23:59:59.000Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z")
    expect(monthStart(new Date("2026-12-01T00:00:00.000Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z")
  })
})
