"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  ChevronsUpDown,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  LogOut,
  Monitor,
  Moon,
  Receipt,
  Sun,
  SunMoon,
  Wallet,
  Webhook,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { UserAvatar, useLogout } from "@/components/layout/user-identity"
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

/*
 * The sidebar surface is dark in both themes, and the light theme's
 * --warning / --danger are tuned for light surfaces. Scoping the credits line
 * with `dark` makes it read the dark theme's brighter amber and red tokens,
 * which is what the dark sidebar needs, without inventing new colours.
 */
const ROW_TONE: Record<CreditsTone, string> = {
  normal: "text-sidebar-muted-foreground",
  low: "dark font-medium text-warning",
  empty: "dark font-medium text-danger",
}

const PANEL_TONE: Record<CreditsTone, string> = {
  normal: "text-foreground",
  low: "text-warning",
  empty: "text-danger",
}

/** The live balance, its tone (normal, low, empty) and the words for it. */
function useCreditsSummary() {
  const { balance, isLoading, error, formatCredits } = useCredits()
  const { pricingMap } = usePipeLeadsPricing()

  const available = balance?.availableCredits ?? null
  const tone: CreditsTone =
    available === null ? "normal" : creditsTone(available, lowBalanceThreshold(pricingMap))
  const loading = isLoading && available === null
  const unavailable = !isLoading && available === null
  const amount = available === null ? null : formatCredits(available)
  const creditsLabel = loading
    ? "Loading credits"
    : unavailable
      ? error
        ? "Credits unavailable"
        : "Credits"
      : `${amount} credits`

  return { available, tone, loading, unavailable, amount, creditsLabel }
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 })

/**
 * Below md the sidebar is a drawer, so the account row is out of sight. This
 * small balance chip keeps credits on screen in the header and opens the
 * drawer, where the account row and its menu are.
 */
export function MobileCreditsChip() {
  const { isMobile, setOpenMobile } = useSidebar()
  const { available, tone, loading, creditsLabel } = useCreditsSummary()
  if (!isMobile) return null

  return (
    <button
      type="button"
      onClick={() => setOpenMobile(true)}
      aria-label={`${creditsLabel}. Open account and credits`}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        tone === "normal" ? "text-muted-foreground" : PANEL_TONE[tone],
        tone !== "normal" && "font-medium"
      )}
    >
      <Wallet aria-hidden className="size-3.5" />
      {loading ? (
        <span aria-hidden className="h-2.5 w-8 animate-pulse rounded-sm bg-muted" />
      ) : (
        <span>{available === null ? "—" : compact.format(available)}</span>
      )}
    </button>
  )
}

/**
 * The account row pinned to the bottom of the sidebar: who you are and, in
 * place of a plan name, your live credit balance. It opens the account menu
 * upwards: usage and prices, the Credit Wallet, theme, help and log out.
 */
export function SidebarAccount() {
  const { data: session } = useSession()
  const { state, isMobile } = useSidebar()
  const logout = useLogout()

  const name = session?.user?.name || "User"
  const email = session?.user?.email

  const { tone, loading, unavailable, amount, creditsLabel } = useCreditsSummary()
  const { balance, formatCredits, purchaseUrl } = useCredits()
  const { pricingMap } = usePipeLeadsPricing()

  // On the icon rail there is no room above the avatar for a wide menu.
  const collapsed = state === "collapsed" && !isMobile

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={creditsLabel}
              aria-label={`Account and credits: ${name}, ${creditsLabel}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="relative shrink-0">
                <UserAvatar name={session?.user?.name} email={email} />
                {tone !== "normal" ? (
                  <span
                    aria-hidden
                    className={cn(
                      "dark absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-sidebar",
                      tone === "empty" ? "bg-danger" : "bg-warning"
                    )}
                  />
                ) : null}
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
                {loading ? (
                  <span
                    aria-hidden
                    className="mt-1 h-2.5 w-24 animate-pulse rounded-sm bg-sidebar-accent"
                  />
                ) : (
                  <span className={cn("truncate text-xs tabular-nums", ROW_TONE[tone])}>
                    {creditsLabel}
                  </span>
                )}
              </span>
              <ChevronsUpDown aria-hidden className="ml-auto size-4 text-sidebar-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align={collapsed ? "end" : "start"}
            sideOffset={collapsed ? 8 : 6}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-72"
          >
            <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
              <UserAvatar name={session?.user?.name} email={email} />
              <span className="grid min-w-0 leading-tight">
                <span className="truncate text-sm font-medium">{name}</span>
                {email ? (
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                ) : null}
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <UsagePanel
              amount={amount}
              consumed={balance?.consumedCredits ?? null}
              tone={tone}
              unavailable={unavailable}
              formatCredits={formatCredits}
            />

            <DropdownMenuGroup className="space-y-1 px-1 pb-1">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Receipt aria-hidden />
                  What things cost
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60 p-0">
                  <PriceList rows={searchPriceList(pricingMap)} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                asChild
                className="justify-center bg-primary font-medium text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground [&_svg:not([class*='text-'])]:text-primary-foreground"
              >
                <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">
                  <Wallet aria-hidden />
                  {tone === "empty" ? "Top up in Credit Wallet" : "Open Credit Wallet"}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/resources/integrations">
                  <Webhook aria-hidden />
                  Integrations
                </Link>
              </DropdownMenuItem>
              <ThemeSubmenu />
              <DropdownMenuItem asChild>
                <Link href="/resources/tutorials">
                  <GraduationCap aria-hidden />
                  Help &amp; Tutorials
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/resources/support">
                  <HelpCircle aria-hidden />
                  Support
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={logout} variant="destructive">
              <LogOut aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UsagePanel({
  amount,
  consumed,
  tone,
  unavailable,
  formatCredits,
}: {
  amount: string | null
  consumed: number | null
  tone: CreditsTone
  unavailable: boolean
  formatCredits: (credits: number) => string
}) {
  return (
    <div className="space-y-1 px-2 pt-1.5 pb-2.5">
      <p className="text-xs font-medium text-muted-foreground">Credits remaining</p>
      <p
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          PANEL_TONE[tone]
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
      <p className="text-xs text-muted-foreground">
        You&apos;re only charged for results we find.
      </p>
    </div>
  )
}

function PriceList({ rows }: { rows: ReturnType<typeof searchPriceList> }) {
  return (
    <div className="space-y-2 p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Price per result</p>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.action} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-foreground">{row.label}</dt>
            <dd className="text-muted-foreground tabular-nums">
              {formatDisplayCredits(row.credits)} / {row.unit}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Light, dark or follow the device: the same setting as the header toggle. */
function ThemeSubmenu() {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <SunMoon aria-hidden />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
