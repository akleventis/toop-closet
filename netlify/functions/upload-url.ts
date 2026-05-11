import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3 } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { parseUsers } from '../lib/users.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const SLUG_RE = /^[a-z0-9_-]{1,50}$/

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { contentType, slug } = body as { contentType?: unknown; slug?: unknown }

  if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) }
  }

  const users = parseUsers()
  if (!users.has(slug)) {
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Closet not found' }) }
  }
  if (netlifyUser.sub !== users.get(slug)) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  if (!ALLOWED_IMAGE_TYPES.has(contentType as string)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'contentType must be an image MIME type (jpeg, png, webp, gif, avif)' }) }
  }

  const key = `clothing/${slug}/${crypto.randomUUID()}`

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType as string,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ uploadUrl, imageUrl }),
  }
}
