import { describe, expect, it } from "vitest"
import { formatFollowerCount, leadProfileLinks, platformLabel, safeExternalUrl } from "./lead-profile"

describe("leadProfileLinks", () => {
  it("gives a TikTok creator a link to their profile, their platform first", () => {
    const links = leadProfileLinks({
      platform: "tiktok",
      linkedinUrl: "https://www.linkedin.com/in/someone",
      tiktokUrl: "https://www.tiktok.com/@rggaming",
      youtubeUrl: "https://www.youtube.com/@RGGaming421",
    })
    expect(links.map((link) => link.kind)).toEqual(["tiktok", "youtube", "linkedin"])
    expect(links[0]).toEqual({ kind: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@rggaming" })
  })

  it("adds https to a bare website and drops unsafe or empty values", () => {
    const links = leadProfileLinks({
      companyWebsite: "acme.com",
      facebookUrl: "javascript:alert(1)",
      twitterUrl: "  ",
      instagramUrl: null,
    })
    expect(links).toEqual([{ kind: "website", label: "Website", url: "https://acme.com/" }])
  })

  it("lists the same address once", () => {
    const links = leadProfileLinks({
      linkedinUrl: "https://www.linkedin.com/company/acme",
      companyWebsite: "https://www.linkedin.com/company/acme",
    })
    expect(links).toHaveLength(1)
  })
})

describe("safeExternalUrl", () => {
  it("accepts http and https only", () => {
    expect(safeExternalUrl("http://example.com/a")).toBe("http://example.com/a")
    expect(safeExternalUrl("ftp://example.com")).toBeNull()
    expect(safeExternalUrl("not a url")).toBeNull()
  })
})

describe("formatFollowerCount", () => {
  it("shortens large counts", () => {
    expect(formatFollowerCount(563)).toBe("563")
    expect(formatFollowerCount(1443)).toBe("1.4K")
    expect(formatFollowerCount(250_000)).toBe("250K")
    expect(formatFollowerCount(3_200_000)).toBe("3.2M")
    expect(formatFollowerCount(null)).toBeNull()
  })
})

describe("platformLabel", () => {
  it("names the creator platforms", () => {
    expect(platformLabel("tiktok")).toBe("TikTok")
    expect(platformLabel("YouTube")).toBe("YouTube")
    expect(platformLabel(null)).toBeNull()
  })
})
