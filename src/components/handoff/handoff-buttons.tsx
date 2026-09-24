"use client"

import { AddToMailBaserButton } from "./add-to-mailbaser-button"
import { AddToPipeLeadsButton } from "./add-to-pipeleads-button"
import { useHandoffStatus } from "./use-handoff-status"

/** Both one-click buttons; each renders only when its target is configured. */
export function HandoffButtons({
  leadIds,
  size = "xs",
  onSent,
  className,
}: {
  leadIds: string[]
  size?: "xs" | "sm"
  onSent?: () => void
  className?: string
}) {
  const status = useHandoffStatus()
  if (!status.pipeleads && !status.mailbaser) return null
  return (
    <div className={className ?? "flex flex-wrap items-center gap-1.5"}>
      {status.pipeleads && <AddToPipeLeadsButton leadIds={leadIds} size={size} onSent={onSent} />}
      {status.mailbaser && <AddToMailBaserButton leadIds={leadIds} size={size} onSent={onSent} />}
    </div>
  )
}
