/**
 * Class strings for the few native controls the Agent panel keeps (the
 * conversation and CRM destination pickers, and the list/lead checkboxes).
 * They stay native so behaviour is unchanged; these make them look like the
 * Suite's Input and Checkbox.
 */
export const nativeSelectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"

export const nativeCheckboxClass =
  "size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"

export const disclosureSummaryClass =
  "cursor-pointer text-sm font-medium text-foreground marker:text-muted-foreground"

export const codeBlockClass =
  "max-h-80 overflow-y-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs text-foreground"
