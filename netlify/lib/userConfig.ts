import { randomBytes } from 'crypto'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson } from './s3.js'

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
  return readJson<ClosetConfig>(`users/${slug}/config.json`)
}

export async function writeClosetConfig(config: ClosetConfig): Promise<void> {
  return writeJson(`users/${config.slug}/config.json`, config)
}

export async function readUserIndex(userId: string): Promise<UserCloset[] | null> {
  const raw = await readJson<{ closets: UserCloset[] }>(`_users/${userId}.json`)
  return raw?.closets ?? null
}

export async function writeUserIndex(userId: string, closets: UserCloset[]): Promise<void> {
  return writeJson(`_users/${userId}.json`, { closets })
}

export async function generateSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = randomBytes(3).toString('hex')
    const existing = await readClosetConfig(slug)
    if (!existing) return slug
  }
  throw new Error('Failed to generate unique slug')
}
