import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { verifySignedRequest } from "./signing"

const SECRET = "k".repeat(48)

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  guest: false,
  denied: null as null | { status: number; error: string },
  user: null as null | { email: string; name: string | null; keycloakSubId: string | null },
  leads: [] as Record<string, unknown>[],
  leadQueries: [] as unknown[],
}))

vi.mock("@/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => state.user },
    lead: {
      findMany: async (query: { where: { id: { in: string[] } } }) => {
        state.leadQueries.push(query)
        return state.leads.filter((lead) => query.where.id.in.includes(lead.id as string))
      },
    },
  },
}))
vi.mock("@/lib/scale-workspace/guest", () => ({
  resolveWorkspaceScope: async (session: { user?: { id?: string } } | null) => {
    if (state.denied) {
      return { ok: false, response: NextResponse.json({ error: state.denied.error }, { status: state.denied.status }) }
    }
    const id = session?.user?.id as string
    return state.guest
      ? { ok: true, isGuest: true, tenantUserId: "owner_1", tenantEmail: "owner@x.co", actorUserId: id, effectiveRole: "user", workspaceId: "ws" }
      : { ok: true, isGuest: false, tenantUserId: id, tenantEmail: "me@x.co", actorUserId: id, effectiveRole: "admin", workspaceId: null }
  },
}))

const statusRoute = await import("@/app/api/handoff/status/route")
const suiteSend = await import("@/app/api/handoff/pipeleads/send/route")
const suiteOptions = await import("@/app/api/handoff/pipeleads/options/route")
const mailSend = await import("@/app/api/handoff/mailbaser/send/route")

function lead(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    firstName: "Ada",
    lastName: "Lovelace",
    fullName: null,
    title: "CTO",
    headline: null,
    city: null,
    state: null,
    country: null,
    email: `${id}@example.com`,
    emailStatus: "FOUND",
    phone: null,
    phoneStatus: "UNKNOWN",
    linkedinUrl: null,
    companyName: "Engines",
    companyWebsite: null,
    companyIndustry: null,
    companySize: null,
    listEntries: [{ list: { name: "My list" } }],
    ...overrides,
  }
}

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

type Captured = { url: string; headers: Record<string, string>; body: string }
let captured: Captured[] = []
let reply: (body: Record<string, unknown>) => Response

beforeEach(() => {
  vi.stubEnv("PIPELEADS_SUITE_URL", "https://suite.test/")
  vi.stubEnv("LEADFINDER_SUITE_SERVICE_SECRET", SECRET)
  vi.stubEnv("MAILBASER_URL", "https://mail.test")
  vi.stubEnv("LEADFINDER_MAILBASER_SERVICE_SECRET", SECRET)
  state.session = { user: { id: "user_1", email: "me@x.co" } }
  state.guest = false
  state.denied = null
  state.user = { email: "Me@X.co", name: "Me", keycloakSubId: "kc-sub-1" }
  state.leads = [lead("l1"), lead("l2", { email: null, emailStatus: "NOT_FOUND" })]
  state.leadQueries = []
  captured = []
  reply = (body) => {
    const items = (body.leads ?? body.contacts) as { externalId: string }[] | undefined
    return Response.json({
      data: {
        results: (items ?? []).map((item) => ({ externalId: item.externalId, status: "created", contactId: `c_${item.externalId}`, url: null })),
      },
    })
  }
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const body = String(init.body)
    captured.push({ url, headers: init.headers as Record<string, string>, body })
    return reply(JSON.parse(body))
  }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/handoff/status", () => {
  it("requires a session and reports only flags", async () => {
    state.session = null
    expect((await statusRoute.GET()).status).toBe(401)
    state.session = { user: { id: "user_1", email: "me@x.co" } }
    vi.stubEnv("LEADFINDER_MAILBASER_SERVICE_SECRET", "short")
    const response = await statusRoute.GET()
    expect(await response.json()).toEqual({ pipeleads: true, mailbaser: false })
  })
})

describe("POST /api/handoff/pipeleads/send", () => {
  it("answers 404 when the target is not configured", async () => {
    vi.stubEnv("LEADFINDER_SUITE_SERVICE_SECRET", "")
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("answers 401 without a session", async () => {
    state.session = null
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(401)
  })

  it("passes through a denied workspace scope", async () => {
    state.denied = { status: 403, error: "Workspace session is invalid." }
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(403)
  })

  it("is owner-only inside a guest workspace", async () => {
    state.guest = true
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe("Only the workspace owner can send leads to PipeLeads.")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("needs a Keycloak subject", async () => {
    state.user = { email: "me@x.co", name: null, keycloakSubId: null }
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe("keycloak_subject_required")
  })

  it("rejects bad bodies and more than 50 leads", async () => {
    expect((await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: [] }))).status).toBe(400)
    expect((await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"], extra: 1 }))).status).toBe(400)
    const tooMany = await suiteSend.POST(
      post("/api/handoff/pipeleads/send", { leadIds: Array.from({ length: 51 }, (_, i) => `l${i}`) })
    )
    expect(tooMany.status).toBe(400)
    expect((await tooMany.json()).code).toBe("too_many_leads")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends only scoped leads, signed, and reports out-of-scope ids as skipped", async () => {
    const response = await suiteSend.POST(
      post("/api/handoff/pipeleads/send", {
        leadIds: ["l1", "foreign", "l1"],
        createDeals: true,
        pipelineId: "p1",
        stageId: "s1",
        tagNames: ["hot"],
      })
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.counts).toEqual({ created: 1, updated: 0, skipped: 1 })
    expect(data.openUrl).toBe("https://suite.test/crm/contacts")
    expect(data.results.map((r: { externalId: string; status: string }) => [r.externalId, r.status])).toEqual([
      ["l1", "created"],
      ["foreign", "skipped"],
    ])

    // The query is tenant-scoped through the owner's own lists.
    expect(JSON.stringify(state.leadQueries[0])).toContain('"userId":"user_1"')

    expect(captured).toHaveLength(1)
    const [call] = captured
    expect(call.url).toBe("https://suite.test/api/internal/leadfinder/leads")
    expect(verifySignedRequest(SECRET, call.headers, call.body)).toBe(true)
    const sent = JSON.parse(call.body)
    expect(sent.requestId).toBe(call.headers["x-scaleplus-request-id"])
    expect(sent.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(sent).toMatchObject({
      subject: "kc-sub-1",
      email: "me@x.co",
      name: "Me",
      createDeals: true,
      pipelineId: "p1",
      stageId: "s1",
      tagNames: ["hot"],
    })
    expect(sent.leads).toEqual([
      expect.objectContaining({ externalId: "l1", email: "l1@example.com", sourceListName: "My list" }),
    ])
  })

  it("does not call the receiver when nothing is in scope", async () => {
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["foreign"] }))
    expect((await response.json()).counts).toEqual({ created: 0, updated: 0, skipped: 1 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("passes through a receiver error message", async () => {
    reply = () =>
      Response.json({ error: { code: "workspace_unavailable", message: "Your PipeLeads workspace is not ready." } }, { status: 409 })
    const response = await suiteSend.POST(post("/api/handoff/pipeleads/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "workspace_unavailable", error: "Your PipeLeads workspace is not ready." })
  })
})

describe("GET /api/handoff/pipeleads/options", () => {
  it("returns the receiver options, unwrapped", async () => {
    reply = () => Response.json({ workspaceName: "Acme", pipelines: [], tags: [] })
    const response = await suiteOptions.GET()
    expect(await response.json()).toEqual({ workspaceName: "Acme", pipelines: [], tags: [] })
    expect(captured[0].url).toBe("https://suite.test/api/internal/leadfinder/options")
    expect(verifySignedRequest(SECRET, captured[0].headers, captured[0].body)).toBe(true)
  })
})

describe("POST /api/handoff/mailbaser/send", () => {
  it("skips leads without an email and never sends them", async () => {
    const response = await mailSend.POST(
      post("/api/handoff/mailbaser/send", { leadIds: ["l1", "l2"], listIds: ["list_a"], tagIds: ["tag_a"] })
    )
    const data = await response.json()
    expect(data.counts).toEqual({ created: 1, updated: 0, skipped: 1 })
    expect(data.results[1]).toMatchObject({ externalId: "l2", status: "skipped", reason: "no_email" })
    expect(data.openUrl).toBe("https://mail.test/contacts")
    const sent = JSON.parse(captured[0].body)
    expect(captured[0].url).toBe("https://mail.test/api/internal/scaleplus/leadfinder/contacts")
    expect(sent.contacts.map((c: { externalId: string }) => c.externalId)).toEqual(["l1"])
    expect(sent).toMatchObject({ listIds: ["list_a"], tagIds: ["tag_a"], subject: "kc-sub-1" })
  })

  it("passes through mailbaser_account_required", async () => {
    reply = () =>
      Response.json(
        { error: { code: "mailbaser_account_required", message: "Create or sign in to your MailBaser account first, then try again." } },
        { status: 409 }
      )
    const response = await mailSend.POST(post("/api/handoff/mailbaser/send", { leadIds: ["l1"] }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: "mailbaser_account_required",
      error: "Create or sign in to your MailBaser account first, then try again.",
    })
  })

  it("rejects pipeline fields it does not understand", async () => {
    const response = await mailSend.POST(post("/api/handoff/mailbaser/send", { leadIds: ["l1"], createDeals: true }))
    expect(response.status).toBe(400)
  })
})
