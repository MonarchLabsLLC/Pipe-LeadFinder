import { describe, expect, it } from "vitest"
import {
  buildAutoListName,
  estimateSearchCost,
  formatRelativeTime,
  snapResultsLimit,
  summarizeSearch,
} from "./search-summary"

const SEP_24 = new Date("2026-09-24T15:00:00Z")

describe("summarizeSearch", () => {
  it("describes each search type in plain English", () => {
    expect(summarizeSearch("LOCAL", { businessType: "dentist", location: "Tampa, FL" })).toBe(
      "Dentist · Tampa, FL"
    )
    expect(
      summarizeSearch("PEOPLE", { description: "Marketing Director", industry: "SaaS", location: "Texas" })
    ).toBe("Marketing Director · SaaS · Texas")
    expect(summarizeSearch("DOMAIN", { companyNameOrWebsite: "acme.com" })).toBe("acme.com")
    expect(
      summarizeSearch("INFLUENCER", {
        description: "fitness creators",
        platform: "instagram",
        followersFrom: 10000,
        followersTo: 100000,
      })
    ).toBe("Fitness creators · Instagram · 10k–100k followers")
    expect(summarizeSearch("COMPANY", { description: "Marketing agency", employeeCount: "11-50" })).toBe(
      "Marketing agency · 11-50 staff"
    )
  })

  it("shortens long place names and falls back when nothing was entered", () => {
    expect(
      summarizeSearch("LOCAL", {
        businessType: "Gym",
        location: "Austin, Travis County, Texas, United States",
      })
    ).toBe("Gym · Austin, Travis County")
    expect(summarizeSearch("COMPANY", {})).toBe("Company search")
    expect(summarizeSearch("PEOPLE", null)).toBe("People search")
  })
})

describe("buildAutoListName", () => {
  it("names the list from the criteria and the date", () => {
    expect(buildAutoListName("LOCAL", { businessType: "Dentists", location: "Tampa, FL" }, SEP_24)).toBe(
      "Dentists – Tampa, FL – Sep 24"
    )
  })

  it("falls back to the search type when the criteria are empty", () => {
    expect(buildAutoListName("DOMAIN", { companyNameOrWebsite: "  " }, SEP_24)).toBe(
      "Domain search – Sep 24"
    )
  })

  it("never exceeds the 100-character list name limit", () => {
    const name = buildAutoListName("PEOPLE", { description: "x".repeat(300) }, SEP_24)
    expect(name.length).toBeLessThanOrEqual(100)
    expect(name.endsWith(" – Sep 24")).toBe(true)
  })
})

describe("estimateSearchCost", () => {
  it("multiplies the limit by the price per result", () => {
    expect(estimateSearchCost(50, 100, 1_000_000)).toEqual({
      maxResults: 100,
      creditsPerResult: 50,
      maxCredits: 5_000,
      exceedsBalance: false,
    })
  })

  it("warns only when a known balance is lower than the worst case", () => {
    expect(estimateSearchCost(25, 50, 1_000).exceedsBalance).toBe(true)
    expect(estimateSearchCost(25, 40, 1_000).exceedsBalance).toBe(false)
    expect(estimateSearchCost(25, 50, null).exceedsBalance).toBe(false)
    expect(estimateSearchCost(25, 50, Infinity).exceedsBalance).toBe(false)
  })

  it("treats a missing or invalid limit as zero", () => {
    expect(estimateSearchCost(25, undefined).maxCredits).toBe(0)
    expect(estimateSearchCost(25, "abc").maxCredits).toBe(0)
  })
})

describe("formatRelativeTime", () => {
  it("says when in plain words", () => {
    const now = SEP_24
    expect(formatRelativeTime(new Date(now.getTime() - 20_000), now)).toBe("just now")
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 min ago")
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3 hr ago")
    expect(formatRelativeTime(new Date(now.getTime() - 26 * 3_600_000), now)).toBe("yesterday")
    expect(formatRelativeTime(new Date(now.getTime() - 4 * 86_400_000), now)).toBe("4 days ago")
    expect(formatRelativeTime("2026-09-02T12:00:00Z", now)).toBe("Sep 2")
  })
})

describe("snapResultsLimit", () => {
  it("rounds up to the nearest offered option and caps at the largest", () => {
    expect(snapResultsLimit(20, [10, 25, 50])).toBe(25)
    expect(snapResultsLimit(10, [10, 25, 50])).toBe(10)
    expect(snapResultsLimit(500, [10, 25, 50])).toBe(50)
    expect(snapResultsLimit(0, [10, 25, 50])).toBeUndefined()
    expect(snapResultsLimit("x", [10, 25, 50])).toBeUndefined()
  })
})
