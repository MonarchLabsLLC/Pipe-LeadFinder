"use client"

import * as React from "react"
import { ExternalLink, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useCredits } from "@/contexts/credits-context"
import { usePipeLeadsPricing } from "@/hooks/usePipeLeadsPricing"
import {
  LOW_BALANCE_PEOPLE_RESULTS,
  creditsTone,
  lowBalanceThreshold,
  searchPriceList,
  type CreditsTone,
} from "@/lib/credits-status"
import { formatDisplayCredits } from "@/lib/pipeleads-credit-pricing"
import { cn } from "@/lib/utils"

const TONE_TEXT: Record<CreditsTone, string> = {
  normal: "text-muted-foreground",
  low: "text-warning",
  empty: "text-danger",
}

/** How long the pointer may leave the meter before a hover-opened panel closes. */
const HOVER_CLOSE_MS = 150

/**
 * A slim credits meter pinned to the bottom of every Lead Finder screen.
 * It sits after <main> inside the inset, so it stays put while the page
 * scrolls. Hovering (or clicking, or pressing Enter) opens the details.
 */
export function CreditsStatusBar() {
  const { balance, isLoading, error, formatCredits, purchaseUrl } = useCredits()
  const { pricingMap } = usePipeLeadsPricing()

  const [open, setOpen] = React.useState(false)
  // A panel opened by hovering closes when the pointer leaves; one opened by
  // a click, tap or key stays until dismissed.
  const openedBy = React.useRef<"hover" | "click" | null>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  React.useEffect(() => clearCloseTimer, [])

  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    clearCloseTimer()
    if (!open) {
      openedBy.current = "hover"
      setOpen(true)
    }
  }
  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || openedBy.current !== "hover") return
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS)
  }

  const threshold = lowBalanceThreshold(pricingMap)
  const available = balance?.availableCredits ?? null
  const tone: CreditsTone = available === null ? "normal" : creditsTone(available, threshold)
  const unavailable = !isLoading && available === null
  const amount = available === null ? null : formatCredits(available)

  const barLabel = isLoading && available === null
    ? "Loading credits"
    : unavailable
      ? error
        ? "Credits unavailable"
        : "Credits"
      : `${amount} credits`

  return (
    <footer
      aria-label="Credit balance"
      className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-background px-3 text-xs md:px-4"
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) openedBy.current = null
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${barLabel}. Show credit details`}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onClick={(event) => {
              // Clicking a panel that hovering opened pins it instead of closing it.
              if (open && openedBy.current === "hover") event.preventDefault()
              openedBy.current = "click"
              clearCloseTimer()
            }}
            className={cn(
              "-mx-1.5 flex h-6 min-w-0 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              TONE_TEXT[tone],
              tone === "normal" ? "hover:text-foreground" : "font-medium"
            )}
          >
            <Wallet className="size-3.5 shrink-0" aria-hidden />
            {isLoading && available === null ? (
              <span className="h-2.5 w-20 animate-pulse rounded-sm bg-muted" aria-hidden />
            ) : (
              <span className="truncate tabular-nums">{barLabel}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="w-72 p-0"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          // Hovering shows the panel without pulling keyboard focus into it.
          onOpenAutoFocus={(event) => {
            if (openedBy.current === "hover") event.preventDefault()
          }}
        >
          <CreditsDetails
            amount={amount}
            consumed={balance?.consumedCredits ?? null}
            tone={tone}
            unavailable={unavailable}
            pricingRows={searchPriceList(pricingMap)}
            formatCredits={formatCredits}
            purchaseUrl={purchaseUrl}
          />
        </PopoverContent>
      </Popover>

      {tone === "empty" ? (
        <a
          href={purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-sm font-medium text-danger underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Top up
        </a>
      ) : null}
    </footer>
  )
}

function CreditsDetails({
  amount,
  consumed,
  tone,
  unavailable,
  pricingRows,
  formatCredits,
  purchaseUrl,
}: {
  amount: string | null
  consumed: number | null
  tone: CreditsTone
  unavailable: boolean
  pricingRows: ReturnType<typeof searchPriceList>
  formatCredits: (credits: number) => string
  purchaseUrl: string
}) {
  return (
    <div className="text-sm">
      <div className="space-y-1 p-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground">Credit balance</p>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            tone === "empty" ? "text-danger" : tone === "low" ? "text-warning" : "text-foreground"
          )}
        >
          {amount ?? "—"}
        </p>
        {unavailable ? (
          <p className="text-xs text-muted-foreground">
            We couldn&apos;t reach your balance just now. It will refresh on its own.
          </p>
        ) : tone === "empty" ? (
          <p className="text-xs text-muted-foreground">
            You&apos;re out of credits. Searches and enrichment pause until you top up.
          </p>
        ) : tone === "low" ? (
          <p className="text-xs text-muted-foreground">
            Running low: less than a {LOW_BALANCE_PEOPLE_RESULTS}-result People search.
          </p>
        ) : null}
        {consumed !== null ? (
          <p className="flex items-baseline justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <span>Credits used</span>
            <span className="tabular-nums text-foreground">{formatCredits(consumed)}</span>
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-2 p-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Price per result</p>
        <dl className="space-y-1">
          {pricingRows.map((row) => (
            <div key={row.action} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="text-foreground">{row.label}</dt>
              <dd className="text-muted-foreground tabular-nums">
                {formatDisplayCredits(row.credits)} / {row.unit}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          You&apos;re only charged for results we find.
        </p>
      </div>

      <Separator />

      <div className="p-3">
        <Button asChild size="sm" className="w-full">
          <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">
            <Wallet aria-hidden />
            Open Credit Wallet
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  )
}
