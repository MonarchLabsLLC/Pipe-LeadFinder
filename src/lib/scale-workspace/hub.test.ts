import { afterEach, describe, expect, it } from "vitest"
import { isScaleWorkspaceOwnerUsageEnabled } from "./hub"

const originalOwnerUsage = process.env.SCALE_TEAM_WORKSPACES_OWNER_USAGE_ENABLED

afterEach(() => {
  if (originalOwnerUsage === undefined) {
    delete process.env.SCALE_TEAM_WORKSPACES_OWNER_USAGE_ENABLED
  } else {
    process.env.SCALE_TEAM_WORKSPACES_OWNER_USAGE_ENABLED = originalOwnerUsage
  }
})

describe("workspace owner usage policy", () => {
  it("remains disabled unless explicitly enabled on the server", () => {
    delete process.env.SCALE_TEAM_WORKSPACES_OWNER_USAGE_ENABLED
    expect(isScaleWorkspaceOwnerUsageEnabled()).toBe(false)

    process.env.SCALE_TEAM_WORKSPACES_OWNER_USAGE_ENABLED = "false"
    expect(isScaleWorkspaceOwnerUsageEnabled()).toBe(false)

    process.env.SCALE_TEAM_WORKSPACES_OWNER_USAGE_ENABLED = "true"
    expect(isScaleWorkspaceOwnerUsageEnabled()).toBe(true)
  })
})
