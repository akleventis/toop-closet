import { readJson, writeJson } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { readClosetConfig } from '../lib/userConfig.js'
import { JSON_HEADERS, SLUG_RE } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

type Item = {
  id: string
  name: string
  category: string
  imageUrl: string
  imageUrls?: string[]
  notes?: string
}

function safeImageUrl(value: unknown): string {
  if (!value) return ''
  try {
    const url = new URL(String(value))
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

// Sanitize a raw imageUrls payload to a list of valid http(s) URLs.
const parseImageUrls = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(safeImageUrl).filter(Boolean) : []

const getInventory = (slug: string): Promise<Item[]> =>
  readJson<Item[]>(`inventory/${slug}.json`).then(r => r ?? [])

const saveInventory = (slug: string, items: Item[]): Promise<void> =>
  writeJson(`inventory/${slug}.json`, items)

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod
  const slug = event.queryStringParameters?.slug

  if (!slug || !SLUG_RE.test(slug)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) }
  }

  if (method === 'GET') {
    const items = await getInventory(slug)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(items) }
  }

  const user = requireAuth(context)
  if (!user) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const closetConfig = await readClosetConfig(slug)
  if (!closetConfig || closetConfig.ownerEmail !== user.email) {
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
    const rawUrls = parseImageUrls(body.imageUrls)
    const imageUrls = rawUrls.length > 1 ? rawUrls : undefined
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: String(body.name),
      category: String(body.category),
      imageUrl: rawUrls.length > 0 ? rawUrls[0] : safeImageUrl(body.imageUrl),
      ...(imageUrls ? { imageUrls } : {}),
      ...(body.notes ? { notes: String(body.notes).slice(0, 50) } : {}),
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
      let newImageUrls: string[] | undefined = i.imageUrls
      if (body.imageUrls !== undefined) {
        const rawUrls = parseImageUrls(body.imageUrls)
        newImageUrls = rawUrls.length > 1 ? rawUrls : undefined
      }
      const newImageUrl = newImageUrls
        ? newImageUrls[0]
        : body.imageUrl !== undefined ? safeImageUrl(body.imageUrl) : i.imageUrl
      updated = {
        id: i.id,
        name: body.name ? String(body.name) : i.name,
        category: body.category ? String(body.category) : i.category,
        imageUrl: newImageUrl,
        ...(newImageUrls ? { imageUrls: newImageUrls } : {}),
        notes: body.notes !== undefined ? String(body.notes).slice(0, 50) || undefined : i.notes,
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
