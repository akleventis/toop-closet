import type { ClothingItem, SavePayload, UserConfig } from './types'

const BASE = '/.netlify/functions'

function authHeaders(token: string): Record<string, string> {
  if (!token) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

export async function fetchItems(slug: string, signal?: AbortSignal): Promise<ClothingItem[]> {
  const res = await fetch(`${BASE}/clothes?slug=${encodeURIComponent(slug)}`, { signal })
  if (!res.ok) throw new Error('Failed to fetch inventory')
  return res.json() as Promise<ClothingItem[]>
}

export async function createItem(item: SavePayload, slug: string, token: string): Promise<ClothingItem> {
  const res = await fetch(`${BASE}/clothes?slug=${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(item),
  })
  if (!res.ok) throw new Error('Failed to create item')
  return res.json() as Promise<ClothingItem>
}

export async function updateItem(item: ClothingItem, slug: string, token: string): Promise<ClothingItem> {
  const res = await fetch(`${BASE}/clothes?slug=${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(item),
  })
  if (!res.ok) throw new Error('Failed to update item')
  return res.json() as Promise<ClothingItem>
}

export async function deleteItem(id: string, slug: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/clothes?slug=${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error('Failed to delete item')
}

export async function uploadImage(file: File, slug: string, token: string): Promise<string> {
  const res = await fetch(`${BASE}/upload-url`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ contentType: file.type, slug }),
  })
  if (!res.ok) throw new Error('Failed to get upload URL')
  const { uploadUrl, imageUrl } = await res.json() as { uploadUrl: string; imageUrl: string }
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!put.ok) throw new Error('Failed to upload image')
  return imageUrl
}

async function resizeImage(file: File, maxDim = 1500): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>(resolve =>
    canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85)
  )
  return new File([blob], 'image.jpg', { type: 'image/jpeg' })
}

export async function fetchClosets(): Promise<string[]> {
  const res = await fetch(`${BASE}/closets`)
  if (!res.ok) throw new Error('Failed to fetch closets')
  const { slugs } = await res.json() as { slugs: string[] }
  return slugs
}

export async function fetchConfig(slug: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config?slug=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json() as Promise<UserConfig>
}

export async function getOwnConfig(token: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to fetch own config')
  return res.json() as Promise<UserConfig>
}

export async function updateCategories(categories: string[], token: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ categories }),
  })
  if (!res.ok) throw new Error('Failed to update categories')
  return res.json() as Promise<UserConfig>
}

export async function removeBackground(file: File, slug: string, token: string): Promise<File> {
  if (!token) throw new Error('Not authenticated')
  const compressed = await resizeImage(file)
  const res = await fetch(`${BASE}/withoutbg?slug=${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': compressed.type,
    },
    body: compressed,
  })
  if (!res.ok) throw new Error('Background removal failed')
  const blob = await res.blob()
  return new File([blob], 'image.webp', { type: 'image/webp' })
}

