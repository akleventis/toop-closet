import { randomBytes } from 'crypto'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson } from './s3.js'

export type ClosetConfig = {
  slug: string
  ownerEmail: string
  categories: string[]
  name?: string
}

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

// Every closet config in the bucket (one read per closet). Used to group closets
// by workspace (ownerEmail) for the profile + public closet list. Personal-scale.
export async function allClosetConfigs(): Promise<ClosetConfig[]> {
  const slugs = await allSlugs()
  const configs = await Promise.all(slugs.map(readClosetConfig))
  return configs.filter((c): c is ClosetConfig => c !== null)
}

export async function writeClosetConfig(config: ClosetConfig): Promise<void> {
  return writeJson(`users/${config.slug}/config.json`, config)
}

export async function generateSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = randomBytes(3).toString('hex')
    const existing = await readClosetConfig(slug)
    if (!existing) return slug
  }
  throw new Error('Failed to generate unique slug')
}
