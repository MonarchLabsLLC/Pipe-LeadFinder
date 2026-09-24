import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  /** "page" fills a list area; "inline" sits inside a card or tab. */
  size?: "page" | "inline"
  className?: string
}

/** The designed empty state, identical to PipeLeads Suite's. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "page",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "page" ? "gap-4 px-6 py-16" : "gap-3 px-4 py-10",
        className
      )}
    >
      <div className="relative">
        <div aria-hidden className="absolute -inset-3 rounded-full border border-dashed border-border" />
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full bg-primary/10 text-primary",
            size === "page" ? "h-14 w-14" : "h-11 w-11"
          )}
        >
          <Icon className={size === "page" ? "h-6 w-6" : "h-5 w-5"} aria-hidden />
        </div>
      </div>
      <div className="mt-2 max-w-sm space-y-1">
        <h3 className={cn("font-semibold tracking-tight", size === "page" ? "text-lg" : "text-base")}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}
