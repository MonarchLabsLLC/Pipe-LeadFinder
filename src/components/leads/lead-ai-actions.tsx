"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  MessageSquare,
  FileText,
  Mail,
  PenLine,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react"
import { useAIAction } from "@/hooks/useAI"
import type { AiActionType } from "@/generated/prisma/enums"

interface LeadAIActionsProps {
  leadId: string
}

interface PromptTemplate {
  id: string
  name: string
  prompt: string
}

const ACTION_CONFIG: {
  type: AiActionType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}[] = [
  {
    type: "SIMILAR_PEOPLE",
    label: "Similar People",
    icon: Users,
    description: "Find professionals similar to this lead",
  },
  {
    type: "DIRECT_MESSAGE",
    label: "Direct Message",
    icon: MessageSquare,
    description: "Generate a personalized direct message",
  },
  {
    type: "SUMMARY",
    label: "Summary",
    icon: FileText,
    description: "Get a research summary of this prospect",
  },
  {
    type: "SUBJECT_LINE",
    label: "Subject Lines",
    icon: Mail,
    description: "Generate email subject lines",
  },
  {
    type: "INTRO",
    label: "Email Intro",
    icon: PenLine,
    description: "Write a personalized email opening",
  },
  {
    type: "CUSTOM",
    label: "Custom Prompt",
    icon: Sparkles,
    description: "Use your own prompt",
  },
  {
    type: "LIBRARY",
    label: "Prompt Library",
    icon: BookOpen,
    description: "Use a saved prompt template",
  },
]

export function LeadAIActions({ leadId }: LeadAIActionsProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<AiActionType | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  const { generate, result, isLoading, error, reset } = useAIAction()

  // Load templates when Library action is selected
  useEffect(() => {
    if (activeAction === "LIBRARY" && !templatesLoaded) {
      fetch("/api/ai/prompts")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: PromptTemplate[]) => {
          setTemplates(data)
          setTemplatesLoaded(true)
        })
        .catch(() => {
          setTemplates([])
          setTemplatesLoaded(true)
        })
    }
  }, [activeAction, templatesLoaded])

  const handleAction = useCallback(
    (actionType: AiActionType) => {
      reset()
      setActiveAction(actionType)
      setCopied(false)
      setCustomPrompt("")
      setSelectedTemplate("")
      setSheetOpen(true)

      // For Custom and Library, wait for user input before generating
      if (actionType !== "CUSTOM" && actionType !== "LIBRARY") {
        generate({ leadId, actionType })
      }
    },
    [leadId, generate, reset]
  )

  const handleCustomGenerate = useCallback(() => {
    if (!customPrompt.trim()) return
    generate({ leadId, actionType: "CUSTOM", customPrompt: customPrompt.trim() })
  }, [leadId, customPrompt, generate])

  const handleLibraryGenerate = useCallback(() => {
    const template = templates.find((t) => t.id === selectedTemplate)
    if (!template) return
    generate({
      leadId,
      actionType: "LIBRARY",
      customPrompt: template.prompt,
    })
  }, [leadId, selectedTemplate, templates, generate])

  const handleCopy = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for clipboard API failure
    }
  }, [result])

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    reset()
    setActiveAction(null)
    setCustomPrompt("")
    setSelectedTemplate("")
    setCopied(false)
  }, [reset])

  const activeConfig = ACTION_CONFIG.find((a) => a.type === activeAction)

  return (
    <>
      {/* One "AI" menu per row keeps the table calm; each item runs the same
          action the old row of buttons did and opens the same result sheet.
          modal={false} lets the sheet take focus as the menu closes. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            variant="outline"
            size="xs"
            aria-label="AI actions for this lead"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="size-3" aria-hidden />
            AI
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            AI for this lead
          </DropdownMenuLabel>
          {ACTION_CONFIG.map((action, index) => {
            const Icon = action.icon
            // Custom and Library ask for a prompt first: set them apart.
            const startsPromptGroup = action.type === "CUSTOM" && index > 0
            return (
              <div key={action.type}>
                {startsPromptGroup && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="items-start"
                  onSelect={() => handleAction(action.type)}
                >
                  <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm">{action.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              </div>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent
          className="sm:max-w-lg w-full flex flex-col"
          // The sheet opened from the row's AI menu: hand focus back to it.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            menuTriggerRef.current?.focus()
          }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {activeConfig && (
                <>
                  <activeConfig.icon className="size-5" />
                  {activeConfig.label}
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 flex flex-col gap-4 mt-4 min-h-0">
            {/* Custom prompt input */}
            {activeAction === "CUSTOM" && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter your custom prompt... (e.g., 'Write a follow-up email mentioning their recent product launch')"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button
                  onClick={handleCustomGenerate}
                  disabled={!customPrompt.trim() || isLoading}
                  size="sm"
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Library template selector */}
            {activeAction === "LIBRARY" && (
              <div className="space-y-2">
                {templates.length > 0 ? (
                  <>
                    <Select
                      value={selectedTemplate}
                      onValueChange={setSelectedTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleLibraryGenerate}
                      disabled={!selectedTemplate || isLoading}
                      size="sm"
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          Generate from Template
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No saved templates yet.</p>
                    <p className="text-xs mt-1">
                      Create prompt templates in the AI Assistant settings page.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Result display */}
            {(result || isLoading) && (
              <div className="flex-1 min-h-0 flex flex-col">
                <ScrollArea className="flex-1 rounded-lg border bg-muted/30 p-4">
                  {isLoading && !result && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-sm">Generating response...</span>
                    </div>
                  )}
                  {result && (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {result}
                      {isLoading && (
                        <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Copy button */}
                {result && !isLoading && (
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="gap-1.5"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
