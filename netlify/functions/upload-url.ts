import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3, s3PublicUrl } from '../lib/s3.js'
import { requireAuth, canActOnCloset } from '../lib/auth.js'
import { JSON_HEADERS, SLUG_RE, forbidden, unauthorized, errorRes } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const user = requireAuth(context)
  if (!user) {
    return unauthorized()
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '') as Record<string, unknown>
  } catch {
    return errorRes(400, 'Invalid JSON body')
  }

  const { contentType, slug, url } = body as { contentType?: unknown; slug?: unknown; url?: unknown }

  if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return errorRes(400, 'slug is required')
  }

  // Writable only in a workspace you own or are a seat of.
  if (!(await canActOnCloset(user, slug))) return forbidden()

  if (event.httpMethod === 'DELETE') {
    if (!url || typeof url !== 'string') {
      return errorRes(400, 'url is required')
    }
    let key: string
    try {
      key = new URL(url).pathname.slice(1)
    } catch {
      return errorRes(400, 'invalid url')
    }
    if (!key.startsWith(`clothing/${slug}/`)) {
      return forbidden()
    }
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }))
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  if (!ALLOWED_IMAGE_TYPES.has(contentType as string)) {
    return errorRes(400, 'contentType must be an image MIME type (jpeg, png, webp, gif, avif)')
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
