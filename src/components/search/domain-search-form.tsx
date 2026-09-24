"use client"

import { useEffect } from "react"
import { useForm, Controller, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight } from "lucide-react"
import { domainSearchSchema, type DomainSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { SearchCostEstimate } from "@/components/search/search-cost-estimate"
import { AUTO_LIST_ID, buildAutoListName } from "@/lib/search-summary"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DomainSearchFormProps {
  onSubmit: (data: DomainSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
  /** Pre-fills the form (an example chip or "Describe who you want"). */
  initialValues?: Partial<DomainSearchInput>
}

export function DomainSearchForm({ onSubmit, onCancel, isLoading, initialValues }: DomainSearchFormProps) {
  const defaults: Partial<DomainSearchInput> = {
    resultsLimit: 10,
    listId: AUTO_LIST_ID,
  }
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DomainSearchInput>({
    resolver: zodResolver(domainSearchSchema) as Resolver<DomainSearchInput>,
    defaultValues: { ...defaults, ...initialValues },
  })
  const values = useWatch({ control })
  const listId = values.listId
  const autoName = buildAutoListName(SearchType.DOMAIN, values)

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="companyNameOrWebsite" className="text-sm font-medium text-foreground">
                Company Name or Website
              </Label>
              <Input
                id="companyNameOrWebsite"
                placeholder="Eg: amazon.com"
               
                {...register("companyNameOrWebsite")}
              />
              {errors.companyNameOrWebsite && (
                <p className="text-xs text-destructive">
                  {errors.companyNameOrWebsite.message}
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
            searchType={SearchType.DOMAIN}
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
          <SearchCostEstimate searchType={SearchType.DOMAIN} resultsLimit={values.resultsLimit} />
        </div>

      </div>
    </form>
  )
}
