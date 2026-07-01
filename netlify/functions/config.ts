import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import {
  readClosetConfig, writeClosetConfig,
  readUserIndex, writeUserIndex, generateSlug,
} from '../lib/userConfig.js'
import { JSON_HEADERS, SLUG_RE } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const DEFAULT_CATEGORIES = ['Tee Shirts', 'Jackets', 'Pants/Shorts', 'Shoes', 'Misc']

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod
  const slug = event.queryStringParameters?.slug

  // Public: GET ?slug → categories + name for any closet
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
      body: JSON.stringify({ slug: config.slug, categories: config.categories, name: config.name }),
    }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  // Auth: GET (no slug) → own closets with names
  if (method === 'GET') {
    const closets = (await readUserIndex(netlifyUser.sub)) ?? []
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ closets }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  // Auth: POST { name? } → create new closet with auto-generated slug
  if (method === 'POST') {
    const name = body.name as string | undefined
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 60)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name must be a non-empty string (max 60 chars)' }) }
    }

    const newSlug = await generateSlug()
    const config = {
      slug: newSlug,
      ownerEmail: netlifyUser.email,
      categories: DEFAULT_CATEGORIES,
      ...(name ? { name: name.trim() } : {}),
    }
    await writeClosetConfig(config)

    const currentClosets = (await readUserIndex(netlifyUser.sub)) ?? []
    await writeUserIndex(netlifyUser.sub, [...currentClosets, { slug: newSlug, name: config.name }])

    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: newSlug, categories: config.categories, name: config.name }),
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
      // keep user index name in sync
      const currentClosets = (await readUserIndex(netlifyUser.sub)) ?? []
      const syncedClosets = currentClosets.map(c => c.slug === putSlug ? { ...c, name: updated.name } : c)
      await writeUserIndex(netlifyUser.sub, syncedClosets)
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
    await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `users/${delSlug}/config.json` })),
      s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `inventory/${delSlug}.json` })),
    ])
    const currentClosets = (await readUserIndex(netlifyUser.sub)) ?? []
    await writeUserIndex(netlifyUser.sub, currentClosets.filter(c => c.slug !== delSlug))
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
}
