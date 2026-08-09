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
      keywords: ["fitness coaches fitness wellness Austin, Texas"],
      hashtags: ["fitness", "wellness"],
      maxCreators: 10,
      minFollowers: 10_000,
      maxFollowers: 100_000,
      verifiedOnly: true,
      languages: ["en"],
      enrichBio: true,
      includePerformance: true,
      campaignBrief: "fitness coaches fitness wellness Austin, Texas",
      sortBy: "qualificationScore",
    })
  })
})
