import type { ClothingItem, SavePayload } from './types'

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

export async function removeBackground(file: File, slug: string, token: string): Promise<File> {
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${BASE}/withoutbg?slug=${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': file.type,
    },
    body: file,
  })
  if (!res.ok) throw new Error('Background removal failed')
  const blob = await res.blob()
  return new File([blob], 'image.webp', { type: 'image/webp' })
}

export async function getMySlug(token: string): Promise<string> {
  const res = await fetch(`${BASE}/whoami`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to identify user')
  const { slug } = await res.json() as { slug: string }
  return slug
}
