"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Coins } from "lucide-react"
import { domainSearchSchema, type DomainSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface DomainSearchFormProps {
  onSubmit: (data: DomainSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function DomainSearchForm({ onSubmit, onCancel, isLoading }: DomainSearchFormProps) {
  const [listId, setListId] = useState<string | undefined>(undefined)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DomainSearchInput>({
    resolver: zodResolver(domainSearchSchema),
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">

        {/* ── Search Criteria Section ─────────────────── */}
        <div className="pb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Search Criteria
          </h3>
          <Separator className="mt-2 mb-4" />

          <div className="space-y-1.5">
            <Label htmlFor="companyNameOrWebsite" className="text-sm font-medium text-foreground">
              Company Name or Website
            </Label>
            <Input
              id="companyNameOrWebsite"
              placeholder="Eg: Amazon"
              className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
              {...register("companyNameOrWebsite")}
            />
            {errors.companyNameOrWebsite && (
              <p className="text-xs text-destructive">
                {errors.companyNameOrWebsite.message}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Save & Run Section ──────────────────────── */}
        <div className="pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Save & Run
          </h3>
          <Separator className="mt-2 mb-4" />

          <ListSelector value={listId} onChange={setListId} searchType={SearchType.DOMAIN} />

          {/* Credit Info */}
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
            <Coins className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <p>1 credit will be consumed per individual result.</p>
              <p>Example: 7 staff with emails = 7 credits consumed.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 rounded-lg px-8 font-medium transition hover:shadow-md"
            >
              {isLoading ? "Searching..." : "Continue"}
              {!isLoading && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </div>
        </div>

      </div>
    </form>
  )
}
