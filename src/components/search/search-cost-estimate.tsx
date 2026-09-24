"use client"

import { Coins, TriangleAlert } from "lucide-react"
import type { SearchType } from "@/generated/prisma/enums"
import { useCredits } from "@/contexts/credits-context"
import { usePipeLeadsPricing } from "@/hooks/usePipeLeadsPricing"
import {
  formatDisplayCredits,
  getPipeLeadsCreditCost,
  getScaledDisplayCredits,
} from "@/lib/pipeleads-credit-pricing"
import { estimateSearchCost } from "@/lib/search-summary"
import { SEARCH_GUIDE_BY_TYPE } from "@/components/search/search-guide"

/**
 * The worst-case cost of a search, shown under the submit button:
 * "Up to 25 results × 50 credits = 1,250 credits." It updates as the limit
 * changes, and warns (without blocking — the server guard does that) when
 * the worst case is more than the balance.
 */
export function SearchCostEstimate({
  searchType,
  resultsLimit,
}: {
  searchType: SearchType
  resultsLimit: unknown
}) {
  const guide = SEARCH_GUIDE_BY_TYPE[searchType]
  const { pricingMap } = usePipeLeadsPricing()
  const { balance, purchaseUrl } = useCredits()
  const perResult = getScaledDisplayCredits(getPipeLeadsCreditCost(guide.creditAction, pricingMap))
  const estimate = estimateSearchCost(perResult, resultsLimit, balance?.availableCredits)

  return (
    <div className="mt-3 space-y-2" aria-live="polite">
      <p className="flex items-start gap-2 text-xs text-muted-foreground sm:justify-end sm:text-right">
        <Coins className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          Up to{" "}
          <span className="font-medium text-foreground tabular-nums">
            {estimate.maxResults} results × {formatDisplayCredits(estimate.creditsPerResult)} credits ={" "}
            {formatDisplayCredits(estimate.maxCredits)} credits
          </span>
          . You&apos;re only charged for results we find.
          {guide.costNote ? ` ${guide.costNote}` : null}
        </span>
      </p>
      {estimate.exceedsBalance && balance ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
          <p>
            You have {formatDisplayCredits(balance.availableCredits)} credits. If this search
            finds every result it will cost more than that.{" "}
            <a
              href={purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Add credits in your Credit Wallet
            </a>
          </p>
        </div>
      ) : null}
    </div>
  )
}
