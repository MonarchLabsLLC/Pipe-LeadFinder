import { describe, expect, it } from "vitest"
import { formatLocationResult } from "./location-label"

describe("formatLocationResult", () => {
  it("shows the country Singapore as Singapore", () => {
    expect(
      formatLocationResult({
        display_name: "Singapore",
        address: { country: "Singapore", country_code: "sg" },
      })
    ).toBe("Singapore")
  })

  it("never lets a US town pass for a country", () => {
    const label = formatLocationResult({
      display_name: "Singapore, Wood Heights, Ray County, Missouri, United States",
      address: { village: "Singapore", county: "Ray County", state: "Missouri", country: "United States", country_code: "us" },
    })
    expect(label).toBe("Singapore, Missouri")
  })

  it("keeps the familiar US city, state and ZIP form", () => {
    expect(
      formatLocationResult({
        display_name: "Austin, Travis County, Texas, 78701, United States",
        address: { city: "Austin", state: "Texas", postcode: "78701", country: "United States", country_code: "us" },
      })
    ).toBe("Austin, Texas 78701")
  })

  it("names the country for places outside the US", () => {
    expect(
      formatLocationResult({
        display_name: "London, Greater London, England, United Kingdom",
        address: { city: "London", state: "England", country: "United Kingdom", country_code: "gb" },
      })
    ).toBe("London, England, United Kingdom")
  })

  it("falls back to the full name when there is no address", () => {
    expect(formatLocationResult({ display_name: "Somewhere, Far Away" })).toBe("Somewhere, Far Away")
  })
})
