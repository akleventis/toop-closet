import { requireAuth } from '../lib/auth.js'
import { removeBackground, bgRemovalConfigured } from '../lib/bgRemoval.js'
import { JSON_HEADERS, unauthorized, errorRes } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'POST' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return unauthorized()
  }

  if (!bgRemovalConfigured()) {
    return errorRes(503, 'Background removal not configured')
  }

  if (!event.body) {
    return errorRes(400, 'Image body is required')
  }

  const imageBuffer = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body, 'binary')

  const contentType = event.headers['content-type'] ?? 'image/jpeg'

  let resultBuffer: Buffer
  try {
    resultBuffer = await removeBackground(imageBuffer, contentType, 'webp')
  } catch (err) {
    // Timeout aborts the fetch with an AbortError → 504; anything else (non-2xx, network) → 502.
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return {
      statusCode: timedOut ? 504 : 502,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: timedOut ? 'Background removal timed out' : 'Background removal failed' }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/webp' },
    isBase64Encoded: true,
    body: resultBuffer.toString('base64'),
  }
}
