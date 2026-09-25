export function buildTikTokInfluencerInput(params: Record<string, unknown>) {
  const hashtags = cleanArray(params.hashtags)
  const niche = [asString(params.description), asString(params.category)]
    .filter(Boolean)
    .join(" ")
  const location = asString(params.location)
  const place = resolveTikTokPlace(location)
  const query = [niche, place.keywordHint].filter(Boolean).join(" ")
    || (hashtags.length ? hashtags.join(" ") : "")
  if (!query) throw new Error("Influencer search requires a niche or description")

  const { min, max } = influencerFollowerBounds(params)
  const minimumEngagement = asNumber(params.engagementRate)
  const language = asString(params.language)

  return {
    keywords: [query],
    hashtags: hashtags.length ? hashtags : undefined,
    maxCreators: getResultLimit(params.resultsLimit, 50, 10),
    minFollowers: min,
    maxFollowers: max,
    verifiedOnly: params.verified === true ? true : undefined,
    languages: language && language !== "any" ? [language] : undefined,
    countryCodes: place.countryCode ? [place.countryCode] : undefined,
    countryMatchMode: place.countryCode ? "best_effort" : undefined,
    region: place.region,
    enrichBio: true,
    followBioLinks: true,
    includePerformance: minimumEngagement !== undefined,
    campaignBrief: location ? `${niche || query} in ${location}` : query,
    sortBy: "qualificationScore",
  }
}
