import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'
import { requireAuth, canActOn, targetWorkspace, workspaceProfile, norm } from '../lib/auth.js'
import { readClosetConfig, writeClosetConfig, allClosetConfigs, generateSlug } from '../lib/userConfig.js'
import { JSON_HEADERS, SLUG_RE, forbidden, unauthorized, errorRes } from '../lib/types.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const DEFAULT_CATEGORIES = ['Tee Shirts', 'Jackets', 'Pants/Shorts', 'Shoes', 'Misc']

export const handler = async (event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const method = event.httpMethod
  const slug = event.queryStringParameters?.slug

  // Public: GET ?slug → categories + name for any closet
  if (method === 'GET' && slug) {
    if (!SLUG_RE.test(slug)) {
      return errorRes(400, 'Invalid slug')
    }
    const config = await readClosetConfig(slug)
    if (!config) {
      return errorRes(404, 'Closet not found')
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: config.slug, categories: config.categories, name: config.name }),
    }
  }

  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return unauthorized()
  }

  // Auth: GET (no slug) → the workspaces this user can act in (own + seat-of), each with its closets
  // (grouped from all closet configs by ownerEmail). `closets` = own workspace, kept for older clients.
  if (method === 'GET') {
    const own = norm(netlifyUser.email)
    const [profile, configs] = await Promise.all([workspaceProfile(netlifyUser), allClosetConfigs()])
    const workspaces = profile.map(w => ({
      ownerEmail: w.email,
      own: w.email === own,
      ...(w.name ? { name: w.name } : {}),
      closets: configs.filter(c => norm(c.ownerEmail) === w.email).map(c => ({ slug: c.slug, name: c.name })),
    }))
    const ownClosets = workspaces.find(w => w.own)?.closets ?? []
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ workspaces, closets: ownClosets }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return errorRes(400, 'Invalid JSON')
  }

  // Auth: POST { name?, workspace? } → create a closet (auto-slug) in the active workspace
  if (method === 'POST') {
    const name = body.name as string | undefined
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 60)) {
      return errorRes(400, 'name must be a non-empty string (max 60 chars)')
    }
    const workspace = await targetWorkspace(netlifyUser, body.workspace as string | undefined)
    if (!workspace) {
      return forbidden()
    }

    const newSlug = await generateSlug()
    const config = {
      slug: newSlug,
      ownerEmail: workspace,
      categories: DEFAULT_CATEGORIES,
      ...(name ? { name: name.trim() } : {}),
    }
    await writeClosetConfig(config)

    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: newSlug, categories: config.categories, name: config.name }),
    }
  }

  // Auth: PUT { slug, categories?, name? } → update own closet
  if (method === 'PUT') {
    const { slug: putSlug, categories, name } = body as { slug?: unknown; categories?: unknown; name?: unknown }
    if (!putSlug || typeof putSlug !== 'string' || !SLUG_RE.test(putSlug)) {
      return errorRes(400, 'slug is required')
    }
    const config = await readClosetConfig(putSlug)
    if (!config) {
      return errorRes(404, 'Closet not found')
    }
    if (!(await canActOn(netlifyUser, config.ownerEmail))) {
      return forbidden()
    }
    const updated = { ...config }
    if (categories !== undefined) {
      if (
        !Array.isArray(categories) ||
        categories.length === 0 ||
        (categories as unknown[]).some(c => typeof c !== 'string' || !c.trim() || c.length > 40)
      ) {
        return errorRes(400, 'categories must be a non-empty array of strings (max 40 chars each)')
      }
      updated.categories = categories as string[]
    }
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
        return errorRes(400, 'name must be a non-empty string (max 60 chars)')
      }
      updated.name = name.trim()
    }
    await writeClosetConfig(updated)
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ slug: updated.slug, categories: updated.categories, name: updated.name }),
    }
  }

  // Auth: DELETE { slug } → delete own closet (config + inventory, images orphaned)
  if (method === 'DELETE') {
    const { slug: delSlug } = body as { slug?: unknown }
    if (!delSlug || typeof delSlug !== 'string' || !SLUG_RE.test(delSlug)) {
      return errorRes(400, 'slug is required')
    }
    const config = await readClosetConfig(delSlug)
    if (!config) {
      return errorRes(404, 'Closet not found')
    }
    if (!(await canActOn(netlifyUser, config.ownerEmail))) {
      return forbidden()
    }
    await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `users/${delSlug}/config.json` })),
      s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `inventory/${delSlug}.json` })),
    ])
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }
  }

  return errorRes(405, 'Method not allowed')
}
