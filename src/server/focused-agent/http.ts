import { z } from "zod"
import { prisma as db } from "@/lib/prisma"
import { actions, dispatch } from "./actions"
import {
  proposalView as approvalView,
  decideProposal,
  getProposal,
} from "./proposals"
import { listResources, getList, id } from "./resources"
import {
  nativeActor,
  resolveActor,
  serviceEnabled,
  writesEnabled,
} from "./access"
import {
  createThread,
  enqueueChat,
  getRun,
  getState,
  validateResources,
} from "./runtime"
import { FocusedAgentError, verifyFocusedRequest } from "./security"

const uuid = z.string().uuid()
const envelope = z
  .object({
    protocolVersion: z.literal("1"),
    workspaceId: z.string().min(1).max(255).optional(),
    input: z.unknown(),
    idempotencyKey: z.string().min(1).max(255),
    lineage: z
      .object({
        threadId: z.string().max(300),
        runId: z.string().max(300),
        turnId: z.string().max(300),
        mcpSessionId: z.string().max(300),
        requestId: z.string().max(300),
      })
      .strict(),
  })
  .strict()
const ok = (data: unknown, status = 200) =>
  Response.json(
    { protocolVersion: "1", data },
    { status, headers: { "Cache-Control": "no-store" } }
  )
function failure(error: unknown) {
  const known = error instanceof FocusedAgentError
  const invalid = error instanceof z.ZodError || error instanceof SyntaxError
  return Response.json(
    {
      protocolVersion: "1",
      error: {
        code: known
          ? error.code
          : invalid
            ? "INVALID_INPUT"
            : "AGENT_UNAVAILABLE",
        message: known
          ? error.message
          : invalid
            ? "Check the request fields."
            : "The Agent is temporarily unavailable.",
        retryable: known ? error.retryable : !invalid,
      },
    },
    {
      status: known ? error.status : invalid ? 400 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
async function body(request: Request) {
  const text = await request.text()
  if (Buffer.byteLength(text) > 64000)
    throw new FocusedAgentError(
      "REQUEST_TOO_LARGE",
      "This Agent request is too large.",
      413
    )
  return JSON.parse(text)
}
type Schedule = (id: string) => void
export async function handleNative(
  request: Request,
  path: string[],
  schedule: Schedule
) {
  try {
    const a = await nativeActor(request)
    if (request.method === "GET") {
      if (path.length === 1 && path[0] === "access")
        return ok({
          userId: a.userId,
          workspaceId: a.workspaceId,
          writesEnabled: writesEnabled(),
        })
      if (path.length === 1 && path[0] === "resources")
        return ok(
          await listResources(
            a,
            z
              .string()
              .max(200)
              .parse(new URL(request.url).searchParams.get("query") ?? "")
          )
        )
      if (path.length === 2 && path[0] === "lists") {
        const url = new URL(request.url)
        return ok(
          await getList(a, {
            listId: id.parse(path[1]),
            cursor: url.searchParams.get("cursor") ?? undefined,
            limit: 50,
          })
        )
      }
      if (path.length === 1 && path[0] === "state") {
        const id = new URL(request.url).searchParams.get("threadId")
        const state = await getState(a, id ? uuid.parse(id) : undefined)
        for (const run of state.runs)
          if (run.status === "queued" && run.kind === "chat")
            schedule(run.runId)
        return ok(state)
      }
      if (path.length === 2 && path[0] === "runs") {
        const run = await getRun(a, id.parse(path[1]))
        if (run.status === "queued" && run.kind === "chat") schedule(run.runId)
        return ok(run)
      }
    } else if (request.method === "POST") {
      const input = await body(request)
      if (path.length === 1 && path[0] === "threads") {
        z.object({}).strict().parse(input)
        return ok({ thread: await createThread(a) }, 201)
      }
      if (path.length === 1 && path[0] === "chat") {
        const run = await enqueueChat(a, input)
        if (run.status === "queued") schedule(run.runId)
        return ok(run, 202)
      }
      if (path.length === 1 && path[0] === "context") {
        const v = z
          .object({ resourceIds: z.array(z.string().min(1).max(200)).max(1) })
          .strict()
          .parse(input)
        await validateResources(a, v.resourceIds)
        const where = {
          userId_workspaceId: { userId: a.userId, workspaceId: a.workspaceId },
        }
        if (!v.resourceIds.length) {
          await db.focusedAgentContext.deleteMany({
            where: { userId: a.userId, workspaceId: a.workspaceId },
          })
          return ok({ cleared: true })
        }
        await db.focusedAgentContext.upsert({
          where,
          create: {
            ...where.userId_workspaceId,
            resourceIds: v.resourceIds,
            expiresAt: new Date(Date.now() + 120000),
          },
          update: {
            resourceIds: v.resourceIds,
            expiresAt: new Date(Date.now() + 120000),
          },
        })
        return ok({ shared: true, expiresIn: 120 })
      }
      if (
        path.length === 3 &&
        path[0] === "approvals" &&
        path[2] === "decision"
      ) {
        const v = z
          .object({
            proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
            decision: z.enum(["approve", "reject"]),
          })
          .strict()
          .parse(input)
        return ok(
          await decideProposal(
            a,
            uuid.parse(path[1]),
            v.proposalHash,
            v.decision
          )
        )
      }
    }
    throw new FocusedAgentError(
      "NOT_FOUND",
      "This Agent endpoint is not available.",
      404
    )
  } catch (error) {
    return failure(error)
  }
}

export async function handleService(
  request: Request,
  path: string[],
  schedule: Schedule = () => {}
) {
  try {
    if (!serviceEnabled())
      throw new FocusedAgentError(
        "SERVICE_DISABLED",
        "Lead Finder MCP is not enabled.",
        503
      )
    let action: string
    const get = request.method === "GET"
    if (
      get &&
      path.length === 1 &&
      ["capabilities", "workspaces", "context"].includes(path[0])
    )
      action = path[0]
    else if (get && path.length === 2 && path[0] === "proposals") {
      uuid.parse(path[1])
      action = "proposal-status"
    } else if (
      request.method === "POST" &&
      path.length === 2 &&
      path[0] === "actions" &&
      (Object.hasOwn(actions, path[1]) || path[1] === "get_run")
    )
      action = path[1]
    else if (
      request.method === "POST" &&
      path.length === 3 &&
      path[0] === "proposals" &&
      path[2] === "execute"
    ) {
      uuid.parse(path[1])
      action = "execute_proposal"
    } else
      throw new FocusedAgentError(
        "UNSUPPORTED_ACTION",
        "This Agent endpoint is not supported.",
        404
      )
    const input = get ? null : envelope.parse(await body(request))
    const claims = await verifyFocusedRequest({
      authorization: request.headers.get("authorization"),
      secret: process.env.LEADFINDER_GODMODE_SERVICE_SECRET,
      issuer: "clickcampaigns-godmode-mcp",
      audience: "leadfinder-godmode-service-v1",
      action,
      path: new URL(request.url).pathname,
      body: input,
      consumeNonce: async (c) => {
        try {
          await db.focusedAgentNonce.create({
            data: {
              issuer: c.iss,
              nonce: c.nonce,
              subject: c.sub,
              expiresAt: new Date(c.exp * 1000),
            },
          })
          return true
        } catch (error) {
          if ((error as { code?: string }).code === "P2002") return false
          throw error
        }
      },
    })
    if (claims.approval && action !== "execute_proposal")
      throw new FocusedAgentError(
        "UNEXPECTED_APPROVAL",
        "Approval cannot authorize a different operation.",
        401
      )
    const a = await resolveActor(claims.sub, "mcp", input?.workspaceId)
    if (action === "capabilities")
      return ok({
        service: "leadfinder",
        enabled: true,
        writesEnabled: writesEnabled(),
        actions: [...Object.keys(actions), "get_run", "execute_proposal"],
        limits: { lists: 1, leads: 50 },
        history: "tool-activity-and-approvals",
      })
    if (action === "workspaces")
      return ok({
        workspaces: [
          {
            id: a.workspaceId,
            name: "My Lead Finder workspace",
            url: "/lead-search/saved-lists",
          },
        ],
      })
    if (action === "context") {
      const current = await db.focusedAgentContext.findFirst({
        where: {
          userId: a.userId,
          workspaceId: a.workspaceId,
          expiresAt: { gt: new Date() },
        },
      })
      if (current) await validateResources(a, current.resourceIds as string[])
      return ok({
        context: current
          ? {
              workspaceId: a.workspaceId,
              resourceIds: current.resourceIds,
              expiresAt: current.expiresAt,
            }
          : null,
        stale: !current,
      })
    }
    if (action === "proposal-status")
      return ok(approvalView(await getProposal(a, path[1])))
    if (action === "execute_proposal") {
      if (!claims.approval || claims.approval.proposalId !== path[1])
        throw new FocusedAgentError(
          "HUMAN_APPROVAL_REQUIRED",
          "Approve this exact proposal in the app or MCP approval form."
        )
      const execution = z
        .object({
          proposalId: uuid,
          proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
        .parse(input!.input)
      if (
        execution.proposalId !== path[1] ||
        execution.proposalHash !== claims.approval.proposalHash
      )
        throw new FocusedAgentError(
          "APPROVAL_MISMATCH",
          "The approval does not match this request.",
          401
        )
      return ok(
        await decideProposal(
          a,
          path[1],
          claims.approval.proposalHash,
          "approve"
        )
      )
    }
    if (action === "get_run") {
      const v = z.object({ runId: id }).strict().parse(input!.input)
      const run = await getRun(a, v.runId)
      if (run.status === "queued") schedule(run.runId)
      return ok(run)
    }
    const result = await dispatch(a, action, input!.input, {
      key: input!.idempotencyKey,
    })
    await db.focusedAgentAudit.create({
      data: {
        userId: a.userId,
        workspaceId: a.workspaceId,
        action,
        outcome: "completed",
        metadata: { requestId: claims.requestId, origin: "mcp" },
      },
    })
    return ok(result)
  } catch (error) {
    return failure(error)
  }
}
