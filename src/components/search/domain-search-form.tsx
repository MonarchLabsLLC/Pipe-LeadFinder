"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { domainSearchSchema, type DomainSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

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
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))} className="space-y-6">
      {/* Main field */}
      <div className="space-y-2">
        <Label htmlFor="companyNameOrWebsite" className="font-semibold">
          Company Name or Website
        </Label>
        <Input
          id="companyNameOrWebsite"
          placeholder="Eg: Amazon"
          {...register("companyNameOrWebsite")}
        />
        {errors.companyNameOrWebsite && (
          <p className="text-sm text-destructive">
            {errors.companyNameOrWebsite.message}
          </p>
        )}
      </div>

      {/* Info text */}
      <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground space-y-1">
        <p>1 credit will be consumed per individual result</p>
        <p className="text-xs">
          Example: 7 staff with emails = 7 credits consumed.
        </p>
      </div>

      {/* List Selector */}
      <ListSelector value={listId} onChange={setListId} searchType={SearchType.DOMAIN} />

      {/* Bottom buttons */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? "Searching..." : "\u2192 Continue"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </form>
  )
}
