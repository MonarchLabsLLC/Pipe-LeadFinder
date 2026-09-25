import { describe, expect, it } from "vitest"
import { resolveTikTokPlace } from "./tiktok-place"

describe("resolveTikTokPlace", () => {
  it("maps Singapore onto the actor's SG discovery region and drops it from the keyword", () => {
    expect(resolveTikTokPlace("Singapore")).toEqual({
      countryCode: "SG",
      region: "SG",
    })
  })

  it("keeps a city and still resolves the country", () => {
    expect(resolveTikTokPlace("Austin, Texas")).toEqual({
      countryCode: "US",
      region: "US",
      keywordHint: "Austin, Texas",
    })
    expect(resolveTikTokPlace("London, United Kingdom")).toEqual({
      countryCode: "GB",
      region: "GB",
      keywordHint: "London",
    })
    expect(resolveTikTokPlace("Paris, France")).toEqual({
      countryCode: "FR",
      region: "FR",
      keywordHint: "Paris",
    })
  })

  it("strips a postal code before matching a state", () => {
    expect(resolveTikTokPlace("Austin, Texas 78701")).toEqual({
      countryCode: "US",
      region: "US",
      keywordHint: "Austin, Texas",
    })
  })

  it("filters a country the actor cannot use as a discovery region", () => {
    expect(resolveTikTokPlace("Berlin, Germany")).toEqual({
      countryCode: "DE",
      keywordHint: "Berlin",
    })
  })

  it("lets a US state abbreviation win over a country that shares the code", () => {
    expect(resolveTikTokPlace("Austin, IN")).toMatchObject({ countryCode: "US", region: "US" })
    expect(resolveTikTokPlace("Mumbai, India")).toEqual({
      countryCode: "IN",
      keywordHint: "Mumbai",
    })
  })

  it("leaves an unrecognized place in the keyword and sets no country filter", () => {
    expect(resolveTikTokPlace("Somewhereville")).toEqual({
      keywordHint: "Somewhereville",
    })
    expect(resolveTikTokPlace(undefined)).toEqual({})
  })
})
