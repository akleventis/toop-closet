import type { ClothingItem, SavePayload, UserConfig, UserCloset, OwnProfile, Fit, FitItem, Suitcase } from './types'

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

export async function createCloset(name: string, token: string, workspace?: string): Promise<UserConfig> {
  const res = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, workspace }),
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

// The background function commits the fit and reports through this record, so polling only
// decides when to refresh the UI — dropping it can't lose the result.
export type FitJob = {
  jobId: string
  status: 'pending' | 'done' | 'error'
  startedAt: string
  items: FitItem[]
  name?: string
  existingId?: string
  suitcaseId?: string
  fitId?: string
  error?: string
}

// 202s immediately, before the job file exists — so this returns the job we expect to be written.
export async function startFitJob(args: {
  jobId: string
  items: FitItem[]
  context: string
  name?: string
  existingId?: string
  suitcaseId?: string
  workspace?: string
  stub?: boolean
}, token: string): Promise<FitJob> {
  const res = await fetch(`${BASE}/create-fit-background`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(args),
  })
  if (!res.ok && res.status !== 202) throw new Error('Failed to start fit generation')
  const { jobId, items, name, existingId, suitcaseId } = args
  return { jobId, status: 'pending', startedAt: new Date().toISOString(), items, name, existingId, suitcaseId }
}

// How a reloaded client finds work in flight.
export async function fetchFitJobs(token: string, workspace?: string): Promise<FitJob[]> {
  const q = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''
  const res = await fetch(`${BASE}/fit-status${q}`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to fetch fit jobs')
  return res.json() as Promise<FitJob[]>
}

// null = no such job: either not written yet (cold start) or already acknowledged.
export async function fetchFitJob(jobId: string, token: string): Promise<FitJob | null> {
  const res = await fetch(`${BASE}/fit-status?jobId=${encodeURIComponent(jobId)}`, { headers: authHeaders(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch fit job')
  return res.json() as Promise<FitJob>
}

export async function ackFitJob(jobId: string, token: string): Promise<void> {
  await fetch(`${BASE}/fit-status?jobId=${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export async function fetchFits(workspace?: string): Promise<Fit[]> {
  const q = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''
  const res = await fetch(`${BASE}/fits${q}`)
  if (!res.ok) throw new Error('Failed to fetch fits')
  return res.json() as Promise<Fit[]>
}

// Single fit by exact id (unscoped) — so a shared /fits?fit= link opens regardless of active workspace.
export async function fetchFit(id: string): Promise<Fit | null> {
  const res = await fetch(`${BASE}/fits?id=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('Failed to fetch fit')
  return ((await res.json()) as Fit[])[0] ?? null
}

export async function updateFit(id: string, updates: { name?: string; items?: FitItem[]; imageBase64?: string; context?: string; suitcaseId?: string }, token: string): Promise<Fit> {
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

export async function fetchSuitcases(workspace?: string): Promise<Suitcase[]> {
  const q = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''
  const res = await fetch(`${BASE}/suitcases${q}`)
  if (!res.ok) throw new Error('Failed to fetch suitcases')
  return res.json() as Promise<Suitcase[]>
}

// Single suitcase + its fits by id (unscoped) — so share links resolve regardless of active workspace.
export async function fetchSuitcase(id: string): Promise<Suitcase | null> {
  const res = await fetch(`${BASE}/suitcases?id=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('Failed to fetch suitcase')
  return ((await res.json()) as Suitcase[])[0] ?? null
}

export async function fetchSuitcaseFits(suitcaseId: string): Promise<Fit[]> {
  const res = await fetch(`${BASE}/fits?suitcaseId=${encodeURIComponent(suitcaseId)}`)
  if (!res.ok) throw new Error('Failed to fetch suitcase fits')
  return res.json() as Promise<Fit[]>
}

export async function createSuitcase(name: string | undefined, items: FitItem[], token: string, workspace?: string): Promise<Suitcase> {
  const res = await fetch(`${BASE}/suitcases`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, items, workspace }),
  })
  if (!res.ok) throw new Error('Failed to create suitcase')
  return res.json() as Promise<Suitcase>
}

export async function updateSuitcase(id: string, updates: { name?: string; items?: FitItem[] }, token: string): Promise<Suitcase> {
  const res = await fetch(`${BASE}/suitcases`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) throw new Error('Failed to update suitcase')
  return res.json() as Promise<Suitcase>
}

export async function deleteSuitcase(id: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/suitcases`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error('Failed to delete suitcase')
}

// The function reads the already-uploaded images from S3 and writes results back itself.
export async function startBgRemoval(slug: string, itemId: string, indexes: number[], token: string): Promise<void> {
  const res = await fetch(`${BASE}/remove-bg-background`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ slug, itemId, indexes }),
  })
  if (!res.ok && res.status !== 202) throw new Error('Failed to start background removal')
}

