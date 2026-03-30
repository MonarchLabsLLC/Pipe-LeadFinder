"use client"

import { useState } from "react"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { companySearchSchema, type CompanySearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))} className="space-y-6">
      {/* Top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="description" className="font-semibold">
            Description
          </Label>
          <Input
            id="description"
            placeholder="Eg: Web Designer"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="font-semibold">
            Location
          </Label>
          <Input
            id="location"
            placeholder="Type to search"
            {...register("location")}
          />
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location.message}</p>
          )}
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="radius" className="font-semibold">
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
                <SelectTrigger className="w-full">
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
            <p className="text-sm text-destructive">{errors.radius.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="resultsLimit" className="font-semibold">
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
            <p className="text-sm text-destructive">{errors.resultsLimit.message}</p>
          )}
        </div>
      </div>

      {/* Filter section */}
      <div>
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Filters
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="industry" className="font-semibold">
              Industry
            </Label>
            <Input
              id="industry"
              placeholder="Search..."
              {...register("industry")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName" className="font-semibold">
              Company Name
            </Label>
            <Input
              id="companyName"
              placeholder="Search..."
              {...register("companyName")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain" className="font-semibold">
              Domain
            </Label>
            <Input
              id="domain"
              placeholder="Search..."
              {...register("domain")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="technologies" className="font-semibold">
              Technologies
            </Label>
            <Input
              id="technologies"
              placeholder="Search..."
              {...register("technologies")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyword" className="font-semibold">
              Keyword
            </Label>
            <Input
              id="keyword"
              placeholder="Search..."
              {...register("keyword")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeCount" className="font-semibold">
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
                  <SelectTrigger className="w-full">
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

          <div className="space-y-2">
            <Label htmlFor="revenue" className="font-semibold">
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
                  <SelectTrigger className="w-full">
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

      {/* List Selector */}
      <ListSelector value={listId} onChange={setListId} searchType={SearchType.COMPANY} />

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
