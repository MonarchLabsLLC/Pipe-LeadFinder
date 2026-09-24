import { beforeEach, describe, expect, it, vi } from "vitest"

const upsert = vi.fn()
const findUniqueOrThrow = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: { businessProfile: { upsert, findUniqueOrThrow } },
}))
vi.mock("@mendable/firecrawl-js", () => ({ default: class {} }))

const { getOrCreateProfile } = await import("./knowledge-base-service")

describe("getOrCreateProfile", () => {
  beforeEach(() => {
    upsert.mockReset()
    findUniqueOrThrow.mockReset()
  })

  it("returns the upserted profile", async () => {
    upsert.mockResolvedValue({ id: "p1", userId: "u1" })
    await expect(getOrCreateProfile("u1")).resolves.toEqual({ id: "p1", userId: "u1" })
    expect(findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it("reads the existing row when a parallel first visit won the insert", async () => {
    upsert.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))
    findUniqueOrThrow.mockResolvedValue({ id: "p1", userId: "u1" })
    await expect(getOrCreateProfile("u1")).resolves.toEqual({ id: "p1", userId: "u1" })
    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { userId: "u1" } })
  })

  it("rethrows any other database error", async () => {
    upsert.mockRejectedValue(Object.assign(new Error("boom"), { code: "P1001" }))
    await expect(getOrCreateProfile("u1")).rejects.toThrow("boom")
  })
})
