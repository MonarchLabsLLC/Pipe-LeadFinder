import { beforeEach, describe, expect, it } from "vitest"
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto"

describe("integration secret encryption", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "test-only-key-with-enough-entropy"
  })

  it("round trips without storing plaintext", () => {
    const encrypted = encryptIntegrationSecret("a-secret-webhook-signing-key")
    expect(encrypted.secretCiphertext).not.toContain("a-secret")
    expect(decryptIntegrationSecret(encrypted)).toBe("a-secret-webhook-signing-key")
  })

  it("uses a fresh nonce for every secret", () => {
    expect(encryptIntegrationSecret("same-secret").secretIv)
      .not.toBe(encryptIntegrationSecret("same-secret").secretIv)
  })
})
