"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// The owner's monthly Scale Credits cap for one plugin. With a cap, a plugin
// the owner granted "run without asking" may start paid work until the cap is
// used up this month; without one, every paid action waits for approval.

export function CreditCapForm(props: { installId: string; name: string; monthlyCredits: number | null; usedThisMonth: number }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(props.monthlyCredits === null ? "" : String(props.monthlyCredits))
  const inputId = `cap-${props.installId}`

  const save = useMutation({
    mutationFn: async (monthlyCredits: number | null) => {
      const response = await fetch(`/api/plugins/installs/${encodeURIComponent(props.installId)}/credit-cap`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyCredits }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "The cap could not be saved. Try again.")
      return monthlyCredits
    },
    onSuccess: (monthlyCredits) => {
      void queryClient.invalidateQueries({ queryKey: ["plugins"] })
      toast.success(monthlyCredits === null ? `${props.name} will ask before every paid action.` : `Cap saved for ${props.name}.`)
      if (monthlyCredits === null) setValue("")
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The cap could not be saved. Try again."),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return save.mutate(null)
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 1) return toast.error("Enter a whole number of credits, or leave it empty for no cap.")
    save.mutate(parsed)
  }

  return (
    <form className="space-y-2" onSubmit={submit}>
      <Label htmlFor={inputId} className="text-sm">
        Monthly credit cap for work without asking
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          inputMode="numeric"
          placeholder="No cap: always ask"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-8"
        />
        <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {props.monthlyCredits === null
          ? "Every paid action this plugin asks for waits for your approval."
          : `${props.usedThisMonth.toLocaleString()} of ${props.monthlyCredits.toLocaleString()} credits used this month. Past the cap, it asks first.`}{" "}
        A plugin never takes your balance below zero.
      </p>
    </form>
  )
}
