import { z } from "zod"

import { FocusedAgentError } from "@/server/focused-agent/security"

import { PluginError } from "./contract"

// The Lead Finder Agent's errors, said in the plugin contract's eight codes.
// Pure, so the mapping (above all: not enough credits is `invalid_input` with a
// message that says so) is tested without a database.

const NOT_FOUND_CODES = new Set(["LIST_NOT_FOUND", "LEAD_NOT_FOUND", "LABEL_NOT_FOUND", "SEARCH_NOT_FOUND", "RUN_NOT_FOUND", "PROPOSAL_NOT_FOUND"])

function zodMessage(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return "Check the input fields."
  const where = first.path.length ? `${first.path.join(".")}: ` : ""
  return `${where}${first.message}`.slice(0, 300)
}

export function toPluginError(error: unknown): PluginError {
  if (error instanceof PluginError) return error
  if (error instanceof z.ZodError) return new PluginError("invalid_input", zodMessage(error))
  if (error instanceof FocusedAgentError) {
    if (NOT_FOUND_CODES.has(error.code)) return new PluginError("not_found", error.message)
    if (error.code === "INSUFFICIENT_CREDITS") {
      return new PluginError("invalid_input", `Not enough Scale Credits. ${error.message} Nothing was started and nothing was charged.`)
    }
    // Pricing or the balance could not be read just now: nothing ran, try again.
    if (error.status >= 500) return new PluginError("app_error", error.message, error.retryable)
    return new PluginError("invalid_input", error.message)
  }
  console.error("[plugins] unexpected error", error instanceof Error ? error.message : error)
  return new PluginError("app_error", "Lead Finder could not complete this request.", true)
}
