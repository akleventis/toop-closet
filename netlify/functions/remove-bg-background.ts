import { randomUUID } from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson, s3PublicUrl } from '../lib/s3.js'
import { requireAuthFromHeader, canActOnCloset } from '../lib/auth.js'
import { removeBackground, bgRemovalConfigured } from '../lib/bgRemoval.js'
import { JSON_HEADERS, SLUG_RE, errorRes, forbidden, unauthorized } from '../lib/types.js'
import type { HandlerEvent, HandlerResponse } from '../lib/types.js'

// Source images are already in S3, so the browser only kicks this off and can't strand it.
type Item = {
  id: string; name: string; category: string
  imageUrl: string; imageUrls?: string[]; notes?: string
  bgPendingAt?: string; bgError?: string
}

const Bucket = process.env.S3_BUCKET_NAME
const inventoryKey = (slug: string) => `inventory/${slug}.json`
const ok: HandlerResponse = { statusCode: 200, headers: JSON_HEADERS, body: '' }
const FETCH_TIMEOUT_MS = 20_000
// GET /clothes is public, so bgError is too — keep it generic and log the detail server-side.
const BG_ERROR = 'Background removal failed'

const imagesOf = (item: Item): string[] =>
  item.imageUrls?.length ? item.imageUrls : item.imageUrl ? [item.imageUrl] : []

// Re-reads right before writing so a concurrent save elsewhere in the closet isn't clobbered.
async function patchItem(slug: string, itemId: string, fn: (item: Item) => Item): Promise<void> {
  const items = (await readJson<Item[]>(inventoryKey(slug))) ?? []
  await writeJson(inventoryKey(slug), items.map(i => (i.id === itemId ? fn(i) : i)))
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'POST' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { slug, itemId, indexes } = (event.body ? JSON.parse(event.body) : {}) as { slug?: string; itemId?: string; indexes?: number[] }
  if (!slug || !SLUG_RE.test(slug)) return errorRes(400, 'slug is required')
  if (!itemId || !Array.isArray(indexes) || indexes.length === 0) return errorRes(400, 'itemId and indexes are required')

  const user = await requireAuthFromHeader(event)
  if (!user) return unauthorized()
  if (!(await canActOnCloset(user, slug))) return forbidden()

  const item = ((await readJson<Item[]>(inventoryKey(slug))) ?? []).find(i => i.id === itemId)
  if (!item) return errorRes(404, 'Item not found')

  const swapped = new Map<string, string>()   // original URL → cleaned URL
  // Netlify answers 202 before this runs, so a returned error never reaches the browser — from
  // here every outcome is reported on the item record instead.
  const finish = async (error?: string): Promise<HandlerResponse> => {
    if (error) console.error(`[remove-bg] ${slug}/${itemId}:`, error)
    await patchItem(slug, itemId, i => {
      const urls = imagesOf(i).map(u => swapped.get(u) ?? u)
      return {
        ...i,
        imageUrl: urls[0] ?? '',
        imageUrls: urls.length > 1 ? urls : undefined,
        bgPendingAt: undefined,
        bgError: error ? BG_ERROR : undefined,
      }
    }).catch(() => {})
    return ok
  }

  if (!bgRemovalConfigured()) return finish('WITHOUTBG_URL/WITHOUTBG_SECRET not configured')
  await patchItem(slug, itemId, i => ({ ...i, bgPendingAt: new Date().toISOString(), bgError: undefined }))

  const source = imagesOf(item)
  const ownPrefix = s3PublicUrl(`clothing/${slug}/`)
  try {
    for (const i of indexes) {
      const src = source[i]
      if (!src) continue
      // An item's URL is otherwise arbitrary (clothes.ts takes any http(s)), i.e. an SSRF probe.
      if (!src.startsWith(ownPrefix)) return finish(`refusing foreign image url: ${src}`)
      const res = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) throw new Error(`could not read image ${i + 1} (${res.status})`)
      const cleaned = await removeBackground(
        Buffer.from(await res.arrayBuffer()),
        res.headers.get('content-type') ?? 'image/jpeg',
        'webp',
      )
      const Key = `clothing/${slug}/${randomUUID()}`
      await s3.send(new PutObjectCommand({ Bucket, Key, Body: cleaned, ContentType: 'image/webp' }))
      swapped.set(src, s3PublicUrl(Key))
    }
    // Originals stay: fit/suitcase snapshots may still point at them, so the reaper owns cleanup.
    return finish()
  } catch (err) {
    return finish(err instanceof Error ? err.message : String(err))
  }
}
