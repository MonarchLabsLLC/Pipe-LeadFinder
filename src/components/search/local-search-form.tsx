"use client"

import { useEffect } from "react"
import { useForm, Controller, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight } from "lucide-react"

import { localSearchSchema, type LocalSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { SearchCostEstimate } from "@/components/search/search-cost-estimate"
import { AUTO_LIST_ID, buildAutoListName } from "@/lib/search-summary"
import { LocationAutocomplete } from "@/components/ui/location-autocomplete"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface LocalSearchFormProps {
  onSubmit: (data: LocalSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
  /** Pre-fills the form (an example chip or "Describe who you want"). */
  initialValues?: Partial<LocalSearchInput>
}

export function LocalSearchForm({ onSubmit, onCancel, isLoading, initialValues }: LocalSearchFormProps) {
  const defaults: Partial<LocalSearchInput> = {
    businessType: "",
    location: "",
    resultsLimit: 10,
    listId: AUTO_LIST_ID,
  }
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<LocalSearchInput>({
    resolver: zodResolver(localSearchSchema) as Resolver<LocalSearchInput>,
    defaultValues: { ...defaults, ...initialValues },
  })
  const values = useWatch({ control })
  const listId = values.listId
  const autoName = buildAutoListName(SearchType.LOCAL, values)

  // A new example or AI suggestion replaces what is in the form.
  useEffect(() => {
    if (initialValues) reset({ ...defaults, ...initialValues })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">

        {/* ── Search Criteria Section ─────────────────── */}
        <div className="pb-6">
          <h3 className="text-base font-semibold">
            Search Criteria
          </h3>
          <Separator className="mt-2 mb-4" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="businessType" className="text-sm font-medium text-foreground">
                Business Type
              </Label>
              <Input
                id="businessType"
                placeholder="Eg: Hairdresser"
               
                aria-invalid={!!errors.businessType}
                {...register("businessType")}
              />
              {errors.businessType && (
                <p className="text-xs text-destructive">
                  {errors.businessType.message ?? "Business type is required"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-sm font-medium text-foreground">
                Location
              </Label>
              <Controller
                control={control}
                name="location"
                render={({ field }) => (
                  <LocationAutocomplete
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="City, State or ZIP..."
                  />
                )}
              />
              {errors.location && (
                <p className="text-xs text-destructive">
                  {errors.location.message ?? "Location is required"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resultsLimit" className="text-sm font-medium text-foreground">
                Results Limit
              </Label>
              <Controller
                name="resultsLimit"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value?.toString() ?? "10"}
                    onValueChange={(val) => field.onChange(Number(val))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select limit" />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50].map((val) => (
                        <SelectItem key={val} value={val.toString()}>
                          {val}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.resultsLimit && (
                <p className="text-xs text-destructive">{errors.resultsLimit.message}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Save & Run Section ──────────────────────── */}
        <div className="pt-6">
          <h3 className="text-base font-semibold">
            Save & Run
          </h3>
          <Separator className="mt-2 mb-4" />

          <ListSelector
            value={listId || undefined}
            onChange={(value) =>
              setValue("listId", value, { shouldDirty: true, shouldValidate: true })
            }
            searchType={SearchType.LOCAL}
            autoName={autoName}
          />

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !listId}
              className="min-w-32"
            >
              {isLoading ? "Searching..." : "Continue"}
              {!isLoading && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </div>
          <SearchCostEstimate searchType={SearchType.LOCAL} resultsLimit={values.resultsLimit} />
        </div>

      </div>
    </form>
  )
}
