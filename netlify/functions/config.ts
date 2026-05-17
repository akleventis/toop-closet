import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import {
  allSlugs, readClosetConfig, writeClosetConfig,
  readUserIndex, writeUserIndex,
} from '../lib/userConfig.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const SLUG_RE = /^[a-z0-9_-]{1,50}$/
const DEFAULT_CATEGORIES = ['Tee Shirts', 'Jackets', 'Pants/Shorts', 'Shoes', 'Misc']

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod
  const slug = event.queryStringParameters?.slug

  // Public: GET ?slug → categories for any closet
  if (method === 'GET' && slug) {
    if (!SLUG_RE.test(slug)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid slug' }) }
    }
    const config = await readClosetConfig(slug)
    if (!config) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Closet not found' }) }
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: config.slug, categories: config.categories }),
    }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  // Auth: GET (no slug) → own closets; lazy-migrates unclaimed configs on first login
  if (method === 'GET') {
    let slugs = await readUserIndex(netlifyUser.sub)

    if (!slugs) {
      const all = await allSlugs()
      const owned: string[] = []
      await Promise.all(all.map(async s => {
        const cfg = await readClosetConfig(s)
        if (!cfg) return
        if (!cfg.ownerEmail || cfg.ownerEmail === netlifyUser.email) {
          owned.push(s)
          if (!cfg.ownerEmail) await writeClosetConfig({ ...cfg, ownerEmail: netlifyUser.email })
        }
      }))
      slugs = owned
      await writeUserIndex(netlifyUser.sub, slugs)
    }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ slugs }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  // Auth: POST { slug } → create new closet
  if (method === 'POST') {
    const newSlug = body.slug as string | undefined
    if (!newSlug || !SLUG_RE.test(newSlug)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid slug — use lowercase letters, numbers, hyphens, underscores' }) }
    }
    const existing = await readClosetConfig(newSlug)
    if (existing) {
      return { statusCode: 409, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Slug already taken' }) }
    }

    const config = { slug: newSlug, ownerEmail: netlifyUser.email, categories: DEFAULT_CATEGORIES }
    await writeClosetConfig(config)

    const currentSlugs = (await readUserIndex(netlifyUser.sub)) ?? []
    await writeUserIndex(netlifyUser.sub, [...currentSlugs, newSlug])

    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: newSlug, categories: config.categories }),
    }
  }

  // Auth: PUT { slug, categories?, name? } → update own closet
  if (method === 'PUT') {
    const { slug: putSlug, categories, name } = body as { slug?: unknown; categories?: unknown; name?: unknown }
    if (!putSlug || typeof putSlug !== 'string' || !SLUG_RE.test(putSlug)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) }
    }
    const config = await readClosetConfig(putSlug)
    if (!config) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Closet not found' }) }
    }
    if (config.ownerEmail !== netlifyUser.email) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
    }
    const updated = { ...config }
    if (categories !== undefined) {
      if (
        !Array.isArray(categories) ||
        categories.length === 0 ||
        (categories as unknown[]).some(c => typeof c !== 'string' || !c.trim() || c.length > 40)
      ) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'categories must be a non-empty array of strings (max 40 chars each)' }) }
      }
      updated.categories = categories as string[]
    }
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name must be a non-empty string (max 60 chars)' }) }
      }
      updated.name = name.trim()
    }
    await writeClosetConfig(updated)
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: updated.slug, categories: updated.categories, name: updated.name }),
    }
  }

  // Auth: DELETE { slug } → delete own closet (config + inventory, images orphaned)
  if (method === 'DELETE') {
    const { slug: delSlug } = body as { slug?: unknown }
    if (!delSlug || typeof delSlug !== 'string' || !SLUG_RE.test(delSlug)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) }
    }
    const config = await readClosetConfig(delSlug)
    if (!config) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Closet not found' }) }
    }
    if (config.ownerEmail !== netlifyUser.email) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
    }
    await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `users/${delSlug}/config.json` })),
      s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `inventory/${delSlug}.json` })),
    ])
    const currentSlugs = (await readUserIndex(netlifyUser.sub)) ?? []
    await writeUserIndex(netlifyUser.sub, currentSlugs.filter(s => s !== delSlug))
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
}
