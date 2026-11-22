export interface LocationSearchResult {
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    state?: string
    postcode?: string
    county?: string
    country?: string
    country_code?: string
  }
}

/**
 * The label a location suggestion shows and fills in. US places keep the
 * familiar "City, State ZIP" form; every other place names its country, so a
 * town that shares a country's name can't be mistaken for that country.
 */
export function formatLocationResult(result: LocationSearchResult): string {
  const address = result.address
  const parts = result.display_name.split(",").map((part) => part.trim()).filter(Boolean)
  if (!address) return parts.join(", ")

  const city = address.city || address.town || address.village || ""
  const state = address.state || ""
  const country = address.country || ""
  const isUS = address.country_code?.toLowerCase() === "us" || country === "United States"

  if (isUS) {
    if (city && state) return `${city}, ${state}${address.postcode ? ` ${address.postcode}` : ""}`
    if (parts.length <= 1) return parts.join(", ")
    const head = parts.slice(0, 2)
    return state && !head.includes(state) ? [...head, state].join(", ") : head.join(", ")
  }

  const named = [city, state, country].filter(Boolean)
  const unique = named.filter((value, index) => named.indexOf(value) === index)
  if (unique.length) return unique.join(", ")
  return parts.join(", ")
}
