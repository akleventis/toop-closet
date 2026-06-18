import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3, s3PublicUrl } from '../lib/s3.js'
import { requireAuth } from '../lib/auth.js'
import { readClosetConfig } from '../lib/userConfig.js'
import { JSON_HEADERS, SLUG_RE } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const user = requireAuth(context)
  if (!user) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { contentType, slug, url } = body as { contentType?: unknown; slug?: unknown; url?: unknown }

  if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) }
  }

  const closetConfig = await readClosetConfig(slug)
  if (!closetConfig || closetConfig.ownerEmail !== user.email) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  if (event.httpMethod === 'DELETE') {
    if (!url || typeof url !== 'string') {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'url is required' }) }
    }
    let key: string
    try {
      key = new URL(url).pathname.slice(1)
    } catch {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid url' }) }
    }
    if (!key.startsWith(`clothing/${slug}/`)) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) }
    }
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }))
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
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
  const imageUrl = s3PublicUrl(key)

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ uploadUrl, imageUrl }),
  }
}
