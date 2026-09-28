import { describe, expect, it } from "vitest"
import {
  buildInstagramInfluencerInput,
  buildTikTokInfluencerInput,
} from "./search-service"

const baseParams = {
  description: "fitness coaches",
  location: "Austin, Texas",
  resultsLimit: 10,
  followersFrom: 10_000,
  followersTo: 100_000,
  hashtags: ["fitness", "wellness"],
}

describe("influencer provider inputs", () => {
  it("uses Apify's Instagram profile-search contract", () => {
    expect(buildInstagramInfluencerInput(baseParams)).toEqual({
      search: "fitness coaches fitness wellness Austin, Texas",
      searchType: "user",
      searchLimit: 10,
    })
  })

  it("uses the TikTok discovery actor's keyword and qualification inputs", () => {
    expect(buildTikTokInfluencerInput({
      ...baseParams,
      engagementRate: 3,
      language: "en",
      verified: true,
    })).toEqual({
      keywords: ["fitness coaches Austin, Texas"],
      hashtags: ["fitness", "wellness"],
      maxCreators: 10,
      minFollowers: 10_000,
      maxFollowers: 100_000,
      verifiedOnly: true,
      languages: ["en"],
      countryCodes: ["US"],
      countryMatchMode: "best_effort",
      region: "US",
      enrichBio: true,
      followBioLinks: true,
      includePerformance: true,
      campaignBrief: "fitness coaches in Austin, Texas",
      sortBy: "qualificationScore",
    })
  })

  it("searches Singapore as a TikTok region instead of a US keyword", () => {
    expect(buildTikTokInfluencerInput({
      description: "dentists",
      location: "Singapore",
      resultsLimit: 25,
    })).toEqual({
      keywords: ["dentists"],
      hashtags: undefined,
      maxCreators: 25,
      minFollowers: undefined,
      maxFollowers: undefined,
      verifiedOnly: undefined,
      languages: undefined,
      countryCodes: ["SG"],
      countryMatchMode: "best_effort",
      region: "SG",
      enrichBio: true,
      followBioLinks: true,
      includePerformance: false,
      campaignBrief: "dentists in Singapore",
      sortBy: "qualificationScore",
    })
  })
})
