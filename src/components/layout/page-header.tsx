import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The heading every page opens with, identical to PipeLeads Suite's page
 * headers (e.g. its Boards page): a bold 2xl title, a muted one-line
 * description, and optional actions on the right that wrap below on phones.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
