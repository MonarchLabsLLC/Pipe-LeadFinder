"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, ArrowRight, Lightbulb, Coins } from "lucide-react"

import { peopleSearchSchema, type PeopleSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ─── Select option constants ───────────────────────────────

const RESULTS_LIMIT_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
]

const MANAGEMENT_LEVEL_OPTIONS = [
  { value: "entry", label: "Entry Level" },
  { value: "senior", label: "Senior" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "vp", label: "VP" },
  { value: "c-level", label: "C-Level" },
  { value: "owner", label: "Owner / Partner" },
]

const CHANGED_JOBS_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 12 months" },
]

const YEARS_EXPERIENCE_OPTIONS = [
  { value: "0-1", label: "0-1 years" },
  { value: "1-3", label: "1-3 years" },
  { value: "3-5", label: "3-5 years" },
  { value: "5-10", label: "5-10 years" },
  { value: "10+", label: "10+ years" },
]

const EMPLOYEE_COUNT_OPTIONS = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-500", label: "201-500" },
  { value: "501-1000", label: "501-1,000" },
  { value: "1001-5000", label: "1,001-5,000" },
  { value: "5001-10000", label: "5,001-10,000" },
  { value: "10001+", label: "10,001+" },
]

const REVENUE_OPTIONS = [
  { value: "0-1M", label: "$0 - $1M" },
  { value: "1M-10M", label: "$1M - $10M" },
  { value: "10M-50M", label: "$10M - $50M" },
  { value: "50M-100M", label: "$50M - $100M" },
  { value: "100M-500M", label: "$100M - $500M" },
  { value: "500M-1B", label: "$500M - $1B" },
  { value: "1B+", label: "$1B+" },
]

const CONTACT_METHOD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "email_and_phone", label: "Email & Phone" },
  { value: "linkedin", label: "LinkedIn" },
]

// ─── Helper components ─────────────────────────────────────

function FormField({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SelectField({
  placeholder,
  options,
  value,
  onValueChange,
}: {
  placeholder: string
  options: { value: string; label: string }[]
  value: string | undefined
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value || ""} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Main component ────────────────────────────────────────

interface PeopleSearchFormProps {
  onSubmit: (data: PeopleSearchInput & { listId?: string }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function PeopleSearchForm({ onSubmit, onCancel, isLoading }: PeopleSearchFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [listId, setListId] = useState<string | undefined>(undefined)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PeopleSearchInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(peopleSearchSchema) as any,
    defaultValues: {
      description: "",
      location: "",
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
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Description" error={errors.description?.message}>
              <Input
                placeholder="Eg: Web Designer"
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("description")}
                aria-invalid={!!errors.description}
              />
            </FormField>

            <FormField label="Location" error={errors.location?.message}>
              <Input
                placeholder="Type to search"
                className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
                {...register("location")}
              />
            </FormField>

            <FormField label="Results Limit" error={errors.resultsLimit?.message}>
              <Controller
                control={control}
                name="resultsLimit"
                render={({ field }) => (
                  <SelectField
                    placeholder="Select limit"
                    options={RESULTS_LIMIT_OPTIONS}
                    value={String(field.value)}
                    onValueChange={(val) => field.onChange(Number(val))}
                  />
                )}
              />
            </FormField>
          </div>
        </div>

        <Separator />

        {/* ── Advanced Filters (collapsible) ───────────────── */}
        <div className="py-6">
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span>Advanced Filters</span>
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                {/* Pro Tip Banner */}
                <div className="mb-4 flex items-start gap-2 rounded-r-lg border-l-2 border-primary bg-primary/5 px-4 py-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">PRO TIP:</span> Over-filtering can reduce results. Start broad to return the most.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Job Title" error={errors.jobTitle?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("jobTitle")} />
                  </FormField>

                  <FormField label="Department" error={errors.department?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("department")} />
                  </FormField>

                  <FormField label="Management Levels" error={errors.managementLevel?.message}>
                    <Controller
                      control={control}
                      name="managementLevel"
                      render={({ field }) => (
                        <SelectField
                          placeholder="Choose Level"
                          options={MANAGEMENT_LEVEL_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </FormField>

                  <FormField label="Changed Jobs Within" error={errors.changedJobsWithin?.message}>
                    <Controller
                      control={control}
                      name="changedJobsWithin"
                      render={({ field }) => (
                        <SelectField
                          placeholder="Choose Period"
                          options={CHANGED_JOBS_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </FormField>

                  <FormField label="Skills" error={errors.skills?.message}>
                    <Input placeholder="Eg: Communication" className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("skills")} />
                  </FormField>

                  <FormField label="Years of Experience" error={errors.yearsOfExperience?.message}>
                    <Controller
                      control={control}
                      name="yearsOfExperience"
                      render={({ field }) => (
                        <SelectField
                          placeholder="Choose Experience"
                          options={YEARS_EXPERIENCE_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </FormField>

                  <FormField label="Company Name or Domain" error={errors.companyNameOrDomain?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("companyNameOrDomain")} />
                  </FormField>

                  <FormField label="Employee Count" error={errors.employeeCount?.message}>
                    <Controller
                      control={control}
                      name="employeeCount"
                      render={({ field }) => (
                        <SelectField
                          placeholder="Choose Count"
                          options={EMPLOYEE_COUNT_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </FormField>

                  <FormField label="Revenue" error={errors.revenue?.message}>
                    <Controller
                      control={control}
                      name="revenue"
                      render={({ field }) => (
                        <SelectField
                          placeholder="Choose Revenue"
                          options={REVENUE_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </FormField>

                  <FormField label="Industry" error={errors.industry?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("industry")} />
                  </FormField>

                  <FormField label="Contact Method" error={errors.contactMethod?.message}>
                    <Controller
                      control={control}
                      name="contactMethod"
                      render={({ field }) => (
                        <SelectField
                          placeholder="Select"
                          options={CONTACT_METHOD_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </FormField>

                  <FormField label="Major" error={errors.major?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("major")} />
                  </FormField>

                  <FormField label="School" error={errors.school?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("school")} />
                  </FormField>

                  <FormField label="Degree" error={errors.degree?.message}>
                    <Input placeholder="Search..." className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("degree")} />
                  </FormField>

                  <FormField label="Social Link" error={errors.socialLink?.message}>
                    <Input placeholder="Eg: https://www.linkedin.com/" className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("socialLink")} />
                  </FormField>

                  <FormField label="Contact Info Email" error={errors.contactEmail?.message}>
                    <Input placeholder="Eg: example@example.com" className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("contactEmail")} />
                  </FormField>

                  <FormField label="Contact Info Phone" error={errors.contactPhone?.message}>
                    <Input placeholder="Eg: +1 111-111-1111" className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20" {...register("contactPhone")} />
                  </FormField>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <Separator />

        {/* ── Save & Run Section ──────────────────────── */}
        <div className="pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Save & Run
          </h3>
          <Separator className="mt-2 mb-4" />

          <ListSelector value={listId} onChange={setListId} searchType={SearchType.PEOPLE} />

          {/* Credit Info */}
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
            <Coins className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              People search will consume 1 credit per record returned.
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
