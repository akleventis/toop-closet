import { requireAuth, accessibleWorkspaces, norm } from '../lib/auth.js'
import { readJob, listJobs, deleteJob, toPublicJob, JOB_ID_RE } from '../lib/fitJobs.js'
import { JSON_HEADERS, unauthorized, forbidden, errorRes } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

// Progress only — create-fit-background commits the fit. Never auto-deletes on read: a second
// client must still see the outcome; unacked files age out via the fits/_jobs/ lifecycle rule.
export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const { httpMethod } = event
  if (httpMethod !== 'GET' && httpMethod !== 'DELETE') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET, DELETE' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return unauthorized()
  }

  const { jobId, workspace } = event.queryStringParameters ?? {}

  if (!jobId) {
    if (httpMethod === 'DELETE') return errorRes(400, 'Valid jobId required')
    const mine = await accessibleWorkspaces(netlifyUser)
    // ?workspace= narrows to the active one, so a collaborator's job isn't a phantom card in your list.
    const scope = workspace ? mine.filter(w => w === norm(workspace)) : mine
    const jobs = await listJobs(scope)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(jobs.map(toPublicJob)) }
  }

  // Validate before building the S3 key (prevents path traversal into other objects).
  if (!JOB_ID_RE.test(jobId)) {
    return errorRes(400, 'Valid jobId required')
  }

  const job = await readJob(jobId)
  if (!job) return errorRes(404, 'Not found')
  // A job is readable only within the workspace that owns it.
  if (!(await accessibleWorkspaces(netlifyUser)).includes(norm(job.ownerEmail ?? ''))) return forbidden()

  if (httpMethod === 'DELETE') {
    await deleteJob(jobId)
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(toPublicJob(job)) }
}
