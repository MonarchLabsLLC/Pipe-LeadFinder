import { prisma } from "@/lib/prisma"
import type { AgentActor } from "@/server/focused-agent/access"
import { requireCredits } from "@/server/focused-agent/pricing"
import { FocusedAgentError } from "@/server/focused-agent/security"

// Scale Credits rules for plugins (dashboard review list, decision S1):
//
//   * Anything that spends the owner's credits is `act`: the owner approves
//     each one. The workspace owner's balance pays.
//   * act_unattended is used only inside a monthly cap the owner set for that
//     install in the ScalePlus dashboard. It arrives in the verified service
//     token as creditCapMonthly. No cap, or the cap is used up: the request
//     waits for the owner's approval like any other. This app keeps the spend
//     ledger (PluginProposal.reservedCredits) that enforces it.
//   * A plugin never takes the balance below zero. The app's own screens may
//     start at a zero balance and go negative; a plugin job needs the full
//     maximum cost first, when it asks and again when the owner approves.

/** Pure: why a plugin may not spend `maximum` from `balance`, or null when it may. */
export function pluginCreditShortfall(balance: number, maximum: number): string | null {
  const needed = Math.max(0, Math.ceil(maximum))
  if (!Number.isFinite(balance)) return "The Scale Credits balance could not be read."
  if (balance < 0) return "The Scale Credits balance is negative."
  if (balance < needed) {
    return `This needs up to ${needed} Scale Credits and the balance is ${Math.floor(balance)}. A plugin never takes the balance below zero.`
  }
  return null
}

/** The owner's balance covers the whole maximum cost, or INSUFFICIENT_CREDITS. */
export async function requirePluginCredits(a: AgentActor, maximum: number): Promise<number> {
  const balance = await requireCredits(a, maximum)
  const shortfall = pluginCreditShortfall(balance, maximum)
  if (shortfall) throw new FocusedAgentError("INSUFFICIENT_CREDITS", shortfall, 402)
  return balance
}

/** The first instant of `now`'s calendar month, UTC. Caps reset then. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export type CapDecision = { ok: true; remaining: number } | { ok: false; reason: "no_cap" | "cap_reached" }

/** Pure: may one more unattended run of up to `cost` credits start under this cap? */
export function capDecision(input: { cap: number | null; used: number; cost: number }): CapDecision {
  if (input.cap === null) return { ok: false, reason: "no_cap" }
  const cost = Math.max(0, Math.ceil(input.cost))
  if (input.used + cost > input.cap) return { ok: false, reason: "cap_reached" }
  return { ok: true, remaining: input.cap - input.used - cost }
}

async function usedThisMonth(db: Pick<typeof prisma, "pluginProposal">, installId: string, now: Date): Promise<number> {
  const sum = await db.pluginProposal.aggregate({
    where: { installId, unattended: true, createdAt: { gte: monthStart(now) } },
    _sum: { reservedCredits: true },
  })
  return sum._sum.reservedCredits ?? 0
}

/**
 * Count one proposal's maximum cost against its install's monthly cap, or say
 * why not. Serialised per install (a transaction-scoped advisory lock), so two
 * calls at once cannot both fit into the last of the cap. A proposal that was
 * already counted is not counted twice.
 */
export async function reserveUnattended(input: {
  userId: string
  installId: string
  approvalId: string
  cost: number
  /** creditCapMonthly from the verified token; null: no cap. */
  cap: number | null
  now: Date
}): Promise<CapDecision> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plugin-cap:${input.installId}`}))`
    const proposal = await tx.pluginProposal.findUnique({ where: { approvalId: input.approvalId }, select: { unattended: true, userId: true } })
    if (!proposal || proposal.userId !== input.userId) return { ok: false, reason: "no_cap" } as const
    const used = await usedThisMonth(tx, input.installId, input.now)
    if (proposal.unattended) return { ok: true, remaining: Math.max(0, (input.cap ?? 0) - used) } as const
    const decision = capDecision({ cap: input.cap, used, cost: input.cost })
    if (decision.ok) {
      await tx.pluginProposal.update({ where: { approvalId: input.approvalId }, data: { unattended: true, reservedCredits: Math.max(0, Math.ceil(input.cost)) } })
    }
    return decision
  })
}
