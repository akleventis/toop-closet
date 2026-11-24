import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, putOrphanedTag } from '../lib/s3.js'
import type { StoredFit } from '../lib/fits.js'
import type { FitJob } from '../lib/fitJobs.js'
import type { HandlerResponse } from '../lib/types.js'

type InventoryItem = { imageUrl?: unknown; imageUrls?: unknown }
type Listed = { Key: string; LastModified?: Date }

const Bucket = process.env.S3_BUCKET_NAME
const MIN_AGE_MS = 24 * 60 * 60 * 1000
const TAG_CONCURRENCY = 10
const TIME_BUDGET_MS = 20_000 // scheduled fns are killed at 30s; leftovers wait for next week

async function listAll(prefix: string): Promise<Listed[]> {
  const out: Listed[] = []
  let ContinuationToken: string | undefined
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }))
    for (const o of res.Contents ?? []) if (o.Key) out.push({ Key: o.Key, LastModified: o.LastModified })
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (ContinuationToken)
  return out
}

function keyFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    const i = path.indexOf('/clothing/')
    return i === -1 ? null : path.slice(i + 1)
  } catch {
    return null
  }
}

async function referencedKeys(): Promise<{ refs: Set<string>; inventoryFiles: number; malformed: number }> {
  const refs = new Set<string>()
  let malformed = 0
  const add = (url: unknown) => {
    const key = keyFromUrl(url)
    if (key) refs.add(key)
  }
  const jsonKeys = async (prefix: string) =>
    (await listAll(prefix)).map(o => o.Key).filter(k => k.endsWith('.json'))

  const [inventory, fits, suitcases, jobs] = await Promise.all([
    jsonKeys('inventory/'),
    jsonKeys('fits/items/'),
    jsonKeys('suitcases/items/'),
    jsonKeys('fits/_jobs/'),
  ])

  const snapshotItems = (items: unknown) => {
    if (!Array.isArray(items)) { malformed++; return }
    for (const it of items as { imageUrl?: unknown }[]) add(it?.imageUrl)
  }

  await Promise.all([
    ...inventory.map(async key => {
      const items = await readJson<InventoryItem[]>(key)
      if (items === null) return
      if (!Array.isArray(items)) { malformed++; return }
      for (const it of items) {
        add(it?.imageUrl)
        if (Array.isArray(it?.imageUrls)) it.imageUrls.forEach(add)
      }
    }),
    ...fits.map(async key => {
      const fit = await readJson<StoredFit>(key)
      if (fit === null) return
      add(fit?.imageUrl)
      snapshotItems(fit?.items)
    }),
    ...suitcases.map(async key => {
      const suitcase = await readJson<{ items?: unknown }>(key)
      if (suitcase === null) return
      snapshotItems(suitcase?.items)
    }),
    ...jobs.map(async key => {
      const job = await readJson<FitJob>(key)
      if (job === null) return
      snapshotItems(job?.items)
    }),
  ])

  return { refs, inventoryFiles: inventory.length, malformed }
}

export const handler = async (): Promise<HandlerResponse> => {
  try {
    const started = Date.now()
    const live = process.env.ORPHAN_SWEEP === 'live'
    // references are read after the listing, so anything listed that's referenced at read time is seen
    const objects = await listAll('clothing/')
    const { refs, inventoryFiles, malformed } = await referencedKeys()

    if (inventoryFiles > 0 && refs.size === 0) {
      console.error('sweep-orphans: inventory exists but no references found, aborting', { inventoryFiles, malformed })
      return { statusCode: 200, body: '' }
    }

    const cutoff = Date.now() - MIN_AGE_MS
    let candidates = objects
      .filter(o => !refs.has(o.Key) && o.LastModified !== undefined && o.LastModified.getTime() < cutoff)
      .map(o => o.Key)

    let tagged = 0
    let failed = 0
    let skipped = 0
    if (live && malformed > 0) {
      console.error('sweep-orphans: malformed records, not tagging', { malformed })
    } else if (live && candidates.length > 0) {
      // second read catches a URL that moved between records mid-sweep (item transfer)
      const recheck = await referencedKeys()
      candidates = candidates.filter(k => !recheck.refs.has(k))
      for (let i = 0; i < candidates.length; i += TAG_CONCURRENCY) {
        if (Date.now() - started > TIME_BUDGET_MS) { skipped = candidates.length - i; break }
        const results = await Promise.allSettled(candidates.slice(i, i + TAG_CONCURRENCY).map(putOrphanedTag))
        for (const r of results) {
          if (r.status === 'fulfilled') tagged++
          else { failed++; console.error('sweep-orphans: tag failed', r.reason) }
        }
      }
    }

    console.log(JSON.stringify({
      live, scanned: objects.length, referenced: refs.size, candidates: candidates.length, tagged, failed, skipped, malformed,
    }))
    if (!live) for (const key of candidates) console.log(key)

    return { statusCode: 200, body: '' }
  } catch (err) {
    console.error('sweep-orphans failed', err)
    return { statusCode: 500, body: '' }
  }
}
