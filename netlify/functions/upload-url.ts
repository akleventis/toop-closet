import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '../lib/auth.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const s3 = new S3Client({ region: process.env.AWS_REGION })
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  if (!requireAuth(context)) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '') as Record<string, unknown>
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { filename, contentType } = body as { filename?: unknown; contentType?: unknown }

  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'filename is required' }) }
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType as string)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'contentType must be an image MIME type (jpeg, png, webp, gif, avif)' }) }
  }

  const baseName = filename.split(/[\\/]/).pop() ?? 'upload'
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  const key = `clothing/${Date.now()}-${safeName}`

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType as string,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ uploadUrl, imageUrl }),
  }
}
