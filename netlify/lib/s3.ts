import { S3Client, GetObjectCommand, PutObjectCommand, PutObjectTaggingCommand } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
})

export function s3PublicUrl(key: string): string {
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }))
    return JSON.parse(await res.Body!.transformToString()) as T
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return null
    throw err
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(value),
    ContentType: 'application/json',
  }))
}

// Best-effort tag `orphaned=true` for a tag-filtered lifecycle rule; swallows errors so it never blocks a delete.
// Only safe for single-referent objects — never for anything another record might still reference.
export async function tagOrphaned(key: string): Promise<void> {
  await s3.send(new PutObjectTaggingCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Tagging: { TagSet: [{ Key: 'orphaned', Value: 'true' }] },
  })).catch(() => {})
}
