"use client"

import { useForm, Controller, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Coins } from "lucide-react"

import { localSearchSchema, type LocalSearchInput } from "@/lib/validators/search"
import {
  formatScaledCreditText,
  getPipeLeadsCreditCost,
} from "@/lib/pipeleads-credit-pricing"
import { usePipeLeadsPricing } from "@/hooks/usePipeLeadsPricing"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
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
}

export function LocalSearchForm({ onSubmit, onCancel, isLoading }: LocalSearchFormProps) {
  const { pricingMap } = usePipeLeadsPricing()
  const localSearchCreditText = formatScaledCreditText(
    getPipeLeadsCreditCost("search:local", pricingMap),
    "business"
  )
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<LocalSearchInput>({
    resolver: zodResolver(localSearchSchema) as Resolver<LocalSearchInput>,
    defaultValues: {
      businessType: "",
      location: "",
      resultsLimit: 10,
      listId: "",
    },
  })
  const listId = useWatch({ control, name: "listId" })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">

        {/* ── Search Criteria Section ─────────────────── */}
        <div className="pb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
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
                    <SelectTrigger className="h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20">
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Save & Run
          </h3>
          <Separator className="mt-2 mb-4" />

          <ListSelector
            value={listId || undefined}
            onChange={(value) =>
              setValue("listId", value, { shouldDirty: true, shouldValidate: true })
            }
            searchType={SearchType.LOCAL}
          />

          {/* Credit Info */}
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
            <Coins className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <p>Local search will consume {localSearchCreditText} returned.</p>
              <p>No credits will be consumed if email addresses are not found.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !listId}
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
