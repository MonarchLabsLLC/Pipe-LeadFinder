import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

function encryptionKey() {
  const source = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.AUTH_SECRET
  if (!source) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured")
  return createHash("sha256").update(source).digest()
}

export function encryptIntegrationSecret(secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  return {
    secretCiphertext: ciphertext.toString("base64"),
    secretIv: iv.toString("base64"),
    secretTag: cipher.getAuthTag().toString("base64"),
  }
}

export function decryptIntegrationSecret(input: {
  secretCiphertext: string
  secretIv: string
  secretTag: string
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(input.secretIv, "base64")
  )
  decipher.setAuthTag(Buffer.from(input.secretTag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(input.secretCiphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
