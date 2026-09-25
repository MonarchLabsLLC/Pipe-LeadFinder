"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SearchType } from "@/generated/prisma/enums"
import { SearchTypePicker } from "@/components/search/search-type-picker"
import { PeopleSearchForm } from "@/components/search/people-search-form"
import { LocalSearchForm } from "@/components/search/local-search-form"
import { CompanySearchForm } from "@/components/search/company-search-form"
import { DomainSearchForm } from "@/components/search/domain-search-form"
import { InfluencerSearchForm } from "@/components/search/influencer-search-form"
import { SuggestionNote, type SearchSuggestion } from "@/components/search/describe-search"
import { AgentFrontDoor } from "@/components/agent/agent-front-door"
import { RecentSearches } from "@/components/search/recent-searches"
import type { SearchExample } from "@/components/search/search-guide"
import { useSearchMutation } from "@/hooks/useSearch"
import { useCreateList, useDeleteList } from "@/hooks/useLists"
import { appToast } from "@/lib/app-toast"
import { AUTO_LIST_ID, buildAutoListName } from "@/lib/search-summary"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/layout/page-header"

// Each form narrows this to its own input type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormValues = Record<string, any>

/**
 * Scroll the page's own scroller (the dashboard `main`) so `el` sits at its
 * top. `scrollIntoView` would also scroll the clipped shell around it.
 */
function scrollToTop(el: HTMLElement | null) {
  if (!el) return
  let scroller = el.parentElement
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
    scroller = scroller.parentElement
  }
  if (!scroller) return
  const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  scroller.scrollTo({ top: scroller.scrollTop + offset - 16, behavior: "smooth" })
}

export default function NewSearchPage() {
  const [selectedType, setSelectedType] = useState<SearchType | null>(null)
  const [initialValues, setInitialValues] = useState<FormValues | undefined>(undefined)
  const [suggestion, setSuggestion] = useState<SearchSuggestion | null>(null)
  const [scrollRequest, setScrollRequest] = useState(0)
  const formRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLElement>(null)
  const router = useRouter()
  const searchMutation = useSearchMutation()
  const createList = useCreateList()
  const deleteList = useDeleteList()

  // Bring the opened form into view once its 300ms open transition has
  // given the page enough height to scroll to it.
  useEffect(() => {
    if (!scrollRequest) return
    const id = window.setTimeout(() => scrollToTop(formRef.current), 450)
    return () => window.clearTimeout(id)
  }, [scrollRequest])

  function open(type: SearchType, values?: FormValues, from?: SearchSuggestion) {
    setSelectedType(type)
    setInitialValues(values ? { ...values } : undefined)
    setSuggestion(from ?? null)
    setScrollRequest((n) => n + 1)
  }

  function handleSelect(type: SearchType) {
    if (type === selectedType) return
    open(type)
  }

  function handleExample(type: SearchType, example: SearchExample) {
    open(type, example.values)
  }

  function handleSuggested(next: SearchSuggestion) {
    open(next.searchType, next.fields, next)
  }

  function handleCancel() {
    setSelectedType(null)
    setInitialValues(undefined)
    setSuggestion(null)
  }

  function handleChooseAnother() {
    handleCancel()
    scrollToTop(pickerRef.current)
  }

  async function handleSubmit(type: SearchType, data: FormValues) {
    const { listId: chosenListId, ...params } = data
    let listId = chosenListId as string
    let createdListId: string | null = null
    try {
      if (listId === AUTO_LIST_ID) {
        const created = await createList.mutateAsync({
          name: buildAutoListName(type, params),
          type,
        })
        listId = created.id
        createdListId = created.id
      }
      const result = await searchMutation.mutateAsync({
        type,
        params: { ...params, listId },
      })
      appToast.success(
        "Search queued",
        "You can leave this page while PipeLeads finds and saves your results."
      )
      if (result.listId) {
        router.push(`/lead-search/saved-lists/${result.listId}?jobId=${result.jobId}`)
      } else {
        router.push("/lead-search/saved-lists")
      }
    } catch (err) {
      // Don't leave behind an empty list we made for a search that never ran.
      if (createdListId) deleteList.mutate(createdListId)
      appToast.error("search", err)
    }
  }

  function renderForm() {
    if (!selectedType) return null

    const isLoading = searchMutation.isPending || createList.isPending
    const common = {
      onCancel: handleCancel,
      isLoading,
      initialValues,
    }

    switch (selectedType) {
      case SearchType.PEOPLE:
        return <PeopleSearchForm {...common} onSubmit={(data) => handleSubmit(SearchType.PEOPLE, data)} />
      case SearchType.LOCAL:
        return <LocalSearchForm {...common} onSubmit={(data) => handleSubmit(SearchType.LOCAL, data)} />
      case SearchType.COMPANY:
        return <CompanySearchForm {...common} onSubmit={(data) => handleSubmit(SearchType.COMPANY, data)} />
      case SearchType.DOMAIN:
        return <DomainSearchForm {...common} onSubmit={(data) => handleSubmit(SearchType.DOMAIN, data)} />
      case SearchType.INFLUENCER:
        return (
          <InfluencerSearchForm {...common} onSubmit={(data) => handleSubmit(SearchType.INFLUENCER, data)} />
        )
      default:
        return null
    }
  }

  const isRunning = searchMutation.isPending || createList.isPending

  return (
    <div className="flex flex-col gap-6">
      <AgentFrontDoor
        onSuggested={handleSuggested}
        onEditSearch={(type, values) => open(type, values)}
        header={
          <PageHeader
            title="New search"
            description="Describe who you want, or pick a search. You review everything before it runs, and results save to a list."
          />
        }
      />

      <section ref={pickerRef} aria-labelledby="choose-search-title" className="space-y-3">
        <div>
          <h2 id="choose-search-title" className="text-base font-semibold">
            Or choose a search yourself
          </h2>
          <p className="text-sm text-muted-foreground">
            Not sure which? Tap an example to see it filled in.
          </p>
        </div>
        <SearchTypePicker
          selectedType={selectedType}
          onSelect={handleSelect}
          onExample={handleExample}
        />
      </section>

      <div
        ref={formRef}
        className={cn(
          "grid transition-all duration-300 ease-out",
          selectedType ? "grid-rows-[1fr] opacity-100" : "-mb-6 grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {selectedType && (
            <div className="space-y-3">
              {suggestion && suggestion.searchType === selectedType ? (
                <SuggestionNote suggestion={suggestion} onChooseAnother={handleChooseAnother} />
              ) : null}
              <div className="relative">
                {isRunning && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="size-8 animate-spin text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {createList.isPending ? "Creating your list..." : "Running search..."}
                      </p>
                    </div>
                  </div>
                )}
                {renderForm()}
              </div>
            </div>
          )}
        </div>
      </div>

      <RecentSearches />
    </div>
  )
}
