import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
        <Icon className="h-12 w-12 text-muted-foreground/60" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6 shadow-sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}
