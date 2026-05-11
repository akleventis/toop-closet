import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { parseUsers } from '../lib/users.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

type Item = {
  id: string
  name: string
  category: string
  imageUrl: string
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const SLUG_RE = /^[a-z0-9_-]{1,50}$/

function safeImageUrl(value: unknown): string {
  if (!value) return ''
  try {
    const url = new URL(String(value))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

const getInventory = async (slug: string): Promise<Item[]> => {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `inventory/${slug}.json`,
    }))
    const body = await res.Body?.transformToString()
    return body ? (JSON.parse(body) as Item[]) : []
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return []
    throw err
  }
}

const saveInventory = async (slug: string, items: Item[]): Promise<void> => {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `inventory/${slug}.json`,
    Body: JSON.stringify(items),
    ContentType: 'application/json',
  }))
}

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod
  const slug = event.queryStringParameters?.slug

  if (!slug || !SLUG_RE.test(slug)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) }
  }

  const users = parseUsers()
  if (!users.has(slug)) {
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Closet not found' }) }
  }

  if (method === 'GET') {
    const items = await getInventory(slug)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(items) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }
  if (netlifyUser.sub !== users.get(slug)) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  let items = await getInventory(slug)

  if (method === 'POST') {
    if (!body.name || !body.category) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name and category are required' }) }
    }
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: String(body.name),
      category: String(body.category),
      imageUrl: safeImageUrl(body.imageUrl),
    }
    items.push(newItem)
    await saveInventory(slug, items)
    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(newItem) }
  }

  if (method === 'PUT') {
    if (!body.id) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'id is required' }) }
    }
    let updated: Item | undefined
    items = items.map(i => {
      if (i.id !== body.id) return i
      updated = {
        id: i.id,
        name: body.name ? String(body.name) : i.name,
        category: body.category ? String(body.category) : i.category,
        imageUrl: body.imageUrl !== undefined ? safeImageUrl(body.imageUrl) : i.imageUrl,
      }
      return updated
    })
    if (!updated) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Item not found' }) }
    }
    await saveInventory(slug, items)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(updated) }
  }

  if (method === 'DELETE') {
    if (!body.id) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'id is required' }) }
    }
    items = items.filter(i => i.id !== body.id)
    await saveInventory(slug, items)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return {
    statusCode: 405,
    headers: { ...JSON_HEADERS, Allow: 'GET, POST, PUT, DELETE' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  }
}
