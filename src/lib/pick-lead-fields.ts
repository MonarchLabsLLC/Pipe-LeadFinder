// Pick only valid Lead model fields from normalized search results
// Prevents Prisma from receiving unknown or nested fields

const LEAD_STRING_FIELDS = [
  "firstName", "lastName", "fullName", "title", "headline", "avatarUrl",
  "city", "state", "country", "location",
  "email", "phone",
  "linkedinUrl", "facebookUrl", "twitterUrl", "instagramUrl", "tiktokUrl", "youtubeUrl",
  "companyName", "companyWebsite", "companyLinkedin", "companySize", "companyRevenue", "companyIndustry",
  "platform", "username", "bio",
] as const

export function pickLeadFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const field of LEAD_STRING_FIELDS) {
    const val = data[field]
    if (typeof val === "string" && val.length > 0) {
      result[field] = val
    }
  }

  // Numeric fields
  if (typeof data.followerCount === "number") result.followerCount = data.followerCount
  if (typeof data.engagementRate === "number") result.engagementRate = data.engagementRate

  // JSON field
  if (data.rawData !== undefined) result.rawData = data.rawData

  return result
}
