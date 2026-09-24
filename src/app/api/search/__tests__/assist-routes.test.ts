import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const state = vi.hoisted(() => ({
  session: { user: { id: "member_1", email: "member@x.co" } } as null | { user: { id: string; email: string } },
  guest: false,
  ownerUsageDenied: false,
  creditsBlocked: false,
  calls: [] as string[],
  historyQueries: [] as unknown[],
  interpretArgs: [] as unknown[],
}))

vi.mock("@/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/ensure-user", () => ({ ensureUser: async () => undefined }))
vi.mock("@/lib/scale-workspace/guest", () => ({
  resolveWorkspaceScope: async (session: { user: { id: string } }) =>
    state.guest
      ? { ok: true, isGuest: true, tenantUserId: "owner_1", tenantEmail: "owner@x.co", actorUserId: session.user.id, effectiveRole: "user", workspaceId: "ws" }
      : { ok: true, isGuest: false, tenantUserId: session.user.id, tenantEmail: "member@x.co", actorUserId: session.user.id, effectiveRole: "user", workspaceId: null },
  denyUnapprovedOwnerUsage: () =>
    state.ownerUsageDenied ? NextResponse.json({ error: "disabled" }, { status: 403 }) : null,
}))
vi.mock("@/lib/credit-guard", () => ({
  guardCredits: async (userId: string) => {
    state.calls.push(`guard:${userId}`)
    return state.creditsBlocked
      ? NextResponse.json({ error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" }, { status: 402 })
      : null
  },
}))
vi.mock("@/services/search-interpret-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/search-interpret-service")>(
    "@/services/search-interpret-service"
  )
  return {
    ...actual,
    interpretSearch: async (args: unknown) => {
      state.calls.push("interpret")
      state.interpretArgs.push(args)
      return { ok: true, searchType: "LOCAL", fields: { businessType: "Dentist" }, explanation: "x", droppedFields: [] }
    },
  }
})
vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchHistory: {
      findMany: async (query: unknown) => {
        state.historyQueries.push(query)
        return []
      },
    },
  },
}))

const interpretRoute = await import("@/app/api/search/interpret/route")
const recentRoute = await import("@/app/api/search/recent/route")

function post(body: unknown) {
  return new NextRequest("http://localhost/api/search/interpret", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "k1" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  state.session = { user: { id: "member_1", email: "member@x.co" } }
  state.guest = false
  state.ownerUsageDenied = false
  state.creditsBlocked = false
  state.calls = []
  state.historyQueries = []
  state.interpretArgs = []
})

describe("POST /api/search/interpret", () => {
  it("checks credits before calling the model and bills the tenant", async () => {
    const res = await interpretRoute.POST(post({ text: "dentists in Tampa" }))
    expect(res.status).toBe(200)
    expect(state.calls).toEqual(["guard:member_1", "interpret"])
    expect(state.interpretArgs[0]).toMatchObject({ userId: "member_1", email: "member@x.co", idempotencyKey: "k1" })
  })

  it("does not call the model when credits are blocked", async () => {
    state.creditsBlocked = true
    const res = await interpretRoute.POST(post({ text: "dentists in Tampa" }))
    expect(res.status).toBe(402)
    expect(state.calls).toEqual(["guard:member_1"])
  })

  it("bills the bound owner for a guest, and respects the owner-usage gate", async () => {
    state.guest = true
    await interpretRoute.POST(post({ text: "dentists in Tampa" }))
    expect(state.interpretArgs[0]).toMatchObject({ userId: "owner_1", email: "owner@x.co" })

    state.calls = []
    state.ownerUsageDenied = true
    const denied = await interpretRoute.POST(post({ text: "dentists in Tampa" }))
    expect(denied.status).toBe(403)
    expect(state.calls).toEqual([])
  })

  it("rejects missing or too-short text and unauthenticated calls", async () => {
    expect((await interpretRoute.POST(post({ text: "a" }))).status).toBe(400)
    expect((await interpretRoute.POST(post({ text: "dentists", extra: 1 }))).status).toBe(400)
    state.session = null
    expect((await interpretRoute.POST(post({ text: "dentists" }))).status).toBe(401)
  })
})

describe("GET /api/search/recent", () => {
  it("returns the signed-in user's last six searches with active lists", async () => {
    const res = await recentRoute.GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ searches: [], canRerun: true })
    expect(state.historyQueries[0]).toMatchObject({
      where: { userId: "member_1", list: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      take: 6,
    })
  })

  it("scopes a guest to the bound owner's tenant and hides Run again", async () => {
    state.guest = true
    const res = await recentRoute.GET()
    expect(await res.json()).toEqual({ searches: [], canRerun: false })
    expect(state.historyQueries[0]).toMatchObject({ where: { userId: "owner_1" } })
  })

  it("rejects unauthenticated calls", async () => {
    state.session = null
    expect((await recentRoute.GET()).status).toBe(401)
  })
})
