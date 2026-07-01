import { randomBytes } from 'crypto'
import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson, s3PublicUrl } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { JSON_HEADERS } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

type FitItem = { itemId: string; slug: string; name: string; imageUrl: string }
type Fit = { id: string; name?: string; imageUrl: string; items: FitItem[]; context?: string; suitcaseId?: string; createdAt: string; ownerEmail: string }

// Each fit is its own object — independent keys, so concurrent creates/edits can't race.
// The list endpoint fans out across the prefix instead of reading a shared index.
const FITS_PREFIX = 'fits/items/'
const fitKey = (id: string) => `${FITS_PREFIX}${id}.json`
const CONTEXT_MAX = 500 // mirrors create-fit-background's server-side cap
const Bucket = process.env.S3_BUCKET_NAME

// Strip the server-only ownerEmail before returning a fit to the client.
const toPublicFit = ({ ownerEmail: _ownerEmail, ...rest }: Fit) => rest

async function listFits(): Promise<Fit[]> {
  // Personal-scale: a single ListObjectsV2 page (≤1000) covers it; no pagination.
  const out = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: FITS_PREFIX }))
  const keys = (out.Contents ?? []).map(o => o.Key!).filter(k => k.endsWith('.json'))
  const fits = (await Promise.all(keys.map(k => readJson<Fit>(k)))).filter((f): f is Fit => !!f)
  return fits.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (event.httpMethod === 'GET') {
    const fits = await listFits()
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(fits.map(toPublicFit)) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  if (event.httpMethod === 'POST') {
    if (!event.body) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Body required' }) }
    const { name, items, imageBase64, context, suitcaseId } = JSON.parse(event.body) as { name?: string; items: FitItem[]; imageBase64: string; context?: string; suitcaseId?: string }
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'items must be a non-empty array' }) }
    }
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'imageBase64 is required' }) }
    }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name must be a string (max 60 chars)' }) }
    }
    if (context !== undefined && (typeof context !== 'string' || context.length > CONTEXT_MAX)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: `context must be a string (max ${CONTEXT_MAX} chars)` }) }
    }
    if (suitcaseId !== undefined && typeof suitcaseId !== 'string') {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'suitcaseId must be a string' }) }
    }

    const id = randomBytes(6).toString('hex')
    const imageKey = `clothing/fits-${id}.webp`

    await s3.send(new PutObjectCommand({
      Bucket,
      Key: imageKey,
      Body: Buffer.from(imageBase64, 'base64'),
      ContentType: 'image/webp',
    }))

    const fit: Fit = {
      id,
      ...(name?.trim() ? { name: name.trim() } : {}),
      // Cache-bust: key is fixed per fit id, so ?v= forces a refetch after a regenerate.
      imageUrl: `${s3PublicUrl(imageKey)}?v=${Date.now()}`,
      items,
      ...(context?.trim() ? { context: context.trim() } : {}),
      ...(suitcaseId ? { suitcaseId } : {}),
      ownerEmail: netlifyUser.email,
      createdAt: new Date().toISOString(),
    }

    await writeJson(fitKey(id), fit)
    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(toPublicFit(fit)) }
  }

  if (event.httpMethod === 'PUT') {
    if (!event.body) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Body required' }) }
    const { id, name, items, imageBase64, context, suitcaseId } = JSON.parse(event.body) as { id: string; name?: string; items?: FitItem[]; imageBase64?: string; context?: string; suitcaseId?: string }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name must be a string (max 60 chars)' }) }
    }
    if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'items must be a non-empty array' }) }
    }
    if (imageBase64 !== undefined && typeof imageBase64 !== 'string') {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'imageBase64 must be a string' }) }
    }
    if (context !== undefined && (typeof context !== 'string' || context.length > CONTEXT_MAX)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: `context must be a string (max ${CONTEXT_MAX} chars)` }) }
    }
    if (suitcaseId !== undefined && typeof suitcaseId !== 'string') {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'suitcaseId must be a string' }) }
    }

    // Any logged-in user can edit any fit.
    const existing = await readJson<Fit>(fitKey(id))
    if (!existing) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Not found' }) }

    let imageUrl = existing.imageUrl
    if (imageBase64) {
      const imageKey = `clothing/fits-${id}.webp`
      await s3.send(new PutObjectCommand({
        Bucket,
        Key: imageKey,
        Body: Buffer.from(imageBase64, 'base64'),
        ContentType: 'image/webp',
      }))
      // Cache-bust: key is fixed per fit id, so ?v= forces a refetch after a regenerate.
      imageUrl = `${s3PublicUrl(imageKey)}?v=${Date.now()}`
    }

    const updated: Fit = {
      ...existing,
      ...(name !== undefined ? { name: name.trim() || undefined } : {}),
      ...(items !== undefined ? { items } : {}),
      ...(context !== undefined ? { context: context.trim() || undefined } : {}),
      ...(suitcaseId !== undefined ? { suitcaseId: suitcaseId || undefined } : {}),
      imageUrl,
    }
    await writeJson(fitKey(id), updated)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(toPublicFit(updated)) }
  }

  if (event.httpMethod === 'DELETE') {
    if (!event.body) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Body required' }) }
    const { id } = JSON.parse(event.body) as { id: string }

    const existing = await readJson<Fit>(fitKey(id))
    if (!existing) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Not found' }) }
    await s3.send(new DeleteObjectCommand({ Bucket, Key: fitKey(id) }))
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET, POST, PUT, DELETE' }, body: JSON.stringify({ error: 'Method not allowed' }) }
}
