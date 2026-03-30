"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight } from "lucide-react"

import {
  influencerSearchSchema,
  type InfluencerSearchInput,
} from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResolver = any
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

  return (
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))} className="space-y-8">
      {/* ── Platform Tabs ─────────────────────────────── */}
      <Tabs
        value={platform}
        onValueChange={(v) =>
          setValue("platform", v as InfluencerSearchInput["platform"])
        }
      >
        <TabsList>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
        </TabsList>

        {/* All three tabs share the same form content */}
        {(["instagram", "tiktok", "youtube"] as const).map((p) => (
          <TabsContent key={p} value={p}>
            {/* intentionally empty — content rendered below outside tabs */}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Pro Tip ───────────────────────────────────── */}
      <p className="text-sm font-medium text-muted-foreground">
        PRO TIP: Start Broad With Just Hashtags Or Description Keywords.
      </p>

      {/* ── Main Fields ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hashtags" className="font-semibold">
            Hashtags (without #)
          </Label>
          <Input
            id="hashtags"
            placeholder="Type and press enter"
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

        <div className="space-y-2">
          <Label htmlFor="description" className="font-semibold">
            Description
          </Label>
          <Input
            id="description"
            placeholder="Eg: music"
            {...register("description")}
          />
        </div>
      </div>

      {/* ── Metrics Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Followers From / To */}
        <div className="space-y-2">
          <Label className="font-semibold">Followers</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From"
              {...register("followersFrom", { valueAsNumber: true })}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="To"
              {...register("followersTo", { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Age From / To */}
        <div className="space-y-2">
          <Label className="font-semibold">Age</Label>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="ageFrom"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
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
            <span className="text-muted-foreground">-</span>
            <Controller
              control={control}
              name="ageTo"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
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
        <div className="space-y-2">
          <Label className="font-semibold">Reels Plays</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From"
              {...register("reelsPlaysFrom", { valueAsNumber: true })}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="To"
              {...register("reelsPlaysTo", { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Engagements From / To */}
        <div className="space-y-2">
          <Label className="font-semibold">Engagements</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From"
              {...register("engagementsFrom", { valueAsNumber: true })}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="To"
              {...register("engagementsTo", { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Engagement Rate */}
        <div className="space-y-2">
          <Label htmlFor="engagementRate" className="font-semibold">
            Engagement Rate
          </Label>
          <Input
            id="engagementRate"
            type="number"
            step="0.01"
            placeholder="Eg: 0.8"
            {...register("engagementRate", { valueAsNumber: true })}
          />
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label htmlFor="language" className="font-semibold">
            Language
          </Label>
          <Input
            id="language"
            placeholder="Search..."
            {...register("language")}
          />
        </div>
      </div>

      {/* ── Filters Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Gender */}
        <div className="space-y-2">
          <Label className="font-semibold">Gender</Label>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
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
        <div className="space-y-2">
          <Label htmlFor="lastPostDays" className="font-semibold">
            Last Post (days)
          </Label>
          <Input
            id="lastPostDays"
            type="number"
            placeholder="Eg: 40"
            {...register("lastPostDays", { valueAsNumber: true })}
          />
        </div>

        {/* Contact Details */}
        <div className="space-y-2">
          <Label className="font-semibold">Contact Details</Label>
          <Controller
            control={control}
            name="contactDetails"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
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
        <div className="space-y-2">
          <Label htmlFor="partnership" className="font-semibold">
            Partnership
          </Label>
          <Input
            id="partnership"
            placeholder="Search..."
            {...register("partnership")}
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="font-semibold">Category</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
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
        <div className="space-y-2">
          <Label className="font-semibold">Account Type</Label>
          <Controller
            control={control}
            name="accountType"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
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

      {/* ── Followers Growth Rate ─────────────────────── */}
      <div className="space-y-2">
        <Label className="font-semibold">Followers Growth Rate</Label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Controller
            control={control}
            name="followersGrowthInterval"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
            {...register("followersGrowthValue", { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* ── Checkboxes ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-6">
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
          <Label htmlFor="verified">Verified</Label>
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
          <Label htmlFor="hasSponsoredPosts">Has Sponsored Posts</Label>
        </div>
      </div>

      {/* ── Audience Section ──────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-base font-bold">Audience</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Audience Age */}
          <div className="space-y-2">
            <Label className="font-semibold">Age</Label>
            <Controller
              control={control}
              name="audience.age"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
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
          <div className="space-y-2">
            <Label htmlFor="audience.credibility" className="font-semibold">
              Credibility
            </Label>
            <Input
              id="audience.credibility"
              type="number"
              step="0.01"
              placeholder="Eg: 0.8"
              {...register("audience.credibility", { valueAsNumber: true })}
            />
          </div>

          {/* Audience Gender */}
          <div className="space-y-2">
            <Label className="font-semibold">Gender</Label>
            <Controller
              control={control}
              name="audience.gender"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
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
          <div className="space-y-2">
            <Label htmlFor="audience.language" className="font-semibold">
              Language
            </Label>
            <Input
              id="audience.language"
              placeholder="Search..."
              {...register("audience.language")}
            />
          </div>

          {/* Audience Interests */}
          <div className="space-y-2">
            <Label htmlFor="audience.interests" className="font-semibold">
              Interests
            </Label>
            <Input
              id="audience.interests"
              placeholder="Choose Interests"
              {...register("audience.interests")}
            />
          </div>

          {/* Audience Locations */}
          <div className="space-y-2">
            <Label htmlFor="audience.locations" className="font-semibold">
              Locations
            </Label>
            <Input
              id="audience.locations"
              placeholder="Search..."
              {...register("audience.locations")}
            />
          </div>
        </div>
      </div>

      {/* ── Search by Username ────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-base font-bold">Search by Username</h3>
        <div className="space-y-2">
          <Label htmlFor="username" className="font-semibold">
            Username
          </Label>
          <Input
            id="username"
            placeholder="Search..."
            {...register("username")}
          />
        </div>
      </div>

      {/* ── Location ──────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="location" className="font-semibold">
          Location
        </Label>
        <Input
          id="location"
          placeholder="Eg: Seattle"
          {...register("location")}
        />
      </div>

      {/* ── Credit Info ───────────────────────────────── */}
      <p className="text-sm text-muted-foreground">
        Influencer search will consume 2 credits per record returned.
      </p>

      {/* ── List Selector ────────────────────────────────── */}
      <ListSelector value={listId} onChange={setListId} searchType={SearchType.INFLUENCER} />

      {/* ── Actions ───────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {!isLoading && <ArrowRight className="size-4" />}
          <span>{isLoading ? "Searching..." : "Continue"}</span>
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </form>
  )
}
