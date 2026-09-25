import { ArrowUpRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PROMAX_UPGRADE_URL } from "./agent-api"

/** For users without Pro Max: a small, dismissable-by-ignoring invitation. */
export function AgentUpsellCard() {
  return (
    <aside
      aria-label="Lead Finder agent"
      className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-4 sm:flex-row sm:items-center"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Talk to the Lead Finder agent — Pro Max</p>
        <p className="text-sm text-muted-foreground">
          Say who you want in plain words. The agent asks what&apos;s missing, prepares the search and its cost,
          then enriches and sends your leads on — every step waits for your approval.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <a href={PROMAX_UPGRADE_URL} target="_blank" rel="noopener noreferrer">
          Upgrade to Pro Max
          <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </Button>
    </aside>
  )
}
