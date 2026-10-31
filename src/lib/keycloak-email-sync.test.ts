import { describe, expect, it } from "vitest"
import { syncSsoEmail, type SsoEmailSyncStore, type SsoEmailSyncUser } from "./keycloak-email-sync"

function memoryStore(rows: SsoEmailSyncUser[], failWith?: unknown) {
  const updates: Array<[string, string]> = []
  const store: SsoEmailSyncStore = {
    async getUserByEmail(email) {
      return rows.find((row) => row.email?.toLowerCase() === email)
    },
    async updateUserEmail(id, email) {
      if (failWith) throw failWith
      updates.push([id, email])
      const row = rows.find((r) => r.id === id)
      if (row) row.email = email
    },
  }
  return { store, updates, rows }
}

describe("syncSsoEmail", () => {
  it("updates the stored email when Keycloak reports a new verified address", async () => {
    const { store, updates, rows } = memoryStore([{ id: "u1", email: "old@example.com" }])
    const result = await syncSsoEmail(rows[0], { email: " New@Example.com ", email_verified: true }, store)
    expect(result).toEqual({ status: "updated", previousEmail: "old@example.com", email: "new@example.com" })
    expect(updates).toEqual([["u1", "new@example.com"]])
  })

  it("leaves the row alone when the email did not change (case-insensitive)", async () => {
    const { store, updates, rows } = memoryStore([{ id: "u1", email: "same@example.com" }])
    expect(await syncSsoEmail(rows[0], { email: "SAME@example.com", email_verified: true }, store)).toEqual({ status: "unchanged" })
    expect(updates).toEqual([])
  })

  it("never adopts an unverified or missing verification flag", async () => {
    const { store, updates, rows } = memoryStore([{ id: "u1", email: "old@example.com" }])
    expect(await syncSsoEmail(rows[0], { email: "new@example.com", email_verified: false }, store)).toEqual({ status: "unverified" })
    expect(await syncSsoEmail(rows[0], { email: "new@example.com" }, store)).toEqual({ status: "unverified" })
    expect(await syncSsoEmail(rows[0], { email: "new@example.com", email_verified: "true" }, store)).toEqual({ status: "unverified" })
    expect(updates).toEqual([])
  })

  it("keeps the old email when another local user already owns the new one", async () => {
    const { store, updates, rows } = memoryStore([
      { id: "u1", email: "old@example.com" },
      { id: "u2", email: "new@example.com" },
    ])
    expect(await syncSsoEmail(rows[0], { email: "new@example.com", email_verified: true }, store)).toEqual({
      status: "conflict",
      conflictingUserId: "u2",
    })
    expect(updates).toEqual([])
    expect(rows[0].email).toBe("old@example.com")
  })

  it("treats a unique-constraint race as a conflict instead of throwing", async () => {
    const { store, rows } = memoryStore([{ id: "u1", email: "old@example.com" }], Object.assign(new Error("dup"), { code: "P2002" }))
    expect(await syncSsoEmail(rows[0], { email: "new@example.com", email_verified: true }, store)).toEqual({
      status: "conflict",
      conflictingUserId: "unknown",
    })
  })

  it("reports other database errors without throwing", async () => {
    const { store, rows } = memoryStore([{ id: "u1", email: "old@example.com" }], new Error("db down"))
    expect(await syncSsoEmail(rows[0], { email: "new@example.com", email_verified: true }, store)).toEqual({
      status: "failed",
      error: "db down",
    })
  })
})
