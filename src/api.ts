import type { ClothingItem, SavePayload } from './types'

const BASE = '/.netlify/functions'

function authHeaders(token: string): Record<string, string> {
  if (!token) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

export async function fetchItems(signal?: AbortSignal): Promise<ClothingItem[]> {
  const res = await fetch(`${BASE}/clothes`, { signal })
  if (!res.ok) throw new Error('Failed to fetch inventory')
  return res.json() as Promise<ClothingItem[]>
}

export async function createItem(item: SavePayload, token: string): Promise<ClothingItem> {
  const res = await fetch(`${BASE}/clothes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(item),
  })
  if (!res.ok) throw new Error('Failed to create item')
  return res.json() as Promise<ClothingItem>
}

export async function updateItem(item: ClothingItem, token: string): Promise<ClothingItem> {
  const res = await fetch(`${BASE}/clothes`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(item),
  })
  if (!res.ok) throw new Error('Failed to update item')
  return res.json() as Promise<ClothingItem>
}

export async function deleteItem(id: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/clothes`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error('Failed to delete item')
}

export async function uploadImage(file: File, token: string): Promise<string> {
  const res = await fetch(`${BASE}/upload-url`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
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
