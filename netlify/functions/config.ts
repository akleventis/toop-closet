import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { slugForEmail, isValidSlug } from '../lib/userConfig.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const SLUG_RE = /^[a-z0-9_-]{1,50}$/
const DEFAULT_CATEGORIES = ['Tee Shirts', 'Jackets', 'Pants/Shorts', 'Shoes', 'Misc']

type UserConfig = { slug: string; categories: string[] }

const readConfig = async (slug: string): Promise<UserConfig | null> => {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `users/${slug}/config.json`,
    }))
    return JSON.parse(await res.Body!.transformToString()) as UserConfig
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return null
    throw err
  }
}

const writeConfig = async (config: UserConfig): Promise<void> => {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `users/${config.slug}/config.json`,
    Body: JSON.stringify(config),
    ContentType: 'application/json',
  }))
}

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod
  const slug = event.queryStringParameters?.slug

  // Public: GET ?slug=alice → categories for any valid closet
  if (method === 'GET' && slug) {
    if (!SLUG_RE.test(slug) || !isValidSlug(slug)) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Closet not found' }) }
    }
    const config = await readConfig(slug)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(config ?? { slug, categories: DEFAULT_CATEGORIES }) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const userSlug = slugForEmail(netlifyUser.email)
  if (!userSlug) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Not an invited user' }) }
  }

  // Auth: GET (no slug) → own config, provision on first login
  if (method === 'GET') {
    let config = await readConfig(userSlug)
    if (!config) {
      config = { slug: userSlug, categories: DEFAULT_CATEGORIES }
      await writeConfig(config)
    }
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(config) }
  }

  // Auth: PUT → update own categories
  if (method === 'PUT') {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
    } catch {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    const { categories } = body as { categories?: unknown }
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      categories.some(c => typeof c !== 'string' || !c.trim() || c.length > 40)
    ) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'categories must be a non-empty array of strings (max 40 chars each)' }) }
    }

    const config: UserConfig = { slug: userSlug, categories: categories as string[] }
    await writeConfig(config)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(config) }
  }

  return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
}
