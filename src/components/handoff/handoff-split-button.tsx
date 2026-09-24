"use client"

import type { ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * One action, two halves: the label sends straight away with the remembered
 * choices, the chevron opens the choices themselves.
 */
export function HandoffSplitButton({
  label,
  icon,
  title,
  size,
  sending,
  open,
  onOpenChange,
  onPrimary,
  children,
}: {
  label: string
  icon: ReactNode
  title: string
  size: "xs" | "sm"
  sending: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrimary: () => void
  children: ReactNode
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div className="inline-flex items-stretch">
        <Button
          type="button"
          variant="outline"
          size={size}
          className="rounded-r-none border-r-0"
          disabled={sending}
          onClick={onPrimary}
          title={title}
        >
          {sending ? <Loader2 className="animate-spin" /> : icon}
          {sending ? "Sending..." : label}
        </Button>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size}
            className={cn("rounded-l-none", size === "xs" ? "px-1" : "px-1.5")}
            disabled={sending}
            aria-label={`${label} options`}
          >
            <ChevronDown />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-80 p-0" align="end">
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function HandoffPanel({
  heading,
  description,
  children,
  footer,
}: {
  heading: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{heading}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4 px-4 py-3">{children}</div>
      <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">{footer}</div>
    </div>
  )
}
