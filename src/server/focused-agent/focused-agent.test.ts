import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { resolveActor } from "./access"
import { dispatch } from "./actions"
import { decideProposal, proposalView } from "./proposals"
import { handleNative, handleService } from "./http"
import { signFocusedRequest } from "./security"
import { createThread, enqueueChat, getState, runChat, getRun } from "./runtime"
import { requireApprovedJob } from "./job-guard"
import { processSearchJob } from "@/services/search-job"
import { processBulkJob } from "@/services/bulk-job"
import { runTrackedJob } from "@/lib/jobs/service"
import { enrichPhone } from "@/services/enrich-service"

const state = vi.hoisted(() => ({
  userId: "",
  allowed: true,
  provider: "keycloak",
  balance: 10000,
  price: 7,
  configured: true,
  charges: [] as unknown[],
  tokenCharges: 0,
  billingFails: false,
  generations: 0,
  searches: 0,
  enrichments: 0,
  modelCalls: [] as { toolName: string; toolCallId: string; input: unknown }[],
}))
vi.mock("@/auth", () => ({
  auth: async () => ({
    user: { id: state.userId },
    authProvider: state.provider,
  }),
}))
vi.mock("@/lib/jobs/queue", () => ({
  getJobBoss: async () => ({
    send: async (
      _name: string,
      _data: unknown,
      options: { retryLimit: number }
    ) => {
      expect(options.retryLimit).toBe(0)
      return randomUUID()
    },
  }),
}))
vi.mock("@/services/search-service", () => ({
  assertSearchConfigured: () => {},
  executeSearch: async () => {
    state.searches++
    return [
      {
        fullName: "New prospect",
        email: `found-${randomUUID()}@test.invalid`,
        companyName: "Test company",
      },
    ]
  },
}))
vi.mock("@/lib/apify", () => ({
  apifyClient: {
    actor: () => ({
      call: async () => {
        state.enrichments++
        return { defaultDatasetId: "test-dataset" }
      },
    }),
    dataset: () => ({
      listItems: async () => ({ items: [{ phone: "+15555550123" }] }),
    }),
  },
}))
vi.mock("@/services/credits-service", () => ({
  getBalance: async () => ({ availableCredits: state.balance }),
  getPipeLeadsPricing: async () =>
    [
      "search:people",
      "search:local",
      "search:company",
      "search:domain",
      "search:influencer",
      "enrich:email",
      "enrich:phone",
    ].map((action) => ({
      action,
      model: action,
      creditsPerHit: state.price,
      configured: state.configured,
      updatedAt: "2026-09-03T00:00:00.000Z",
    })),
  consumeCredits: async (_id: string, input: unknown) => {
    state.charges.push(input)
    return { success: !state.billingFails }
  },
  consumeTokenCredits: async () => {
    state.tokenCharges++
    return { success: !state.billingFails }
  },
}))
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: async () => {
    state.generations++
    const calls = state.modelCalls.splice(0)
    return {
      text: "**Saved answer**\n\nChoose an existing list to start.",
      toolCalls: calls,
      usage: { inputTokens: 10, outputTokens: 5 },
      response: {
        messages: [
          { role: "assistant", content: "Choose an existing list to start." },
        ],
      },
    }
  },
}))
const enabled = process.env.DATABASE_URL?.startsWith(
  "postgresql://focused_test@localhost:15439/leadfinder_agent_test"
)
describe.skipIf(!enabled)(
  "focused Lead Finder (disposable local database only)",
  () => {
    const subject = randomUUID(),
      stranger = randomUUID()
    let userId: string,
      otherId: string,
      listId: string,
      otherList: string,
      leadId: string,
      completeId: string,
      otherLead: string
    beforeAll(async () => {
      for (const key of [
        "LEADFINDER_AGENT_ENABLED",
        "LEADFINDER_GODMODE_ENABLED",
        "LEADFINDER_AGENT_WRITES_ENABLED",
      ])
        vi.stubEnv(key, "true")
      vi.stubEnv(
        "LEADFINDER_GODMODE_SERVICE_SECRET",
        "test-only-secret-".repeat(4)
      )
      vi.stubEnv("CLICKCAMPAIGNS_GODMODE_BASE_URL", "http://localhost:15440")
      vi.stubEnv("AUTH_URL", "http://localhost:3030")
      vi.stubEnv("MICRO_SERVICE_BASE", "http://localhost:15441/api")
      vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "test-credits-only")
      vi.stubEnv("APIFY_ACTOR_ENRICH_PHONE", "test-phone-only")
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: URL | string, init?: RequestInit) => {
          if (!String(url).includes("/entitlement/"))
            throw new Error(`Unexpected network request: ${url}`)
          const body = JSON.parse(init?.body as string)
          return Response.json({
            protocolVersion: "1",
            data: {
              subject: body.subject,
              active: state.allowed,
              godmode: state.allowed,
              suspended: false,
              destinationAccess: state.allowed,
            },
          })
        })
      )
      userId = (
        await prisma.user.create({
          data: { email: `${subject}@test.invalid`, keycloakSubId: subject },
        })
      ).id
      otherId = (
        await prisma.user.create({
          data: { email: `${stranger}@test.invalid`, keycloakSubId: stranger },
        })
      ).id
      listId = (
        await prisma.leadList.create({
          data: { userId, name: "Approved people list", type: "PEOPLE" },
        })
      ).id
      otherList = (
        await prisma.leadList.create({
          data: { userId: otherId, name: "Other user's list", type: "PEOPLE" },
        })
      ).id
      leadId = (
        await prisma.lead.create({
          data: {
            userId,
            sourceType: "PEOPLE",
            fullName: "Missing contact",
            linkedinUrl: "https://linkedin.com/in/test",
          },
        })
      ).id
      completeId = (
        await prisma.lead.create({
          data: {
            userId,
            sourceType: "PEOPLE",
            fullName: "Complete contact",
            email: "complete@test.invalid",
            phone: "+15555550000",
          },
        })
      ).id
      otherLead = (
        await prisma.lead.create({
          data: {
            userId: otherId,
            sourceType: "PEOPLE",
            fullName: "Private other lead",
          },
        })
      ).id
      await prisma.leadListEntry.createMany({
        data: [
          { listId, leadId },
          { listId, leadId: completeId },
          { listId: otherList, leadId: otherLead },
        ],
      })
    })
    beforeEach(() => {
      Object.assign(state, {
        userId,
        allowed: true,
        provider: "keycloak",
        balance: 10000,
        price: 7,
        configured: true,
        charges: [],
        tokenCharges: 0,
        billingFails: false,
        generations: 0,
        searches: 0,
        enrichments: 0,
        modelCalls: [],
      })
    })
    afterAll(async () => {
      const users = [userId, otherId]
      await prisma.focusedAgentThread.deleteMany({
        where: { userId: { in: users } },
      })
      await prisma.focusedAgentApproval.deleteMany({
        where: { userId: { in: users } },
      })
      await prisma.focusedAgentAudit.deleteMany({
        where: { userId: { in: users } },
      })
      await prisma.focusedAgentContext.deleteMany({
        where: { userId: { in: users } },
      })
      await prisma.focusedAgentNonce.deleteMany({
        where: { subject: { in: [subject, stranger] } },
      })
      await prisma.jobRun.deleteMany({ where: { userId: { in: users } } })
      await prisma.searchHistory.deleteMany({
        where: { userId: { in: users } },
      })
      await prisma.leadList.deleteMany({ where: { userId: { in: users } } })
      await prisma.user.deleteMany({ where: { id: { in: users } } })
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    })
    const actor = () => resolveActor(subject, "native", userId)
    const prep = async (name: string, input: unknown) =>
      dispatch(await actor(), name, input, { key: randomUUID() }) as Promise<
        Awaited<ReturnType<typeof proposalView>>
      >
    const search = () => ({
      type: "PEOPLE",
      parameters: {
        listId,
        description: "Marketing executives in Florida",
        resultsLimit: 2,
      },
    })
    const native = (path: string, input?: unknown) =>
      handleNative(
        new Request(`http://localhost:3030/api/focused-agent/${path}`, {
          method: input === undefined ? "GET" : "POST",
          headers: {
            Origin: "http://localhost:3030",
            "X-Focused-Agent-Action": "1",
          },
          body: input === undefined ? undefined : JSON.stringify(input),
        }),
        path.split("?", 1)[0].split("/"),
        () => {}
      )
    async function service(
      action: string,
      input: unknown,
      approval?: {
        mode: "mcp-elicitation"
        proposalId: string
        proposalHash: string
      }
    ) {
      const path =
        action === "execute_proposal"
          ? `/api/godmode/service/v1/proposals/${(input as { proposalId: string }).proposalId}/execute`
          : `/api/godmode/service/v1/actions/${action}`
      const sessionId = randomUUID(),
        requestId = randomUUID(),
        body = {
          protocolVersion: "1",
          workspaceId: userId,
          input,
          idempotencyKey: randomUUID(),
          lineage: {
            threadId: "t",
            runId: "r",
            turnId: "t",
            mcpSessionId: sessionId,
            requestId,
          },
        }
      const token = await signFocusedRequest({
        secret: process.env.LEADFINDER_GODMODE_SERVICE_SECRET!,
        issuer: "clickcampaigns-godmode-mcp",
        audience: "leadfinder-godmode-service-v1",
        subject,
        action,
        path,
        body,
        sessionId,
        requestId,
        approval,
      })
      const req = () =>
        new Request(`http://localhost:3030${path}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      return {
        response: await handleService(req(), path.split("/").slice(5)),
        replay: () => handleService(req(), path.split("/").slice(5)),
      }
    }
    it("fails closed for forged IDs, workspace changes, revoked access, dev sessions and CSRF", async () => {
      const a = await actor()
      await expect(resolveActor(subject, "mcp", otherId)).rejects.toMatchObject(
        { code: "WORKSPACE_FORBIDDEN" }
      )
      await expect(resolveActor(randomUUID(), "mcp")).rejects.toMatchObject({
        code: "WORKSPACE_FORBIDDEN",
      })
      await expect(
        dispatch(a, "get_list", { listId: otherList }, { key: randomUUID() })
      ).rejects.toMatchObject({ code: "LIST_NOT_FOUND" })
      await expect(
        prep("prepare_enrichment", { listId, leadIds: [otherLead] })
      ).rejects.toMatchObject({ code: "LEAD_NOT_FOUND" })
      state.allowed = false
      expect((await native("access")).status).toBe(403)
      state.allowed = true
      state.provider = "development"
      expect((await native("access")).status).toBe(401)
      state.provider = "keycloak"
      expect(
        (
          await handleNative(
            new Request("http://localhost:3030/api/focused-agent/threads", {
              method: "POST",
              body: "{}",
            }),
            ["threads"],
            () => {}
          )
        ).status
      ).toBe(403)
      await expect(
        dispatch(a, "delete_list", { listId }, { key: randomUUID() })
      ).rejects.toMatchObject({ code: "UNSUPPORTED_ACTION" })
    })
    it("requires complete interviews, current configured pricing and enough credits", async () => {
      await expect(
        prep("prepare_search", { type: "PEOPLE", parameters: { listId } })
      ).rejects.toBeDefined()
      const p = await prep("prepare_search", search())
      expect(
        (p.preview as { cost: { maximumCredits: number } }).cost.maximumCredits
      ).toBe(14)
      state.balance = 13
      await expect(prep("prepare_search", search())).rejects.toMatchObject({
        code: "INSUFFICIENT_CREDITS",
      })
      state.balance = 100
      state.configured = false
      await expect(prep("prepare_search", search())).rejects.toMatchObject({
        code: "PRICING_UNAVAILABLE",
      })
      expect(state.searches).toBe(0)
      expect(state.charges).toHaveLength(0)
    })
    it("binds immutable prices and records, rejects stale/expired proposals and records rejection", async () => {
      const a = await actor(),
        p = await prep("prepare_search", search())
      state.price = 8
      await expect(
        decideProposal(a, p.id, p.proposalHash, "approve")
      ).rejects.toMatchObject({ code: "STALE_PROPOSAL" })
      state.price = 7
      await expect(
        decideProposal(a, p.id, "a".repeat(64), "approve")
      ).rejects.toMatchObject({ code: "PROPOSAL_HASH_MISMATCH" })
      expect(
        (await decideProposal(a, p.id, p.proposalHash, "reject")).status
      ).toBe("rejected")
      expect(
        (await decideProposal(a, p.id, p.proposalHash, "approve")).status
      ).toBe("rejected")
      const q = await prep("prepare_search", search())
      vi.useFakeTimers()
      vi.setSystemTime(Date.now() + 16 * 60000)
      await expect(
        decideProposal(a, q.id, q.proposalHash, "approve")
      ).rejects.toMatchObject({ code: "PROPOSAL_EXPIRED" })
      vi.useRealTimers()
    })
    it("queues once under duplicate approvals and never repeats a completed paid job", async () => {
      const a = await actor(),
        p = await prep("prepare_search", search())
      await Promise.all([
        decideProposal(a, p.id, p.proposalHash, "approve"),
        decideProposal(a, p.id, p.proposalHash, "approve"),
      ])
      const job = await prisma.jobRun.findUniqueOrThrow({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: `focused-agent:${p.id}`,
          },
        },
      })
      await runTrackedJob(job.id, () => processSearchJob(job.id))
      await runTrackedJob(job.id, () => processSearchJob(job.id))
      expect(state.searches).toBe(1)
      expect(state.charges).toHaveLength(1)
      expect(state.charges[0]).toMatchObject({
        amount: 7,
        metadata: {
          proposalId: p.id,
          idempotencyKey: `focused-agent:${p.id}:search`,
        },
      })
      expect((await getRun(a, job.id)).status).toBe("completed")
    })
    it("rechecks access before queued jobs and refuses interrupted-job retries", async () => {
      const a = await actor(),
        p = await prep("prepare_search", search()),
        v = await decideProposal(a, p.id, p.proposalHash, "approve")
      const jobId = (v.result as { jobId: string }).jobId
      state.allowed = false
      await expect(
        runTrackedJob(jobId, () => processSearchJob(jobId))
      ).rejects.toMatchObject({ code: "PROMAX_REQUIRED" })
      state.allowed = true
      await expect(
        runTrackedJob(jobId, () => processSearchJob(jobId))
      ).rejects.toThrow("will not be automatically repeated")
      expect(state.searches).toBe(0)
    })
    it("previews skips, scopes enrichment, and rejects changed records before persistence", async () => {
      const p = await prep("prepare_enrichment", {
        listId,
        leadIds: [leadId, completeId],
        field: "phone",
      })
      expect((p.preview as { skipped: unknown[] }).skipped).toHaveLength(1)
      const a = await actor(),
        v = await decideProposal(a, p.id, p.proposalHash, "approve"),
        jobId = (v.result as { jobId: string }).jobId
      const approval = await requireApprovedJob(jobId)
      const original = (
        approval.versions.leads as { id: string; version: string }[]
      ).find((x) => x.id === leadId)!
      await expect(
        enrichPhone(leadId, {
          userId,
          version: original.version,
          beforePersist: async () => {
            await prisma.lead.update({
              where: { id: leadId },
              data: { title: "Changed since preview" },
            })
          },
        })
      ).rejects.toBeDefined()
      expect(
        (await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).phone
      ).toBeNull()
      await expect(
        runTrackedJob(jobId, () => processBulkJob(jobId))
      ).rejects.toMatchObject({ code: "STALE_PROPOSAL" })
      expect(state.charges).toHaveLength(0)
    })
    it("completes approved enrichment once and meters failed scoring output before parsing", async () => {
      const a = await actor(),
        p = await prep("prepare_enrichment", {
          listId,
          leadIds: [leadId],
          field: "phone",
        })
      const v = await decideProposal(a, p.id, p.proposalHash, "approve"),
        jobId = (v.result as { jobId: string }).jobId
      await runTrackedJob(jobId, () => processBulkJob(jobId))
      await runTrackedJob(jobId, () => processBulkJob(jobId))
      expect(state.enrichments).toBe(1)
      expect(state.charges).toHaveLength(1)
      expect(
        (await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).phone
      ).toBe("+15555550123")
      const score = await prep("prepare_scoring", { listId, leadIds: [leadId] })
      const queued = await decideProposal(
          a,
          score.id,
          score.proposalHash,
          "approve"
        ),
        scoreJob = (queued.result as { jobId: string }).jobId
      await expect(
        runTrackedJob(scoreJob, () => processBulkJob(scoreJob))
      ).rejects.toThrow("JSON array")
      expect(state.tokenCharges).toBe(1)
      await expect(
        runTrackedJob(scoreJob, () => processBulkJob(scoreJob))
      ).rejects.toThrow("will not be automatically repeated")
      expect(state.tokenCharges).toBe(1)
    })
    it("recovers a lost worker as needs-review without replaying paid work", async () => {
      const a = await actor(),
        p = await prep("prepare_search", search()),
        v = await decideProposal(a, p.id, p.proposalHash, "approve")
      const jobId = (v.result as { jobId: string }).jobId
      await prisma.jobRun.update({
        where: { id: jobId },
        data: { status: "RUNNING", updatedAt: new Date(Date.now() - 120000) },
      })
      const recovered = await getRun(a, jobId)
      expect(recovered.status).toBe("failed")
      expect(recovered).toMatchObject({
        stage: "Needs review",
        error: {code:"FOCUSED_JOB_INTERRUPTED"},
      })
      await expect(requireApprovedJob(jobId)).rejects.toMatchObject({
        code: "JOB_NOT_EXECUTABLE",
      })
      expect(state.searches).toBe(0)
    })
    it("requires genuine signed MCP human approval and rejects replay and confirmed flags", async () => {
      const p = await prep("prepare_search", search()),
        input = { proposalId: p.id, proposalHash: p.proposalHash }
      expect((await service("execute_proposal", input)).response.status).toBe(
        403
      )
      const grant = { mode: "mcp-elicitation" as const, ...input }
      expect(
        (
          await service(
            "execute_proposal",
            { ...input, confirmed: true },
            grant
          )
        ).response.status
      ).toBe(400)
      const result = await service("execute_proposal", input, grant)
      expect(result.response.status).toBe(200)
      expect((await result.replay()).status).toBe(409)
    })
    it("restores private history, charges actual tokens once and stops uncertain billing before tools", async () => {
      const a = await actor(),
        thread = await createThread(a),
        input = {
          threadId: thread.id,
          message: "Help me find leads",
          resourceIds: [listId],
          leadIds: [],
          idempotencyKey: randomUUID(),
        }
      const r = await enqueueChat(a, input)
      expect((await enqueueChat(a, input)).runId).toBe(r.runId)
      await runChat(r.runId)
      await runChat(r.runId)
      expect(state.generations).toBe(1)
      expect(state.tokenCharges).toBe(1)
      const saved = await getState(a, thread.id)
      expect(saved.messages.map((m) => m.role)).toEqual(["user", "assistant"])
      await expect(
        getState(await resolveActor(stranger, "native"), thread.id)
      ).rejects.toMatchObject({ code: "THREAD_NOT_FOUND" })
      state.billingFails = true
      state.modelCalls = [
        {
          toolName: "prepare_search",
          toolCallId: "call1",
          input: {
            type: "PEOPLE",
            parametersJson: JSON.stringify(search().parameters),
          },
        },
      ]
      const next = await enqueueChat(a, {
        ...input,
        message: "Search now",
        idempotencyKey: randomUUID(),
      })
      await runChat(next.runId)
      expect((await getRun(a, next.runId)).status).toBe("needs_review")
      expect(
        await prisma.focusedAgentApproval.count({
          where: { threadId: thread.id },
        })
      ).toBe(0)
    })
  }
)
