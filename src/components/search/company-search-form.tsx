"use client"

import { useState } from "react"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Coins } from "lucide-react"
import { companySearchSchema, type CompanySearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
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

interface CompanySearchFormProps {
  onSubmit: (data: CompanySearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function CompanySearchForm({ onSubmit, onCancel, isLoading }: CompanySearchFormProps) {
  const [listId, setListId] = useState<string | undefined>(undefined)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CompanySearchInput>({
    resolver: zodResolver(companySearchSchema) as Resolver<CompanySearchInput>,
    defaultValues: {
      resultsLimit: 10,
    },
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                Description
              </Label>
              <Input
                id="description"
                placeholder="Eg: Web Designer"
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-sm font-medium text-foreground">
                Location
              </Label>
              <Input
                id="location"
                placeholder="Type to search"
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("location")}
              />
              {errors.location && (
                <p className="text-xs text-destructive">{errors.location.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="radius" className="text-sm font-medium text-foreground">
                Radius (km)
              </Label>
              <Controller
                name="radius"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value?.toString() ?? ""}
                    onValueChange={(val) => field.onChange(val ? Number(val) : undefined)}
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20">
                      <SelectValue placeholder="Select radius" />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 25, 50, 100].map((val) => (
                        <SelectItem key={val} value={val.toString()}>
                          {val} km
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.radius && (
                <p className="text-xs text-destructive">{errors.radius.message}</p>
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
                      {[10, 25, 50, 100].map((val) => (
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

        {/* ── Filters Section ─────────────────────────── */}
        <div className="py-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Filters
          </h3>
          <Separator className="mt-2 mb-4" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="industry" className="text-sm font-medium text-foreground">
                Industry
              </Label>
              <Input
                id="industry"
                placeholder="Search..."
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("industry")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-sm font-medium text-foreground">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Search..."
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("companyName")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain" className="text-sm font-medium text-foreground">
                Domain
              </Label>
              <Input
                id="domain"
                placeholder="Search..."
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("domain")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="technologies" className="text-sm font-medium text-foreground">
                Technologies
              </Label>
              <Input
                id="technologies"
                placeholder="Search..."
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("technologies")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="keyword" className="text-sm font-medium text-foreground">
                Keyword
              </Label>
              <Input
                id="keyword"
                placeholder="Search..."
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("keyword")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employeeCount" className="text-sm font-medium text-foreground">
                Employee Count
              </Label>
              <Controller
                name="employeeCount"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(val) => field.onChange(val || undefined)}
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20">
                      <SelectValue placeholder="Choose Count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10</SelectItem>
                      <SelectItem value="11-50">11-50</SelectItem>
                      <SelectItem value="51-200">51-200</SelectItem>
                      <SelectItem value="201-500">201-500</SelectItem>
                      <SelectItem value="501-1000">501-1,000</SelectItem>
                      <SelectItem value="1001-5000">1,001-5,000</SelectItem>
                      <SelectItem value="5001-10000">5,001-10,000</SelectItem>
                      <SelectItem value="10001+">10,001+</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="revenue" className="text-sm font-medium text-foreground">
                Revenue
              </Label>
              <Controller
                name="revenue"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(val) => field.onChange(val || undefined)}
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20">
                      <SelectValue placeholder="Choose Revenue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1M">$0 - $1M</SelectItem>
                      <SelectItem value="1M-10M">$1M - $10M</SelectItem>
                      <SelectItem value="10M-50M">$10M - $50M</SelectItem>
                      <SelectItem value="50M-100M">$50M - $100M</SelectItem>
                      <SelectItem value="100M-500M">$100M - $500M</SelectItem>
                      <SelectItem value="500M-1B">$500M - $1B</SelectItem>
                      <SelectItem value="1B+">$1B+</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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

          <ListSelector value={listId} onChange={setListId} searchType={SearchType.COMPANY} />

          {/* Credit Info */}
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
            <Coins className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Company search will consume 1 credit per record returned.
            </p>
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
