"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ArrowUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The message box. Enter sends, Shift+Enter adds a line, and it grows with
 * the text. "hero" is the big centred box on the welcome; "dock" sits under a
 * conversation.
 */
export function AgentComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  pending,
  variant = "dock",
  autoFocus,
  footer,
  label = "Message the Lead Finder agent",
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  disabled?: boolean
  pending?: boolean
  variant?: "hero" | "dock"
  autoFocus?: boolean
  footer?: ReactNode
  label?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, variant === "hero" ? 220 : 160)}px`
  }, [value, variant])
  const hero = variant === "hero"
  const canSend = !disabled && value.trim().length > 0
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSubmit()
      }}
      className={cn(
        "group/composer relative rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10",
        hero && "rounded-3xl shadow-md"
      )}
    >
      <label className="sr-only" htmlFor={hero ? "agent-hero-input" : "agent-dock-input"}>
        {label}
      </label>
      <textarea
        id={hero ? "agent-hero-input" : "agent-dock-input"}
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            if (canSend) onSubmit()
          }
        }}
        rows={1}
        maxLength={8000}
        placeholder={placeholder}
        className={cn(
          "block w-full resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground/80",
          hero ? "min-h-24 px-5 pt-5 pb-14 text-base sm:text-lg" : "min-h-12 px-4 pt-3 pb-12 text-sm"
        )}
      />
      <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs text-muted-foreground">{footer}</div>
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Send message"
          className={cn("shrink-0 rounded-full", hero ? "size-10" : "size-8")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </div>
    </form>
  )
}
