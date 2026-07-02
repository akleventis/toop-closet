import { randomBytes } from 'crypto'
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson } from '../lib/s3.js'
import { requireAuth, canActOn, targetWorkspace } from '../lib/auth.js'
import { JSON_HEADERS, forbidden, unauthorized, errorRes } from '../lib/types.js'
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
    const { id, workspace } = event.queryStringParameters ?? {}
    const all = await listSuitcases()
    // A specific suitcase by id is unscoped so share links resolve for any viewer; else scope the list to a workspace.
    const result = id
      ? all.filter(s => s.id === id)
      : all.filter(s => s.ownerEmail.toLowerCase() === (workspace || process.env.OWNER_EMAIL || '').toLowerCase())
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result.map(toPublicSuitcase)) }
  }

  // Any logged-in user has full access to all suitcases.
  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return unauthorized()
  }

  if (event.httpMethod === 'POST') {
    if (!event.body) return errorRes(400, 'Body required')
    const { name, items, workspace } = JSON.parse(event.body) as { name?: string; items?: FitItem[]; workspace?: string }
    if (items !== undefined && !Array.isArray(items)) {
      return errorRes(400, 'items must be an array')
    }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return errorRes(400, 'name must be a string (max 60 chars)')
    }
    const ws = await targetWorkspace(netlifyUser, workspace)
    if (!ws) return forbidden()

    const id = randomBytes(6).toString('hex')
    const suitcase: Suitcase = {
      id,
      ...(name?.trim() ? { name: name.trim() } : {}),
      items: items ?? [],
      ownerEmail: ws,
      createdAt: new Date().toISOString(),
    }
    await writeJson(suitcaseKey(id), suitcase)
    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(toPublicSuitcase(suitcase)) }
  }

  if (event.httpMethod === 'PUT') {
    if (!event.body) return errorRes(400, 'Body required')
    const { id, name, items } = JSON.parse(event.body) as { id: string; name?: string; items?: FitItem[] }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return errorRes(400, 'name must be a string (max 60 chars)')
    }
    if (items !== undefined && !Array.isArray(items)) {
      return errorRes(400, 'items must be an array')
    }

    const existing = await readJson<Suitcase>(suitcaseKey(id))
    if (!existing) return errorRes(404, 'Not found')
    // Editable if you own or are a seat of the suitcase's workspace.
    if (!(await canActOn(netlifyUser, existing.ownerEmail))) {
      return forbidden()
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
    if (!event.body) return errorRes(400, 'Body required')
    const { id } = JSON.parse(event.body) as { id: string }
    const existing = await readJson<Suitcase>(suitcaseKey(id))
    if (!existing) return errorRes(404, 'Not found')
    if (!(await canActOn(netlifyUser, existing.ownerEmail))) {
      return forbidden()
    }
    await s3.send(new DeleteObjectCommand({ Bucket, Key: suitcaseKey(id) }))
    await deleteSuitcaseFits(id) // fits are siloed to the suitcase — cascade-delete them
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET, POST, PUT, DELETE' }, body: JSON.stringify({ error: 'Method not allowed' }) }
}
