// The TikTok influencer actor (coregent/tiktok-influencer-finder) discovers
// hashtags in `region`, which defaults to US, and filters with `countryCodes`.
// Putting the country name into the keyword instead makes the phrase so
// specific that non-US searches, Singapore included, come back almost empty.
// Country on a returned profile is often null, so the actor must be asked for
// `best_effort` (keep unknowns) rather than strict, or the same searches
// collapse again.

const DISCOVERY_REGIONS = new Set(["US", "GB", "FR", "JP", "VN", "SG"])

const US_STATES = new Set([
  "alabama", "al", "alaska", "ak", "arizona", "az", "arkansas", "ar",
  "california", "ca", "colorado", "co", "connecticut", "ct", "delaware", "de",
  "district of columbia", "washington dc", "washington d.c", "dc",
  "florida", "fl", "georgia", "ga", "hawaii", "hi", "idaho", "id",
  "illinois", "il", "indiana", "in", "iowa", "ia", "kansas", "ks",
  "kentucky", "ky", "louisiana", "la", "maine", "me", "maryland", "md",
  "massachusetts", "ma", "michigan", "mi", "minnesota", "mn", "mississippi", "ms",
  "missouri", "mo", "montana", "mt", "nebraska", "ne", "nevada", "nv",
  "new hampshire", "nh", "new jersey", "nj", "new mexico", "nm", "new york", "ny",
  "north carolina", "nc", "north dakota", "nd", "ohio", "oh", "oklahoma", "ok",
  "oregon", "or", "pennsylvania", "pa", "rhode island", "ri", "south carolina", "sc",
  "south dakota", "sd", "tennessee", "tn", "texas", "tx", "utah", "ut",
  "vermont", "vt", "virginia", "va", "washington", "wa", "west virginia", "wv",
  "wisconsin", "wi", "wyoming", "wy",
])

const COUNTRY_CODES: Record<string, string> = {
  singapore: "SG",
  "republic of singapore": "SG",
  sg: "SG",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
  america: "US",
  "united kingdom": "GB",
  uk: "GB",
  britain: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  france: "FR",
  japan: "JP",
  vietnam: "VN",
  "viet nam": "VN",
  australia: "AU",
  canada: "CA",
  india: "IN",
  malaysia: "MY",
  indonesia: "ID",
  philippines: "PH",
  thailand: "TH",
  china: "CN",
  "hong kong": "HK",
  taiwan: "TW",
  "south korea": "KR",
  korea: "KR",
  germany: "DE",
  deutschland: "DE",
  netherlands: "NL",
  holland: "NL",
  belgium: "BE",
  switzerland: "CH",
  austria: "AT",
  ireland: "IE",
  "new zealand": "NZ",
  "united arab emirates": "AE",
  uae: "AE",
  dubai: "AE",
  "saudi arabia": "SA",
  qatar: "QA",
  brazil: "BR",
  mexico: "MX",
  spain: "ES",
  italy: "IT",
  portugal: "PT",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  poland: "PL",
  "south africa": "ZA",
  nigeria: "NG",
  kenya: "KE",
  egypt: "EG",
  israel: "IL",
  turkey: "TR",
  turkiye: "TR",
  greece: "GR",
  "czech republic": "CZ",
  czechia: "CZ",
  romania: "RO",
  hungary: "HU",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  peru: "PE",
  pakistan: "PK",
  bangladesh: "BD",
  "sri lanka": "LK",
  nepal: "NP",
}

export interface TikTokPlace {
  /** ISO 3166-1 alpha-2, when the location names a country or a US state. */
  countryCode?: string
  /** Actor discovery region. Only US, GB, FR, JP, VN and SG are supported. */
  region?: string
  /**
   * City or other place text to keep in the keyword. Country names are omitted
   * so "Singapore" is a filter, not an extra required word.
   */
  keywordHint?: string
}

function cleanedPart(part: string): string {
  return part.replace(/\b\d{4,10}(?:-\d{4})?\b/g, " ").replace(/\s+/g, " ").trim()
}

function normalizePart(part: string): string {
  return part.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

export function resolveTikTokPlace(location: string | undefined): TikTokPlace {
  const text = location?.trim()
  if (!text) return {}

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean)
  let countryCode: string | undefined
  const hints: string[] = []

  for (const part of parts) {
    const cleaned = cleanedPart(part)
    const normalized = normalizePart(cleaned)
    if (!normalized) continue

    // State abbreviations such as IN and CA must win over India and Canada.
    if (US_STATES.has(normalized)) {
      countryCode ??= "US"
      hints.push(cleaned)
      continue
    }

    const country = COUNTRY_CODES[normalized]
    if (country) {
      countryCode ??= country
      continue
    }

    hints.push(cleaned)
  }

  if (!countryCode) return { keywordHint: text }

  const keywordHint = hints.filter(Boolean).join(", ")
  const place: TikTokPlace = { countryCode }
  if (DISCOVERY_REGIONS.has(countryCode)) place.region = countryCode
  if (keywordHint) place.keywordHint = keywordHint
  return place
}
