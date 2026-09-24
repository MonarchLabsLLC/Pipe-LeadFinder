import { describe, expect, it } from "vitest"
import {
  creditsTone,
  lowBalanceThreshold,
  searchPriceList,
} from "./credits-status"
import type { PipeLeadsPricingMap } from "./pipeleads-credit-pricing"

const livePricing: PipeLeadsPricingMap = {
  "search:people": {
    model: "pipeleads.search.people",
    action: "search:people",
    label: "People",
    unit: "contact",
    usdPerHit: 0.4,
    multiplier: 1,
    creditsPerHit: 80,
    configured: true,
    updatedAt: null,
  },
}

describe("lowBalanceThreshold", () => {
  it("is 25 People results at the default price", () => {
    expect(lowBalanceThreshold()).toBe(1250)
    expect(lowBalanceThreshold(null)).toBe(1250)
  })

  it("follows the live People price", () => {
    expect(lowBalanceThreshold(livePricing)).toBe(2000)
  })
})

describe("creditsTone", () => {
  it("is empty at or below zero", () => {
    expect(creditsTone(0, 1250)).toBe("empty")
    expect(creditsTone(-40, 1250)).toBe("empty")
  })

  it("is low below the threshold", () => {
    expect(creditsTone(1, 1250)).toBe("low")
    expect(creditsTone(1249, 1250)).toBe("low")
  })

  it("is normal at or above the threshold", () => {
    expect(creditsTone(1250, 1250)).toBe("normal")
    expect(creditsTone(273_281, 1250)).toBe("normal")
  })
})

describe("searchPriceList", () => {
  it("lists every search type, live price first, default otherwise", () => {
    const rows = searchPriceList(livePricing)
    expect(rows.map((r) => r.label)).toEqual([
      "People",
      "Local",
      "Company",
      "Domain",
      "Influencer",
    ])
    expect(rows[0].credits).toBe(80)
    expect(rows[1].credits).toBe(25)
  })
})
