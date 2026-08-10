import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3, readJson, writeJson } from './s3.js'
import type { StoredFitItem } from './fits.js'

// Written before generation starts, so a client that lost its poll loop can list these and resume.
const Bucket = process.env.S3_BUCKET_NAME
const JOBS_PREFIX = 'fits/_jobs/'
const jobKey = (jobId: string) => `${JOBS_PREFIX}${jobId}.json`
export const JOB_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/ // guards the S3 key against traversal

// Past the 15-min background-function cap, so a job is only stale once its function can't be alive.
const JOB_STALE_MS = 20 * 60 * 1000

export type FitJob = {
  jobId: string
  status: 'pending' | 'done' | 'error'
  ownerEmail: string
  startedAt: string
  items: StoredFitItem[]
  name?: string
  existingId?: string   // set when regenerating an existing fit
  suitcaseId?: string
  fitId?: string        // the committed fit, once status is 'done'
  error?: string
}

// ownerEmail is server-only, same rule as fits.
export const toPublicJob = ({ ownerEmail: _ownerEmail, ...rest }: FitJob) => rest

export const writeJob = (job: FitJob) => writeJson(jobKey(job.jobId), job)
export const readJob = (jobId: string) => readJson<FitJob>(jobKey(jobId))

export const deleteJob = (jobId: string) =>
  s3.send(new DeleteObjectCommand({ Bucket, Key: jobKey(jobId) })).catch(() => {})

export async function listJobs(workspaces: string[]): Promise<FitJob[]> {
  // Personal-scale: a single ListObjectsV2 page (≤1000) covers it; no pagination.
  const out = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: JOBS_PREFIX }))
  const keys = (out.Contents ?? []).map(o => o.Key!).filter(k => k.endsWith('.json'))
  const jobs = (await Promise.all(keys.map(k => readJson<FitJob>(k)))).filter((j): j is FitJob => !!j)
  const cutoff = Date.now() - JOB_STALE_MS
  const allowed = new Set(workspaces.map(w => w.toLowerCase()))
  return jobs
    .filter(j => allowed.has((j.ownerEmail ?? '').toLowerCase()) && Date.parse(j.startedAt) > cutoff)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}
