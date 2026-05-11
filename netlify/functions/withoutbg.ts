import { requireAuth } from '../lib/auth.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'POST' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const withoutbgUrl = process.env.WITHOUTBG_URL
  const withoutbgSecret = process.env.WITHOUTBG_SECRET
  if (!withoutbgUrl || !withoutbgSecret) {
    return { statusCode: 503, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Background removal not configured' }) }
  }

  if (!event.body) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Image body is required' }) }
  }

  const imageBuffer = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body, 'binary')

  const contentType = event.headers['content-type'] ?? 'image/jpeg'

  const formData = new FormData()
  formData.append('file', new Blob([imageBuffer], { type: contentType }), 'image')
  formData.append('format', 'webp')
  formData.append('quality', '85')

  const res = await fetch(`${withoutbgUrl}/api/remove-background`, {
    method: 'POST',
    headers: { 'X-Withoutbg-Secret': withoutbgSecret },
    body: formData,
  })

  if (!res.ok) {
    return { statusCode: 502, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Background removal failed' }) }
  }

  const resultBuffer = Buffer.from(await res.arrayBuffer())

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/webp' },
    isBase64Encoded: true,
    body: resultBuffer.toString('base64'),
  }
}
