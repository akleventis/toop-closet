import { randomBytes } from 'crypto'
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from './s3.js'

export type ClosetConfig = {
  slug: string
  ownerEmail: string
  categories: string[]
  name?: string
}

export type UserCloset = { slug: string; name?: string }

export async function allSlugs(): Promise<string[]> {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: 'users/',
    Delimiter: '/',
  }))
  return (res.CommonPrefixes ?? [])
    .map(p => p.Prefix?.slice('users/'.length).replace('/', '') ?? '')
    .filter(Boolean)
}

export async function readClosetConfig(slug: string): Promise<ClosetConfig | null> {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `users/${slug}/config.json`,
    }))
    return JSON.parse(await res.Body!.transformToString()) as ClosetConfig
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return null
    throw err
  }
}

export async function writeClosetConfig(config: ClosetConfig): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `users/${config.slug}/config.json`,
    Body: JSON.stringify(config),
    ContentType: 'application/json',
  }))
}

export async function readUserIndex(userId: string): Promise<UserCloset[] | null> {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `_users/${userId}.json`,
    }))
    const raw = JSON.parse(await res.Body!.transformToString()) as { closets?: UserCloset[]; slugs?: string[] }
    if (raw.closets) return raw.closets
    // backwards compat: migrate old { slugs: string[] } format
    if (raw.slugs) return raw.slugs.map(s => ({ slug: s }))
    return null
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return null
    throw err
  }
}

export async function writeUserIndex(userId: string, closets: UserCloset[]): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `_users/${userId}.json`,
    Body: JSON.stringify({ closets }),
    ContentType: 'application/json',
  }))
}

export async function generateSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = randomBytes(3).toString('hex')
    const existing = await readClosetConfig(slug)
    if (!existing) return slug
  }
  throw new Error('Failed to generate unique slug')
}
