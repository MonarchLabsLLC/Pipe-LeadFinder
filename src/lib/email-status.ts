export type LeadEmailStatus = "UNKNOWN" | "FOUND" | "NOT_FOUND" | "POTENTIAL"

export type EmailStatusKind = "found" | "potential" | "missing"

export interface EmailStatusDisplay {
  kind: EmailStatusKind
  /** Short badge text. */
  label: string
  /** Plain-language explanation shown in the badge's tooltip. */
  description: string
}

const DISPLAY: Record<EmailStatusKind, EmailStatusDisplay> = {
  found: {
    kind: "found",
    label: "Email found",
    description: "Found — not yet verified",
  },
  potential: {
    kind: "potential",
    label: "Possible email",
    description: "Potential — guessed from the company website",
  },
  missing: {
    kind: "missing",
    label: "No email",
    description: "Not found",
  },
}

/**
 * How a lead's email status reads in the results table. "Found" needs an
 * address to show; a status of FOUND with no address reads as not found.
 */
export function describeEmailStatus(
  status: LeadEmailStatus,
  email: string | null | undefined
): EmailStatusDisplay {
  if (status === "FOUND" && email) return DISPLAY.found
  if (status === "POTENTIAL") return DISPLAY.potential
  return DISPLAY.missing
}
