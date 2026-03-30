"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight } from "lucide-react"

import { localSearchSchema, type LocalSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface LocalSearchFormProps {
  onSubmit: (data: LocalSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function LocalSearchForm({ onSubmit, onCancel, isLoading }: LocalSearchFormProps) {
  const [listId, setListId] = useState<string | undefined>(undefined)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LocalSearchInput>({
    resolver: zodResolver(localSearchSchema),
    defaultValues: {
      businessType: "",
      location: "",
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Business Type */}
        <div className="space-y-2">
          <Label htmlFor="businessType" className="font-semibold">
            Business Type
          </Label>
          <Input
            id="businessType"
            placeholder="Eg: Hairdresser"
            aria-invalid={!!errors.businessType}
            {...register("businessType")}
          />
          {errors.businessType && (
            <p className="text-sm text-destructive">
              {errors.businessType.message ?? "Business type is required"}
            </p>
          )}
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="font-semibold">
            Location
          </Label>
          <Input
            id="location"
            placeholder="Eg: Seattle"
            aria-invalid={!!errors.location}
            {...register("location")}
          />
          {errors.location && (
            <p className="text-sm text-destructive">
              {errors.location.message ?? "Location is required"}
            </p>
          )}
        </div>
      </div>

      {/* Info text */}
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Company search will consume 1 credit per record returned.</p>
        <p>No credits will be consumed if email addresses are not found.</p>
      </div>

      {/* List Selector */}
      <ListSelector value={listId} onChange={setListId} searchType={SearchType.LOCAL} />

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          <span>{isLoading ? "Searching..." : "Continue"}</span>
          {!isLoading && <ArrowRight className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </form>
  )
}
