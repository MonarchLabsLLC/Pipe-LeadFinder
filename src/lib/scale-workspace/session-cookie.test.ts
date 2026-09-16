import { beforeEach, describe, expect, it } from "vitest"
import { SCALE_WORKSPACE_APP_SLUG } from "./contract"
import {
  sealWorkspaceSession,
  unsealWorkspaceSession,
} from "./session-cookie"

const context = {
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

const payload = {
  context,
  ownerUserId: "owner-local-id",
  actorUserId: "actor-local-id",
  actorKeycloakSubject: context.actor.keycloakSubject,
  allowedApplications: [SCALE_WORKSPACE_APP_SLUG],
}

describe("sealed workspace session cookie", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-only-secret-for-sealing"
  })

  it("round trips and keeps the member as the actor", async () => {
    const sealed = await sealWorkspaceSession(structuredClone(payload))
    expect(sealed).not.toContain("owner-local-id")
    expect(sealed).not.toContain("keycloakSubject")
    const unsealed = await unsealWorkspaceSession(sealed)
    expect(unsealed).not.toBeNull()
    expect(unsealed!.actorUserId).toBe("actor-local-id")
    expect(unsealed!.ownerUserId).toBe("owner-local-id")
    expect(unsealed!.context.workspace.id).toBe(context.workspace.id)
  })

  it("rejects tampered, truncated, and garbage values", async () => {
    const sealed = await sealWorkspaceSession(structuredClone(payload))
    const tampered = sealed.slice(0, -4) + (sealed.endsWith("AAAA") ? "BBBB" : "AAAA")
    expect(await unsealWorkspaceSession(tampered)).toBeNull()
    expect(await unsealWorkspaceSession(sealed.slice(0, 16))).toBeNull()
    expect(await unsealWorkspaceSession("not-a-cookie")).toBeNull()
    expect(await unsealWorkspaceSession("")).toBeNull()
  })

  it("rejects payloads sealed for another application slug", async () => {
    const foreign = structuredClone(payload) as unknown as {
      context: { application: { slug: string } }
    }
    foreign.context.application.slug = "pipeleads"
    const sealed = await sealWorkspaceSession(
      foreign as unknown as Parameters<typeof sealWorkspaceSession>[0]
    )
    expect(await unsealWorkspaceSession(sealed)).toBeNull()
  })

  it("rejects values sealed with a different secret", async () => {
    const sealed = await sealWorkspaceSession(structuredClone(payload))
    process.env.AUTH_SECRET = "a-completely-different-secret"
    expect(await unsealWorkspaceSession(sealed)).toBeNull()
  })
})
