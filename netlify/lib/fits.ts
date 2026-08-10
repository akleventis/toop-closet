import { randomBytes } from 'crypto'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson, s3PublicUrl, tagOrphaned } from './s3.js'

// Each fit is its own object — independent keys, so concurrent creates/edits can't race.
// Storage contract shared by fits.ts (read/edit/delete), suitcases.ts (cascade delete) and
// create-fit-background.ts, which is the only thing that creates a fit.
const Bucket = process.env.S3_BUCKET_NAME
export const FITS_PREFIX = 'fits/items/'
export const fitKey = (id: string) => `${FITS_PREFIX}${id}.json`
const fitImageKey = (id: string) => `clothing/fits-${id}.webp`

export type StoredFitItem = { itemId: string; slug: string; name: string; imageUrl: string }
export type StoredFit = {
  id: string
  name?: string
  imageUrl: string
  items: StoredFitItem[]
  context?: string
  suitcaseId?: string
  createdAt: string
  ownerEmail: string
}

export const readFit = (id: string) => readJson<StoredFit>(fitKey(id))

// Composite lives at a fixed key per fit id, so ?v= forces a refetch after a regenerate.
async function putFitImage(id: string, imageBase64: string): Promise<string> {
  const Key = fitImageKey(id)
  await s3.send(new PutObjectCommand({ Bucket, Key, Body: Buffer.from(imageBase64, 'base64'), ContentType: 'image/webp' }))
  return `${s3PublicUrl(Key)}?v=${Date.now()}`
}

export async function createFit(input: {
  name?: string
  items: StoredFitItem[]
  imageBase64: string
  context?: string
  suitcaseId?: string
  ownerEmail: string
}): Promise<StoredFit> {
  const id = randomBytes(6).toString('hex')
  const fit: StoredFit = {
    id,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    imageUrl: await putFitImage(id, input.imageBase64),
    items: input.items,
    ...(input.context?.trim() ? { context: input.context.trim() } : {}),
    ...(input.suitcaseId ? { suitcaseId: input.suitcaseId } : {}),
    ownerEmail: input.ownerEmail,
    createdAt: new Date().toISOString(),
  }
  await writeJson(fitKey(id), fit)
  return fit
}

export async function patchFit(existing: StoredFit, patch: {
  name?: string
  items?: StoredFitItem[]
  imageBase64?: string
  context?: string
  suitcaseId?: string
}): Promise<StoredFit> {
  const updated: StoredFit = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() || undefined } : {}),
    ...(patch.items !== undefined ? { items: patch.items } : {}),
    ...(patch.context !== undefined ? { context: patch.context.trim() || undefined } : {}),
    ...(patch.suitcaseId !== undefined ? { suitcaseId: patch.suitcaseId || undefined } : {}),
    ...(patch.imageBase64 ? { imageUrl: await putFitImage(existing.id, patch.imageBase64) } : {}),
  }
  await writeJson(fitKey(existing.id), updated)
  return updated
}

// Delete a fit's record and tag its 1:1 composite image for lifecycle expiry (best-effort tag).
export async function deleteFit(id: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: fitKey(id) }))
  await tagOrphaned(fitImageKey(id))
}
