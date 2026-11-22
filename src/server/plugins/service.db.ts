import { prisma } from "@/lib/prisma"
import { publicJobRun } from "@/lib/jobs/service"
import { dispatch } from "@/server/focused-agent/actions"
import { listUrl, absoluteUrl } from "@/server/focused-agent/resources"
import { interpretRequest } from "@/server/focused-agent/tools"

import { proposalForInstall, ownerActor, runPluginChange } from "./changes"
import { GATEWAY_ISSUER, PluginError, type PluginOwnerAccount, type PluginTenant } from "./contract"
import { pluginServiceSecret } from "./env"
import { INTERPRET_DAILY_LIMIT, pluginActionNamed, pluginCapabilities, type PluginAction } from "./registry"
import type { PluginCall, PluginServiceDeps } from "./service"

// The real dependencies of the plugin service: Postgres through Prisma, and the
// Lead Finder Agent's own read tools.

/**
 * A Lead Finder account belongs to one person: there is exactly one tenant per
 * owner, and its id is their User.id. An owner who has never signed in here has
 * none (404 tenant_not_found); nothing is created for them.
 */
export async function accountForOwner(ownerSubject: string): Promise<{ owner: PluginOwnerAccount | null; tenants: PluginTenant[] }> {
  const user = await prisma.user.findUnique({ where: { keycloakSubId: ownerSubject }, select: { id: true, email: true, name: true } })
  if (!user) return { owner: null, tenants: [] }
  return {
    owner: { userId: user.id, email: user.email, subject: ownerSubject },
    tenants: [{ id: user.id, name: user.name?.trim() ? `${user.name.trim()}'s Lead Finder` : "Lead Finder" }],
  }
}

/** Single use, durably: the nonce is a primary key in the Agent's replay ledger, under the gateway's issuer. */
async function claimNonce(jti: string, expiresAt: Date): Promise<boolean> {
  try {
    await prisma.focusedAgentNonce.create({ data: { issuer: GATEWAY_ISSUER, nonce: jti, subject: "plugin-service", expiresAt } })
    return true
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return false
    throw error
  }
}

async function runRead(call: PluginCall, action: PluginAction, input: Record<string, unknown>): Promise<unknown> {
  const a = ownerActor(call.owner)
  const run = action.run
  if (run.kind === "agent-read") return dispatch(a, run.tool, input, { key: call.requestId })
  if (run.kind === "job") {
    const job = await prisma.jobRun.findFirst({ where: { id: String(input.runId), userId: a.userId, kind: { in: [...run.jobKinds] as never } } })
    if (!job) throw new PluginError("not_found", "This run is not available.")
    return { ...publicJobRun(job), runId: job.id, status: job.status.toLowerCase(), url: job.listId ? absoluteUrl(listUrl(job.listId)) : null }
  }
  if (run.kind === "interpret") {
    // Free for plugins, so it is limited per install per UTC day.
    const dayStart = new Date(Date.UTC(call.now.getUTCFullYear(), call.now.getUTCMonth(), call.now.getUTCDate()))
    const used = await prisma.pluginActionLog.count({
      where: { installId: call.actor.installId, actionName: action.name, outcome: "completed", createdAt: { gte: dayStart } },
    })
    if (used >= INTERPRET_DAILY_LIMIT) {
      throw new PluginError("invalid_input", `This plugin has used interpret-request ${INTERPRET_DAILY_LIMIT} times today (UTC). Try again tomorrow, or send the search fields yourself.`, true)
    }
    return interpretRequest(a, String(input.text), `plugin:${call.actor.installId}:${call.requestId}`, { free: true })
  }
  if (run.kind === "agent-run") {
    const agent = await prisma.aiAgent.findFirst({ where: { id: String(input.agentId), userId: a.userId }, select: { id: true, name: true, status: true } })
    if (!agent) throw new PluginError("not_found", "This agent is not available.")
    const job = await prisma.jobRun.findFirst({ where: { agentId: agent.id, userId: a.userId, kind: "AGENT_RUN" }, orderBy: { createdAt: "desc" } })
    return {
      agentId: agent.id,
      name: agent.name,
      agentStatus: agent.status,
      run: job ? { ...publicJobRun(job), runId: job.id, status: job.status.toLowerCase(), url: job.listId ? absoluteUrl(listUrl(job.listId)) : null } : null,
    }
  }
  if (run.kind === "list-agents") {
    const agents = await prisma.aiAgent.findMany({
      where: { userId: a.userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, name: true, status: true, config: true, createdAt: true, updatedAt: true },
    })
    return {
      agents: agents.map((agent) => {
        const config = (agent.config ?? {}) as { schedule?: string; searchType?: string; listId?: string; resultsLimit?: number; nextScheduledRunAt?: string | null }
        return {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          schedule: config.schedule ?? "manual",
          searchType: config.searchType ?? null,
          listId: config.listId ?? null,
          resultsLimit: config.resultsLimit ?? null,
          nextScheduledRunAt: config.nextScheduledRunAt ?? null,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        }
      }),
    }
  }
  throw new PluginError("app_error", "This action is not a read.")
}

export const pluginServiceDeps: PluginServiceDeps = {
  secret: pluginServiceSecret,
  claimNonce,
  accountForOwner,
  capabilities: pluginCapabilities,
  actionNamed: pluginActionNamed,
  runRead,
  runChange: runPluginChange,
  proposalForInstall,
  async record(entry) {
    try {
      await prisma.pluginActionLog.create({
        data: {
          userId: entry.userId,
          installId: entry.actor.installId,
          pluginId: entry.actor.pluginId,
          pluginName: entry.actor.pluginName,
          actionName: entry.action.name,
          area: entry.action.area,
          level: entry.action.level,
          outcome: entry.outcome,
          proposalId: entry.proposalId ?? null,
          requestId: entry.requestId,
          metadata: entry.detail ? { detail: entry.detail } : {},
        },
      })
    } catch (error) {
      console.error("[plugins] could not record a plugin call", error instanceof Error ? error.message : error)
    }
  },
}
