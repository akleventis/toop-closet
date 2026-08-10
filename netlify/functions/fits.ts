import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson } from '../lib/s3.js'
import { FITS_PREFIX, fitKey, patchFit, deleteFit } from '../lib/fits.js'
import type { StoredFit, StoredFitItem } from '../lib/fits.js'
import { requireAuth, canActOn } from '../lib/auth.js'
import { JSON_HEADERS, forbidden, unauthorized, errorRes } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

// Fit storage keys/helpers live in lib/fits.ts (shared with suitcases.ts and the background
// generator). listFits fans out across the prefix instead of reading a shared index.
const CONTEXT_MAX = 500 // mirrors create-fit-background's server-side cap
const Bucket = process.env.S3_BUCKET_NAME

// Strip the server-only ownerEmail before returning a fit to the client.
const toPublicFit = ({ ownerEmail: _ownerEmail, ...rest }: StoredFit) => rest

async function listFits(): Promise<StoredFit[]> {
  // Personal-scale: a single ListObjectsV2 page (≤1000) covers it; no pagination.
  const out = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: FITS_PREFIX }))
  const keys = (out.Contents ?? []).map(o => o.Key!).filter(k => k.endsWith('.json'))
  const fits = (await Promise.all(keys.map(k => readJson<StoredFit>(k)))).filter((f): f is StoredFit => !!f)
  return fits.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (event.httpMethod === 'GET') {
    const { id, suitcaseId, workspace } = event.queryStringParameters ?? {}
    const all = await listFits()
    // ?id= one fit (exact id, non-enumerable) and ?suitcaseId= a suitcase's fits are unscoped so share links resolve for any viewer; else scope the list to a workspace.
    let fits: StoredFit[]
    if (id) fits = all.filter(f => f.id === id)
    else if (suitcaseId) fits = all.filter(f => f.suitcaseId === suitcaseId)
    else fits = all.filter(f => f.ownerEmail.toLowerCase() === (workspace || process.env.OWNER_EMAIL || '').toLowerCase())
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(fits.map(toPublicFit)) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return unauthorized()
  }

  if (event.httpMethod === 'PUT') {
    if (!event.body) return errorRes(400, 'Body required')
    const { id, name, items, imageBase64, context, suitcaseId } = JSON.parse(event.body) as { id: string; name?: string; items?: StoredFitItem[]; imageBase64?: string; context?: string; suitcaseId?: string }
    if (name !== undefined && (typeof name !== 'string' || name.length > 60)) {
      return errorRes(400, 'name must be a string (max 60 chars)')
    }
    if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
      return errorRes(400, 'items must be a non-empty array')
    }
    if (imageBase64 !== undefined && typeof imageBase64 !== 'string') {
      return errorRes(400, 'imageBase64 must be a string')
    }
    if (context !== undefined && (typeof context !== 'string' || context.length > CONTEXT_MAX)) {
      return errorRes(400, `context must be a string (max ${CONTEXT_MAX} chars)`)
    }
    if (suitcaseId !== undefined && typeof suitcaseId !== 'string') {
      return errorRes(400, 'suitcaseId must be a string')
    }

    const existing = await readJson<StoredFit>(fitKey(id))
    if (!existing) return errorRes(404, 'Not found')
    // Editable if you own or are a seat of the fit's workspace.
    if (!(await canActOn(netlifyUser, existing.ownerEmail))) return forbidden()

    const updated = await patchFit(existing, { name, items, imageBase64, context, suitcaseId })
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(toPublicFit(updated)) }
  }

  if (event.httpMethod === 'DELETE') {
    if (!event.body) return errorRes(400, 'Body required')
    const { id } = JSON.parse(event.body) as { id: string }

    const existing = await readJson<StoredFit>(fitKey(id))
    if (!existing) return errorRes(404, 'Not found')
    if (!(await canActOn(netlifyUser, existing.ownerEmail))) return forbidden()
    await deleteFit(id)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  // No POST: fits are created by create-fit-background, which commits them itself.
  return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET, PUT, DELETE' }, body: JSON.stringify({ error: 'Method not allowed' }) }
}
