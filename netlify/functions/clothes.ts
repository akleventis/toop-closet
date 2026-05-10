import { getStore } from '@netlify/blobs'
import { requireAuth } from '../lib/auth.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

type Item = {
  id: string
  name: string
  category: string
  imageUrl: string
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const getInventory = async (): Promise<Item[]> => {
  const store = getStore('clothing-inventory')
  const raw = await store.get('inventory')
  return raw ? (JSON.parse(raw) as Item[]) : []
}

const saveInventory = async (items: Item[]): Promise<void> => {
  const store = getStore('clothing-inventory')
  await store.set('inventory', JSON.stringify(items))
}

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod

  if (method === 'GET') {
    const items = await getInventory()
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(items) }
  }

  if (!requireAuth(context)) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  let items = await getInventory()

  if (method === 'POST') {
    if (!body.name || !body.category) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name and category are required' }) }
    }
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: String(body.name),
      category: String(body.category),
      imageUrl: body.imageUrl ? String(body.imageUrl) : '',
    }
    items.push(newItem)
    await saveInventory(items)
    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(newItem) }
  }

  if (method === 'PUT') {
    if (!body.id) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'id is required' }) }
    }
    let updated: Item | undefined
    items = items.map(i => {
      if (i.id !== body.id) return i
      updated = { ...i, ...body } as Item
      return updated
    })
    if (!updated) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Item not found' }) }
    }
    await saveInventory(items)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(updated) }
  }

  if (method === 'DELETE') {
    if (!body.id) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'id is required' }) }
    }
    items = items.filter(i => i.id !== body.id)
    await saveInventory(items)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return {
    statusCode: 405,
    headers: { ...JSON_HEADERS, Allow: 'GET, POST, PUT, DELETE' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  }
}
