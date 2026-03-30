"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchType } from "@/generated/prisma/enums"
import { SearchTypePicker } from "@/components/search/search-type-picker"
import { PeopleSearchForm } from "@/components/search/people-search-form"
import { LocalSearchForm } from "@/components/search/local-search-form"
import { CompanySearchForm } from "@/components/search/company-search-form"
import { DomainSearchForm } from "@/components/search/domain-search-form"
import { InfluencerSearchForm } from "@/components/search/influencer-search-form"
import { useSearchMutation } from "@/hooks/useSearch"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function NewSearchPage() {
  const [selectedType, setSelectedType] = useState<SearchType | null>(null)
  const router = useRouter()
  const searchMutation = useSearchMutation()

  function handleCancel() {
    setSelectedType(null)
  }

  async function handleSubmit(type: SearchType, data: Record<string, unknown>) {
    const { listId, ...params } = data
    try {
      const result = await searchMutation.mutateAsync({
        type,
        params: { ...params, listId },
      })
      toast.success("Search completed successfully!")
      router.push(`/lead-search/saved-lists/${result.listId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed. Please try again.")
    }
  }

  function renderForm() {
    if (!selectedType) return null

    const isLoading = searchMutation.isPending

    switch (selectedType) {
      case SearchType.PEOPLE:
        return (
          <PeopleSearchForm
            onSubmit={(data) => handleSubmit(SearchType.PEOPLE, data as unknown as Record<string, unknown>)}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )
      case SearchType.LOCAL:
        return (
          <LocalSearchForm
            onSubmit={(data) => handleSubmit(SearchType.LOCAL, data as unknown as Record<string, unknown>)}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )
      case SearchType.COMPANY:
        return (
          <CompanySearchForm
            onSubmit={(data) => handleSubmit(SearchType.COMPANY, data as unknown as Record<string, unknown>)}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )
      case SearchType.DOMAIN:
        return (
          <DomainSearchForm
            onSubmit={(data) => handleSubmit(SearchType.DOMAIN, data as unknown as Record<string, unknown>)}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )
      case SearchType.INFLUENCER:
        return (
          <InfluencerSearchForm
            onSubmit={(data) => handleSubmit(SearchType.INFLUENCER, data as unknown as Record<string, unknown>)}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Search</h1>
        <p className="mt-1 text-muted-foreground">What are you searching for?</p>
      </div>

      <SearchTypePicker selectedType={selectedType} onSelect={setSelectedType} />

      {selectedType && (
        <div className="relative rounded-lg border border-border bg-card p-4 sm:p-6">
          {searchMutation.isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">
                  Running search...
                </p>
              </div>
            </div>
          )}
          {renderForm()}
        </div>
      )}
    </div>
  )
}
