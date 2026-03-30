"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Lightbulb, Coins } from "lucide-react"

import {
  influencerSearchSchema,
  type InfluencerSearchInput,
} from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResolver = any
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

// ─── Option Constants ──────────────────────────────────

const AGE_OPTIONS = [
  { value: "13-17", label: "13-17" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55-64", label: "55-64" },
  { value: "65+", label: "65+" },
]

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "known", label: "Known" },
]

const CONTACT_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "bbm", label: "BBM" },
  { value: "skype", label: "Skype" },
  { value: "snapchat", label: "Snapchat" },
  { value: "telegram", label: "Telegram" },
  { value: "twitter", label: "Twitter" },
  { value: "wechat", label: "WeChat" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "youtube", label: "YouTube" },
]

const CATEGORY_OPTIONS = [
  { value: "animals", label: "Animals" },
  { value: "art", label: "Art" },
  { value: "beauty", label: "Beauty" },
  { value: "business", label: "Business & Entrepreneurs" },
  { value: "comedy", label: "Comedy & Entertainment" },
  { value: "education", label: "Education" },
  { value: "fashion", label: "Fashion" },
  { value: "fitness", label: "Fitness & Gym" },
  { value: "food", label: "Food & Cooking" },
  { value: "gaming", label: "Gaming" },
  { value: "health", label: "Health & Medicine" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "music", label: "Music" },
  { value: "photography", label: "Photography" },
  { value: "sports", label: "Sports" },
  { value: "technology", label: "Technology & Science" },
  { value: "travel", label: "Travel" },
]

const ACCOUNT_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "business", label: "Business" },
  { value: "creator", label: "Creator" },
]

const GROWTH_INTERVAL_OPTIONS = [
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "90d", label: "90 days" },
  { value: "180d", label: "180 days" },
  { value: "365d", label: "1 year" },
]

const GROWTH_OPERATOR_OPTIONS = [
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "eq", label: "Equal to" },
  { value: "gte", label: "Greater or equal" },
  { value: "lte", label: "Less or equal" },
]

const AUDIENCE_AGE_OPTIONS = [
  { value: "13-17", label: "13-17" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-64", label: "45-64" },
  { value: "65+", label: "65+" },
]

// ─── Shared select trigger class ──────────────────────
const selectTriggerClass = "h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
const inputClass = "h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"

// ─── Component ─────────────────────────────────────────

interface InfluencerSearchFormProps {
  onSubmit: (data: InfluencerSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function InfluencerSearchForm({
  onSubmit,
  onCancel,
  isLoading,
}: InfluencerSearchFormProps) {
  const [listId, setListId] = useState<string | undefined>(undefined)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InfluencerSearchInput>({
    resolver: zodResolver(influencerSearchSchema) as AnyResolver,
    defaultValues: {
      platform: "instagram",
      hashtags: [],
      description: "",
      verified: false,
      hasSponsoredPosts: false,
      audience: {
        age: undefined,
        credibility: undefined,
        gender: undefined,
        language: "",
        interests: "",
        locations: "",
      },
    },
  })

  const platform = watch("platform")

  const platforms = [
    { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
  ] as const

  return (
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">

        {/* ── Platform Selection ──────────────────────── */}
        <div className="pb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </h3>
          <Separator className="mt-2 mb-4" />

          <div className="inline-flex gap-1 rounded-full bg-muted/50 p-1">
            {platforms.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setValue("platform", p.value as InfluencerSearchInput["platform"])}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  platform === p.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Pro Tip Banner */}
          <div className="mt-4 flex items-start gap-2 rounded-r-lg border-l-2 border-primary bg-primary/5 px-4 py-2">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">PRO TIP:</span> Start broad with just hashtags or description keywords.
            </p>
          </div>
        </div>

        <Separator />

        {/* ── Search Criteria Section ─────────────────── */}
        <div className="py-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Search Criteria
          </h3>
          <Separator className="mt-2 mb-4" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hashtags" className="text-sm font-medium text-foreground">
                Hashtags (without #)
              </Label>
              <Input
                id="hashtags"
                placeholder="Type and press enter"
                className={inputClass}
                {...register("hashtags", {
                  setValueAs: (v: string) =>
                    typeof v === "string"
                      ? v
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : v,
                })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                Description
              </Label>
              <Input
                id="description"
                placeholder="Eg: music"
                className={inputClass}
                {...register("description")}
              />
            </div>
          </div>

          {/* Location */}
          <div className="mt-4 space-y-1.5">
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
          </div>

          {/* Metrics Grid */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Followers From / To */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Followers</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  className={inputClass}
                  {...register("followersFrom", { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">&ndash;</span>
                <Input
                  type="number"
                  placeholder="To"
                  className={inputClass}
                  {...register("followersTo", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Age From / To */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Age</Label>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="ageFrom"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <span className="text-sm text-muted-foreground">&ndash;</span>
                <Controller
                  control={control}
                  name="ageTo"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Reels Plays From / To */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Reels Plays</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  className={inputClass}
                  {...register("reelsPlaysFrom", { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">&ndash;</span>
                <Input
                  type="number"
                  placeholder="To"
                  className={inputClass}
                  {...register("reelsPlaysTo", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Engagements From / To */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Engagements</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  className={inputClass}
                  {...register("engagementsFrom", { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">&ndash;</span>
                <Input
                  type="number"
                  placeholder="To"
                  className={inputClass}
                  {...register("engagementsTo", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="engagementRate" className="text-sm font-medium text-foreground">
                Engagement Rate
              </Label>
              <Input
                id="engagementRate"
                type="number"
                step="0.01"
                placeholder="Eg: 0.8"
                className={inputClass}
                {...register("engagementRate", { valueAsNumber: true })}
              />
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <Label htmlFor="language" className="text-sm font-medium text-foreground">
                Language
              </Label>
              <Input
                id="language"
                placeholder="Search..."
                className={inputClass}
                {...register("language")}
              />
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Gender */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Gender</Label>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Choose Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Last Post (days) */}
            <div className="space-y-1.5">
              <Label htmlFor="lastPostDays" className="text-sm font-medium text-foreground">
                Last Post (days)
              </Label>
              <Input
                id="lastPostDays"
                type="number"
                placeholder="Eg: 40"
                className={inputClass}
                {...register("lastPostDays", { valueAsNumber: true })}
              />
            </div>

            {/* Contact Details */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Contact Details</Label>
              <Controller
                control={control}
                name="contactDetails"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Choose Social" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Partnership */}
            <div className="space-y-1.5">
              <Label htmlFor="partnership" className="text-sm font-medium text-foreground">
                Partnership
              </Label>
              <Input
                id="partnership"
                placeholder="Search..."
                className={inputClass}
                {...register("partnership")}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Account Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Account Type</Label>
              <Controller
                control={control}
                name="accountType"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Choose Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Followers Growth Rate */}
          <div className="mt-4 space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Followers Growth Rate</Label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Controller
                control={control}
                name="followersGrowthInterval"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Choose Interval" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROWTH_INTERVAL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              <Controller
                control={control}
                name="followersGrowthOperator"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Choose Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROWTH_OPERATOR_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              <Input
                type="number"
                placeholder="Eg: 10"
                className={inputClass}
                {...register("followersGrowthValue", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="verified"
                render={({ field }) => (
                  <Checkbox
                    id="verified"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="verified" className="text-sm font-medium text-foreground">Verified</Label>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="hasSponsoredPosts"
                render={({ field }) => (
                  <Checkbox
                    id="hasSponsoredPosts"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="hasSponsoredPosts" className="text-sm font-medium text-foreground">Has Sponsored Posts</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Audience Section ────────────────────────── */}
        <div className="py-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Audience
          </h3>
          <Separator className="mt-2 mb-4" />

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Audience Age */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Age</Label>
                <Controller
                  control={control}
                  name="audience.age"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Choose Age" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIENCE_AGE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Audience Credibility */}
              <div className="space-y-1.5">
                <Label htmlFor="audience.credibility" className="text-sm font-medium text-foreground">
                  Credibility
                </Label>
                <Input
                  id="audience.credibility"
                  type="number"
                  step="0.01"
                  placeholder="Eg: 0.8"
                  className={inputClass}
                  {...register("audience.credibility", { valueAsNumber: true })}
                />
              </div>

              {/* Audience Gender */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Gender</Label>
                <Controller
                  control={control}
                  name="audience.gender"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Choose Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Audience Language */}
              <div className="space-y-1.5">
                <Label htmlFor="audience.language" className="text-sm font-medium text-foreground">
                  Language
                </Label>
                <Input
                  id="audience.language"
                  placeholder="Search..."
                  className={inputClass}
                  {...register("audience.language")}
                />
              </div>

              {/* Audience Interests */}
              <div className="space-y-1.5">
                <Label htmlFor="audience.interests" className="text-sm font-medium text-foreground">
                  Interests
                </Label>
                <Input
                  id="audience.interests"
                  placeholder="Choose Interests"
                  className={inputClass}
                  {...register("audience.interests")}
                />
              </div>

              {/* Audience Locations */}
              <div className="space-y-1.5">
                <Label htmlFor="audience.locations" className="text-sm font-medium text-foreground">
                  Locations
                </Label>
                <Input
                  id="audience.locations"
                  placeholder="Search..."
                  className={inputClass}
                  {...register("audience.locations")}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Search by Username ──────────────────────── */}
        <div className="py-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Search by Username
          </h3>
          <Separator className="mt-2 mb-4" />

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </Label>
              <Input
                id="username"
                placeholder="Search..."
                className={inputClass}
                {...register("username")}
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

          <ListSelector value={listId} onChange={setListId} searchType={SearchType.INFLUENCER} />

          {/* Credit Info */}
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
            <Coins className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Influencer search will consume 2 credits per record returned.
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
