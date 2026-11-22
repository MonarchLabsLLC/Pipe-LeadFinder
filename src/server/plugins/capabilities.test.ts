/**
 * The capabilities contract: docs/plugin-capabilities.json must be exactly what
 * registry.ts generates, and must follow the wire contract's rules.
 *
 * Regenerate after changing registry.ts:
 *   UPDATE_PLUGIN_CAPABILITIES=1 npx vitest run src/server/plugins/capabilities.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/auth", () => ({ auth: async () => null }))

import { actions as agentActions } from "@/server/focused-agent/actions"
import { PLUGIN_ACTIONS, PLUGIN_AREAS, PLUGIN_EVENTS, pluginCapabilities } from "./registry"

const file = path.resolve(__dirname, "../../../docs/plugin-capabilities.json")
const generated = JSON.parse(JSON.stringify(pluginCapabilities()))

describe("plugin capabilities contract", () => {
  it("matches docs/plugin-capabilities.json", () => {
    if (process.env.UPDATE_PLUGIN_CAPABILITIES === "1" || !existsSync(file)) {
      writeFileSync(file, `${JSON.stringify(generated, null, 2)}\n`)
    }
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(generated)
  })

  it("names the app and the protocol", () => {
    expect(generated.protocolVersion).toBe("1")
    expect(generated.app).toBe("leadfinder")
  })

  it("uses stable kebab-case names, known areas and object input schemas", () => {
    const names = new Set<string>()
    const areas = new Set(PLUGIN_AREAS.map((area) => area.key))
    for (const action of generated.actions) {
      expect(action.name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
      expect(names.has(action.name)).toBe(false)
      names.add(action.name)
      expect(areas.has(action.area)).toBe(true)
      expect(["read", "write", "act"]).toContain(action.level)
      expect(action.inputSchema.type).toBe("object")
    }
  })

  it("gives every area with an act action an actLabel, and no other", () => {
    for (const area of PLUGIN_AREAS) {
      const acts = PLUGIN_ACTIONS.some((action) => action.area === area.key && action.level === "act")
      expect(Boolean(area.actLabel)).toBe(acts)
    }
  })

  it("treats everything that spends credits as act, and only labels as write", () => {
    const level = (name: string) => PLUGIN_ACTIONS.find((action) => action.name === name)?.level
    for (const name of ["run-search", "rerun-search", "enrich-leads", "enrich-list", "score-leads", "create-agent"]) {
      expect(level(name)).toBe("act")
    }
    expect(PLUGIN_ACTIONS.filter((action) => action.level === "write").map((action) => action.name)).toEqual(["change-labels"])
  })

  it("exposes nothing that reaches into another app or spends AI on a read", () => {
    const tools = PLUGIN_ACTIONS.flatMap((action) => (action.run.kind === "agent-read" ? [action.run.tool] : []))
    for (const tool of tools) expect(agentActions[tool].tier).toBe("read")
    for (const banned of ["interpret_request", "get_handoff_options", "get_crm_destinations", "get_crm_transfer_status"]) {
      expect(tools as string[]).not.toContain(banned)
    }
    const plans = PLUGIN_ACTIONS.flatMap((action) => (action.run.kind === "plan" ? [action.run.plan] : []))
    expect(plans).not.toContain("handoff")
  })

  it("interpret-request is a free read and get-agent-run a read; create-agent always asks", () => {
    const named = (name: string) => PLUGIN_ACTIONS.find((action) => action.name === name)
    expect(named("interpret-request")).toMatchObject({ area: "searches", level: "read", run: { kind: "interpret" } })
    expect(named("interpret-request")?.description).toMatch(/Free for plugins/)
    expect(named("get-agent-run")).toMatchObject({ area: "agents", level: "read", run: { kind: "agent-run" } })
    expect(named("create-agent")?.description).toMatch(/Always waits for the owner's approval/)
    for (const name of ["run-search", "rerun-search", "enrich-leads", "enrich-list", "score-leads"]) {
      expect(named(name)?.description).toMatch(/never takes it below zero/)
    }
  })

  it("prefixes every event with the app and files it under a known area", () => {
    const areas = new Set(PLUGIN_AREAS.map((area) => area.key))
    for (const event of PLUGIN_EVENTS) {
      expect(event.type.startsWith("leadfinder.")).toBe(true)
      expect(areas.has(event.area)).toBe(true)
    }
  })
})
