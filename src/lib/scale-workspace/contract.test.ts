import { describe, expect, it } from "vitest"
import {
  SCALE_WORKSPACE_APP_SLUG,
  isGeneralMemberWorkspacePath,
  isSensitiveWorkspacePath,
  isWorkspaceContextV1,
  isWorkspaceExemptApiPath,
} from "./contract"

/** Mirrors docs/workspaces/fixtures/workspace-context-v1.json in the hub repo. */
const fixture = {
  version: 1,
  actor: {
    keycloakSubject: "11111111-1111-4111-8111-111111111111",
    email: "member@example.com",
  },
  workspace: {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Acme Growth Team",
    type: "guest",
  },
  owner: {
    keycloakSubject: "33333333-3333-4333-8333-333333333333",
    displayName: "Workspace Owner",
    email: "owner@example.com",
  },
  membership: { role: "member", status: "active" },
  application: { slug: SCALE_WORKSPACE_APP_SLUG, capability: "general-member" },
  authorizationVersion: "0123456789abcdef01234567",
  expiresAt: "2026-08-18T12:05:00.000Z",
} as const

describe("workspace context validation", () => {
  it("accepts only the app-bound active member contract", () => {
    expect(isWorkspaceContextV1(fixture, SCALE_WORKSPACE_APP_SLUG)).toBe(true)
  })

  it("rejects other application slugs (including PipeLeads CRM)", () => {
    expect(isWorkspaceContextV1(fixture, "pipeleads")).toBe(false)
    expect(
      isWorkspaceContextV1(
        { ...fixture, application: { slug: "mailbaser", capability: "general-member" } },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
  })

  it("rejects revoked, non-member, non-guest, and malformed contexts", () => {
    expect(
      isWorkspaceContextV1(
        { ...fixture, membership: { role: "member", status: "revoked" } },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
    expect(
      isWorkspaceContextV1(
        { ...fixture, membership: { role: "owner", status: "active" } },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
    expect(
      isWorkspaceContextV1(
        { ...fixture, workspace: { ...fixture.workspace, type: "personal" } },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
    expect(
      isWorkspaceContextV1(
        { ...fixture, application: { slug: SCALE_WORKSPACE_APP_SLUG, capability: "admin" } },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
    expect(
      isWorkspaceContextV1({ ...fixture, version: 2 }, SCALE_WORKSPACE_APP_SLUG)
    ).toBe(false)
    expect(
      isWorkspaceContextV1(
        { ...fixture, expiresAt: "not-a-date" },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
    expect(
      isWorkspaceContextV1(
        { ...fixture, actor: { keycloakSubject: "", email: "member@example.com" } },
        SCALE_WORKSPACE_APP_SLUG
      )
    ).toBe(false)
    expect(isWorkspaceContextV1(null, SCALE_WORKSPACE_APP_SLUG)).toBe(false)
    expect(isWorkspaceContextV1("string", SCALE_WORKSPACE_APP_SLUG)).toBe(false)
  })
})

describe("sensitive paths deny", () => {
  it("blocks billing, balances, credentials, integrations, storage, automation, admin", () => {
    for (const path of [
      "/api/credits",
      "/api/credits/purchase",
      "/api/integrations",
      "/api/integrations/abc/deliver",
      "/api/files",
      "/api/files/upload",
      "/api/ai/agent",
      "/api/ai/agent/123/run",
      "/api/ai/agent/run-scheduled",
      "/api/admin/users",
      "/api/godmode/status",
      "/api/auth/dev-login",
      "/api/search/abc/schedule",
    ]) {
      expect(isSensitiveWorkspacePath(path), path).toBe(true)
    }
  })

  it("does not misclassify normal member work as sensitive", () => {
    for (const path of [
      "/api/lists",
      "/api/leads/abc",
      "/api/labels",
      "/api/search/people",
      "/api/enrich/email",
      "/api/credits/pricing",
    ]) {
      expect(isSensitiveWorkspacePath(path), path).toBe(false)
    }
  })
})

describe("member allowlist", () => {
  it("allows normal member work routes", () => {
    for (const path of [
      "/api/labels",
      "/api/labels/abc",
      "/api/labels/apply",
      "/api/labels/remove",
      "/api/lists",
      "/api/lists/abc",
      "/api/lists/abc/bulk",
      "/api/lists/abc/history",
      "/api/lists/abc/export",
      "/api/leads/abc",
      "/api/leads/abc/labels",
      "/api/leads/abc/labels/def",
      "/api/search/people",
      "/api/search/local",
      "/api/search/company",
      "/api/search/domain",
      "/api/search/influencer",
      "/api/search/abc/status",
      "/api/enrich/email",
      "/api/enrich/phone",
      "/api/enrich/bulk",
      "/api/jobs/abc",
      "/api/location-search",
      "/api/credits/pricing",
      "/api/scale-workspace/display-context",
    ]) {
      expect(isGeneralMemberWorkspacePath(path), path).toBe(true)
    }
  })

  it("fails closed for unknown or newly introduced guest API surfaces", () => {
    for (const path of [
      "/api/new-sensitive-feature",
      "/api/billing/portal",
      "/api/ai/assistant",
      "/api/ai/knowledge-base",
      "/api/ai/knowledge-base/sources",
      "/api/ai/prompts",
      "/api/lists/abc/score",
      "/api/search/abc/rerun",
      "/api/credits",
      "/api/integrations",
      "/api/files/upload",
      "/api/admin/anything",
    ]) {
      expect(isGeneralMemberWorkspacePath(path), path).toBe(false)
    }
  })
})

describe("gate exemptions", () => {
  it("keeps the member's own auth/session endpoints working", () => {
    expect(isWorkspaceExemptApiPath("/api/auth/session")).toBe(true)
    expect(isWorkspaceExemptApiPath("/api/auth/signout")).toBe(true)
    expect(isWorkspaceExemptApiPath("/api/health")).toBe(true)
    expect(isWorkspaceExemptApiPath("/api/scale-workspace/display-context")).toBe(true)
  })

  it("never exempts dev-login or business routes", () => {
    expect(isWorkspaceExemptApiPath("/api/auth/dev-login")).toBe(false)
    expect(isWorkspaceExemptApiPath("/api/lists")).toBe(false)
    expect(isWorkspaceExemptApiPath("/api/credits")).toBe(false)
  })
})
