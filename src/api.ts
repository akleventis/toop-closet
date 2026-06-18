import type { ClothingItem, SavePayload, UserConfig, UserCloset, OwnProfile, Fit, FitItem } from './types'

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

export async function resizeImage(file: File, maxDim = 1500): Promise<File> {
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

export async function fetchClosets(): Promise<UserCloset[]> {
  const res = await fetch(`${BASE}/closets`)
  if (!res.ok) throw new Error('Failed to fetch closets')
  const data = await res.json() as { closets: UserCloset[] }
  return data.closets
}

export async function fetchConfig(slug: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config?slug=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json() as Promise<UserConfig>
}

export async function getOwnProfile(token: string): Promise<OwnProfile> {
  const res = await fetch(`${BASE}/config`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to fetch own profile')
  return res.json() as Promise<OwnProfile>
}

export async function createCloset(name: string, token: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? 'Failed to create closet')
  }
  return res.json() as Promise<UserConfig>
}

export async function updateCategories(categories: string[], slug: string, token: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ slug, categories }),
  })
  if (!res.ok) throw new Error('Failed to update categories')
  return res.json() as Promise<UserConfig>
}

export async function deleteCloset(slug: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/config`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ slug }),
  })
  if (!res.ok) throw new Error('Failed to delete closet')
}

export async function updateClosetName(name: string, slug: string, token: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ slug, name }),
  })
  if (!res.ok) throw new Error('Failed to update closet name')
  return res.json() as Promise<UserConfig>
}

export async function deleteImage(url: string, slug: string, token: string): Promise<void> {
  await fetch(`${BASE}/upload-url`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ url, slug }),
  })
}

// Image generation runs in a Netlify background function (sync functions cap at 26s).
// We kick off the job, then poll fit-status until the result lands in S3.
export async function createFit(items: FitItem[], context: string, token: string, stub = false, signal?: AbortSignal): Promise<string> {
  const jobId = crypto.randomUUID()
  const res = await fetch(`${BASE}/create-fit-background`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ jobId, items, context, stub }),
    signal,
  })
  // Background functions respond 202 Accepted immediately.
  if (!res.ok && res.status !== 202) throw new Error('Failed to start fit generation')

  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const statusRes = await fetch(`${BASE}/fit-status?jobId=${encodeURIComponent(jobId)}`, {
      headers: authHeaders(token),
      signal,
    })
    if (!statusRes.ok) continue
    const data = await statusRes.json() as { status: 'pending' | 'done' | 'error'; imageBase64?: string; error?: string }
    if (data.status === 'done' && data.imageBase64) return data.imageBase64
    if (data.status === 'error') throw new Error(data.error || 'Fit generation failed')
  }
  throw new Error('Fit generation timed out')
}

export async function fetchFits(): Promise<Fit[]> {
  const res = await fetch(`${BASE}/fits`)
  if (!res.ok) throw new Error('Failed to fetch fits')
  return res.json() as Promise<Fit[]>
}

export async function saveFit(name: string | undefined, items: FitItem[], imageBase64: string, token: string, context?: string): Promise<Fit> {
  const res = await fetch(`${BASE}/fits`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, items, imageBase64, context }),
  })
  if (!res.ok) throw new Error('Failed to save fit')
  return res.json() as Promise<Fit>
}

export async function updateFit(id: string, updates: { name?: string; items?: FitItem[]; imageBase64?: string; context?: string }, token: string): Promise<Fit> {
  const res = await fetch(`${BASE}/fits`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) throw new Error('Failed to update fit')
  return res.json() as Promise<Fit>
}

export async function deleteFit(id: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/fits`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error('Failed to delete fit')
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

