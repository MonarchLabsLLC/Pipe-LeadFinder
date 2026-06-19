import { toast } from "sonner"

type AppErrorToast =
  | "search"
  | "emailEnrichment"
  | "phoneEnrichment"
  | "bulkEnrichment"
  | "savePhone"
  | "applyLabel"
  | "agentSave"
  | "agentRun"
  | "businessProfile"
  | "dataSource"
  | "pdfSource"
  | "deleteDataSource"
  | "leadScoring"
  | "exportCsv"

interface ToastCopy {
  title: string
  description: string
}

const ERROR_COPY: Record<AppErrorToast, ToastCopy> = {
  search: {
    title: "Search could not be completed",
    description:
      "No leads were saved from this run. Check the search details and try again in a minute.",
  },
  emailEnrichment: {
    title: "Email lookup needs another try",
    description:
      "We could not complete enrichment for this lead. Try again, or keep working and enrich it later.",
  },
  phoneEnrichment: {
    title: "Phone lookup needs another try",
    description:
      "We could not complete phone enrichment for this lead. Try again, or add the number manually if you have it.",
  },
  bulkEnrichment: {
    title: "Enrichment could not start",
    description:
      "The list was left unchanged. Try again shortly, or enrich individual leads from the table.",
  },
  savePhone: {
    title: "Phone number was not saved",
    description:
      "The lead still has its previous phone value. Check the number and try saving again.",
  },
  applyLabel: {
    title: "Label was not applied",
    description:
      "The lead was not updated. Try applying the label again from the row menu.",
  },
  agentSave: {
    title: "Agent was not saved",
    description:
      "Your changes are still on screen. Review the setup and try saving again.",
  },
  agentRun: {
    title: "Agent could not start",
    description:
      "The agent did not run. Check the agent setup, credits, and connected actions before retrying.",
  },
  businessProfile: {
    title: "Business profile was not updated",
    description:
      "Your AI context stayed the same. Review the fields and try saving again.",
  },
  dataSource: {
    title: "Data source was not added",
    description:
      "The knowledge base did not change. Check the source details and try again.",
  },
  pdfSource: {
    title: "PDF source was not added",
    description:
      "The file was not added to the knowledge base. Try a smaller PDF or upload it again.",
  },
  deleteDataSource: {
    title: "Data source was not deleted",
    description:
      "The knowledge base still includes this source. Try deleting it again.",
  },
  leadScoring: {
    title: "Lead scoring could not finish",
    description:
      "The list was not re-ranked. Check the AI provider setup and try scoring again.",
  },
  exportCsv: {
    title: "CSV export was not created",
    description:
      "The download did not start. Refresh the list and try exporting again.",
  },
}

const GENERIC_ERROR_MESSAGES = new Set([
  "Search failed",
  "Search failed. Please try again.",
  "Email enrichment failed",
  "Phone enrichment failed",
  "Bulk enrichment failed",
  "Data enrichment failed",
  "Failed to save phone",
  "Failed to apply label",
  "Lead scoring failed",
  "Export failed",
  "Failed to export CSV",
  "Failed to create template",
  "Failed to update template",
  "Failed to delete template",
])

function getErrorMessage(error?: unknown) {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return null
}

function isUsefulDetail(message: string) {
  const normalized = message.trim()
  if (!normalized || GENERIC_ERROR_MESSAGES.has(normalized)) return false
  return normalized.length <= 220
}

export const appToast = {
  success(title: string, description?: string) {
    toast.success(title, { description })
  },

  error(context: AppErrorToast, error?: unknown) {
    const copy = ERROR_COPY[context]
    const message = getErrorMessage(error)
    const detail = message && isUsefulDetail(message) ? ` Details: ${message}` : ""

    toast.error(copy.title, {
      description: `${copy.description}${detail}`,
    })
  },
}
