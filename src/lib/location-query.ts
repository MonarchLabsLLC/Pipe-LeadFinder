/** Worldwide place search. Country is not pinned; influencer search reads it back. */
export function nominatimSearchUrl(query: string): string {
  return `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5`
}
