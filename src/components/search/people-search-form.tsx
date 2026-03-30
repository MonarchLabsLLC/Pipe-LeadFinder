"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SlidersHorizontal, ArrowRight } from "lucide-react"

import { peopleSearchSchema, type PeopleSearchInput } from "@/lib/validators/search"
import { SearchType } from "@/generated/prisma/enums"
import { ListSelector } from "@/components/search/list-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      <Label className="font-semibold">{label}</Label>
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
      <SelectTrigger className="w-full">
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
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, listId }))} className="space-y-6">
      {/* ── Top Section (always visible) ─────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Description" error={errors.description?.message}>
          <Input
            placeholder="Eg: Web Designer"
            {...register("description")}
            aria-invalid={!!errors.description}
          />
        </FormField>

        <FormField label="Location" error={errors.location?.message}>
          <Input
            placeholder="Type to search"
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

      {/* ── Advanced Filters (collapsible) ───────────────── */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
            <SlidersHorizontal className="size-4" />
            Advanced filters
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground italic">
            PRO TIP: Over Filtering can reduce results. Start broad to return the most.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Job Title */}
            <FormField label="Job Title" error={errors.jobTitle?.message}>
              <Input placeholder="Search..." {...register("jobTitle")} />
            </FormField>

            {/* Department */}
            <FormField label="Department" error={errors.department?.message}>
              <Input placeholder="Search..." {...register("department")} />
            </FormField>

            {/* Management Levels */}
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

            {/* Changed Jobs Within */}
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

            {/* Skills */}
            <FormField label="Skills" error={errors.skills?.message}>
              <Input placeholder="Eg: Communication" {...register("skills")} />
            </FormField>

            {/* Years of Experience */}
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

            {/* Company Name or Domain */}
            <FormField label="Company Name or Domain" error={errors.companyNameOrDomain?.message}>
              <Input placeholder="Search..." {...register("companyNameOrDomain")} />
            </FormField>

            {/* Employee Count */}
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

            {/* Revenue */}
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

            {/* Industry */}
            <FormField label="Industry" error={errors.industry?.message}>
              <Input placeholder="Search..." {...register("industry")} />
            </FormField>

            {/* Contact Method */}
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

            {/* Major */}
            <FormField label="Major" error={errors.major?.message}>
              <Input placeholder="Search..." {...register("major")} />
            </FormField>

            {/* School */}
            <FormField label="School" error={errors.school?.message}>
              <Input placeholder="Search..." {...register("school")} />
            </FormField>

            {/* Degree */}
            <FormField label="Degree" error={errors.degree?.message}>
              <Input placeholder="Search..." {...register("degree")} />
            </FormField>

            {/* Social Link */}
            <FormField label="Social Link" error={errors.socialLink?.message}>
              <Input placeholder="Eg: https://www.linkedin.com/" {...register("socialLink")} />
            </FormField>

            {/* Contact Info Email */}
            <FormField label="Contact Info Email" error={errors.contactEmail?.message}>
              <Input placeholder="Eg: example@example.com" {...register("contactEmail")} />
            </FormField>

            {/* Contact Info Phone */}
            <FormField label="Contact Info Phone" error={errors.contactPhone?.message}>
              <Input placeholder="Eg: +1 111-111-1111" {...register("contactPhone")} />
            </FormField>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── List Selector ────────────────────────────────── */}
      <ListSelector value={listId} onChange={setListId} searchType={SearchType.PEOPLE} />

      {/* ── Bottom Section ───────────────────────────────── */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? "Searching..." : "Continue"}
          {!isLoading && <ArrowRight className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </form>
  )
}
