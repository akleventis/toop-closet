import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3, readJson } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { JSON_HEADERS } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

// Polled by the client while `create-fit-background` generates the image.
type JobResult = { status: 'done' | 'error'; imageBase64?: string; error?: string }

const JOB_ID_RE = /^[a-zA-Z0-9_-]+$/

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const jobId = event.queryStringParameters?.jobId
  // Validate before building the S3 key (prevents path traversal into other objects).
  if (!jobId || !JOB_ID_RE.test(jobId)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Valid jobId required' }) }
  }

  const key = `fits/_jobs/${jobId}.json`
  const result = await readJson<JobResult>(key)
  if (!result) {
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ status: 'pending' }) }
  }

  // Terminal result — clean up the transient job file (best effort).
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key })).catch(() => {})
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) }
}
