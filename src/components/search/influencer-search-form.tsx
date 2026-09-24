"use client"

import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Lightbulb } from "lucide-react"
import {
  influencerSearchSchema,
  type InfluencerSearchInput,
} from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { SearchCostEstimate } from "@/components/search/search-cost-estimate"
import { AUTO_LIST_ID, buildAutoListName } from "@/lib/search-summary"
import { LocationAutocomplete } from "@/components/ui/location-autocomplete"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Zod defaults make the resolver input shape slightly wider than its output.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResolver = any

// The configured discovery actor supports only these controls. Keeping this
// form aligned with its live input schema prevents users from selecting
// filters that would be silently ignored by the search provider.
const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
] as const

const CATEGORIES = [
  "art",
  "beauty",
  "business",
  "education",
  "fashion",
  "fitness",
  "food",
  "gaming",
  "health",
  "lifestyle",
  "music",
  "photography",
  "sports",
  "technology",
  "travel",
] as const

const LANGUAGES = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["any", "Any language"],
] as const

const inputClass =
  ""
const selectClass =
  "w-full"

function optionalNumberValue(value: string) {
  if (value === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

interface InfluencerSearchFormProps {
  onSubmit: (data: InfluencerSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
  /** Pre-fills the form (an example chip or "Describe who you want"). */
  initialValues?: Partial<InfluencerSearchInput>
}

export function InfluencerSearchForm({
  onSubmit,
  onCancel,
  isLoading,
  initialValues,
}: InfluencerSearchFormProps) {
  const defaults: Partial<InfluencerSearchInput> = {
    platform: "instagram",
    resultsLimit: 10,
    hashtags: [],
    description: "",
    location: "",
    listId: AUTO_LIST_ID,
    accountType: "any",
    verified: false,
    language: "any",
  }
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<InfluencerSearchInput>({
    resolver: zodResolver(influencerSearchSchema) as AnyResolver,
    defaultValues: { ...defaults, ...initialValues },
  })

  const platform = useWatch({ control, name: "platform" })
  const values = useWatch({ control })
  const listId = values.listId
  const autoName = buildAutoListName(SearchType.INFLUENCER, values)

  // A new example or AI suggestion replaces what is in the form.
  useEffect(() => {
    if (initialValues) reset({ ...defaults, ...initialValues })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <section className="pb-6">
          <h3 className="text-base font-semibold">
            Platform
          </h3>
          <Separator className="mt-2 mb-4" />
          <div className="inline-flex gap-1 rounded-full bg-muted/50 p-1">
            {PLATFORMS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setValue("platform", item.value, { shouldValidate: true })
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  platform === item.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Start broad with a clear niche, then narrow by followers and engagement.
            </p>
          </div>
        </section>

        <Separator />

        <section className="py-6">
          <h3 className="text-base font-semibold">
            Search criteria
          </h3>
          <Separator className="mt-2 mb-4" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Niche or description</Label>
              <Input
                id="description"
                placeholder="e.g. fitness coaches, SaaS creators"
                className={inputClass}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Results limit</Label>
              <Controller
                name="resultsLimit"
                control={control}
                render={({ field }) => (
                  <Select
                    value={String(field.value ?? 10)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50].map((value) => (
                        <SelectItem key={value} value={String(value)}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Input
                id="hashtags"
                placeholder="fitness, wellness, coaching"
                className={inputClass}
                {...register("hashtags", {
                  setValueAs: (value: unknown) => {
                    if (Array.isArray(value)) return value
                    if (typeof value !== "string") return []
                    return value
                      .split(",")
                      .map((item) => item.trim().replace(/^#/, ""))
                      .filter(Boolean)
                  },
                })}
              />
              <p className="text-xs text-muted-foreground">Separate hashtags with commas.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}>
                    <SelectTrigger className={selectClass}><SelectValue placeholder="Any category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any category</SelectItem>
                      {CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Location</Label>
              <Controller
                name="location"
                control={control}
                render={({ field }) => (
                  <LocationAutocomplete
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="City, state, country, or region"
                  />
                )}
              />
              {errors.location && (
                <p className="text-xs text-destructive">{errors.location.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username keyword</Label>
              <Input id="username" placeholder="creator handle" className={inputClass} {...register("username")} />
            </div>
          </div>
        </section>

        <Separator />

        <section className="py-6">
          <h3 className="text-base font-semibold">
            Supported filters
          </h3>
          <Separator className="mt-2 mb-4" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Follower range</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} placeholder="Min" className={inputClass} {...register("followersFrom", { setValueAs: optionalNumberValue })} />
                <Input type="number" min={0} placeholder="Max" className={inputClass} {...register("followersTo", { setValueAs: optionalNumberValue })} />
              </div>
              {errors.followersTo && <p className="text-xs text-destructive">{errors.followersTo.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engagementRate">Minimum engagement (%)</Label>
              <Input id="engagementRate" type="number" min="0.1" max="50" step="0.1" placeholder="2" className={inputClass} {...register("engagementRate", { setValueAs: optionalNumberValue })} />
              {errors.engagementRate && <p className="text-xs text-destructive">{errors.engagementRate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "any"} onValueChange={field.onChange}>
                    <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account type</Label>
              <Controller
                name="accountType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "any"} onValueChange={field.onChange}>
                    <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any account</SelectItem>
                      <SelectItem value="business">Business account</SelectItem>
                      <SelectItem value="creator">Creator account</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Controller
                name="verified"
                control={control}
                render={({ field }) => (
                  <Checkbox id="verified" checked={field.value ?? false} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="verified">Verified accounts only</Label>
            </div>
          </div>
        </section>

        <Separator />

        <section className="pt-6">
          <ListSelector
            value={listId || undefined}
            onChange={(value) => setValue("listId", value, { shouldDirty: true, shouldValidate: true })}
            searchType={SearchType.INFLUENCER}
            autoName={autoName}
          />
          <div className="mt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !listId} className="min-w-32">
              {isLoading ? "Searching..." : "Continue"}
              {!isLoading && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </div>
          <SearchCostEstimate searchType={SearchType.INFLUENCER} resultsLimit={values.resultsLimit} />
        </section>
      </div>
    </form>
  )
}
