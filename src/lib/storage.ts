import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"

const APP_DIR = "pipeleadsfinder"

const region = process.env.DO_SPACES_REGION || "nyc3"
const bucket = process.env.DO_SPACES_BUCKET || "scaleplus"

const s3 = new S3Client({
  endpoint: `https://${region}.digitaloceanspaces.com`,
  region,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || "",
    secretAccessKey: process.env.DO_SPACES_SECRET || "",
  },
  forcePathStyle: false,
})

/**
 * Build the S3 object key for a user file.
 * Pattern: <keycloakSubId>/pipeleadsfinder/<folder>/<filename>
 */
export function buildStorageKey(
  keycloakSubId: string,
  folder: string,
  filename: string,
): string {
  return `${keycloakSubId}/${APP_DIR}/${folder}/${filename}`
}

/**
 * Get the public CDN URL for a storage key.
 */
export function getPublicUrl(key: string): string {
  return `https://${bucket}.${region}.cdn.digitaloceanspaces.com/${key}`
}

/**
 * Upload a file to DO Spaces.
 * Returns the public CDN URL.
 */
export async function uploadToSpaces(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  acl: "public-read" | "private" = "public-read",
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: acl,
    }),
  )
  return getPublicUrl(key)
}

/**
 * Delete a file from DO Spaces.
 */
export async function deleteFromSpaces(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}
