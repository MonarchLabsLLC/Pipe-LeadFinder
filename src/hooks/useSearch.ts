import { useMutation } from "@tanstack/react-query"
import { SearchType } from "@/generated/prisma/enums"

const SEARCH_ENDPOINTS: Record<SearchType, string> = {
  PEOPLE: "/api/search/people",
  LOCAL: "/api/search/local",
  COMPANY: "/api/search/company",
  DOMAIN: "/api/search/domain",
  INFLUENCER: "/api/search/influencer",
}

export function useSearchMutation() {
  return useMutation({
    mutationFn: async ({
      type,
      params,
    }: {
      type: SearchType
      params: Record<string, unknown>
    }) => {
      const res = await fetch(SEARCH_ENDPOINTS[type], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Search failed")
      }
      return res.json()
    },
  })
}
