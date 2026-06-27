import { randomBytes } from 'crypto'
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson } from '../lib/s3.js'
import { requireAuth, canCreateFits } from '../lib/auth.js'
import { JSON_HEADERS } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

type FitItem = { itemId: string; slug: string; name: string; imageUrl: string }
type Suitcase = { id: string; name?: string; items: FitItem[]; createdAt: string; ownerEmail: string }

// One object per suitcase — same race-free per-key pattern as fits (fits.ts). No image.
const SUITCASES_PREFIX = 'suitcases/items/'
const suitcaseKey = (id: string) => `${SUITCASES_PREFIX}${id}.json`
const Bucket = process.env.S3_BUCKET_NAME

// Strip the server-only ownerEmail before returning to the client.
const toPublicSuitcase = ({ ownerEmail: _ownerEmail, ...rest }: Suitcase) => rest

async function listSuitcases(): Promise<Suitcase[]> {
  // Personal-scale: a single ListObjectsV2 page (≤1000) covers it; no pagination.
  const out = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: SUITCASES_PREFIX }))
  const keys = (out.Contents ?? []).map(o => o.Key!).filter(k => k.endsWith('.json'))
  const suitcases = (await Promise.all(keys.map(k => readJson<Suitcase>(k)))).filter((s): s is Suitcase => !!s)
  return suitcases.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// A suitcase's fits live only on the suitcase, so deleting it deletes them too.
// Removes the fit JSON only (composed images stay orphaned, like fits.ts DELETE).
async function deleteSuitcaseFits(suitcaseId: string): Promise<void> {
  const out = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: 'fits/items/' }))
  const keys = (out.Contents ?? []).map(o => o.Key!).filter(k => k.endsWith('.json'))
  const fits = await Promise.all(keys.map(k => readJson<{ suitcaseId?: string }>(k)))
  const stale = keys.filter((_, i) => fits[i]?.suitcaseId === suitcaseId)
  await Promise.all(stale.map(k => s3.send(new DeleteObjectCommand({ Bucket, Key: k }))))
}

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (event.httpMethod === 'GET') {
    const suitcases = await listSuitcases()
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(suitcases.map(toPublicSuitcase)) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  // Creating a suitcase needs the fit allowlist; editing/deleting one is owner-scoped below
  // (unlike fits, which are collaborative — a suitcase is personal trip-planning).
  if (!canCreateFits(netlifyUser.email)) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  if (event.httpMethod === 'POST') {
    if (!event.body) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Body required' }) }
    const { name, items } = JSON.parse(event.body) as { name?: string; items?: FitItem[] }
    if (items !== undefined && !Array.isArray(items)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'items must be an array' }) }
    }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name must be a string (max 60 chars)' }) }
    }

    const id = randomBytes(6).toString('hex')
    const suitcase: Suitcase = {
      id,
      ...(name?.trim() ? { name: name.trim() } : {}),
      items: items ?? [],
      ownerEmail: netlifyUser.email,
      createdAt: new Date().toISOString(),
    }
    await writeJson(suitcaseKey(id), suitcase)
    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(toPublicSuitcase(suitcase)) }
  }

  if (event.httpMethod === 'PUT') {
    if (!event.body) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Body required' }) }
    const { id, name, items } = JSON.parse(event.body) as { id: string; name?: string; items?: FitItem[] }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name must be a string (max 60 chars)' }) }
    }
    if (items !== undefined && !Array.isArray(items)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'items must be an array' }) }
    }

    const existing = await readJson<Suitcase>(suitcaseKey(id))
    if (!existing) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Not found' }) }
    if (existing.ownerEmail !== netlifyUser.email) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    const updated: Suitcase = {
      ...existing,
      ...(name !== undefined ? { name: name.trim() || undefined } : {}),
      ...(items !== undefined ? { items } : {}),
    }
    await writeJson(suitcaseKey(id), updated)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(toPublicSuitcase(updated)) }
  }

  if (event.httpMethod === 'DELETE') {
    if (!event.body) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Body required' }) }
    const { id } = JSON.parse(event.body) as { id: string }
    const existing = await readJson<Suitcase>(suitcaseKey(id))
    if (!existing) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Not found' }) }
    if (existing.ownerEmail !== netlifyUser.email) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
    }
    await s3.send(new DeleteObjectCommand({ Bucket, Key: suitcaseKey(id) }))
    await deleteSuitcaseFits(id) // fits are siloed to the suitcase — cascade-delete them
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET, POST, PUT, DELETE' }, body: JSON.stringify({ error: 'Method not allowed' }) }
}
