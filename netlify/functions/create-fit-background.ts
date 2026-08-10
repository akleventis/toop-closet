import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { requireAuthFromHeader, canActOn, targetWorkspace, norm } from '../lib/auth.js'
import { removeBackground, bgRemovalConfigured } from '../lib/bgRemoval.js'
import { createFit, patchFit, readFit } from '../lib/fits.js'
import type { StoredFitItem } from '../lib/fits.js'
import { writeJob, JOB_ID_RE } from '../lib/fitJobs.js'
import type { FitJob } from '../lib/fitJobs.js'
import { JSON_HEADERS, errorRes, unauthorized } from '../lib/types.js'
import type { HandlerEvent, HandlerResponse } from '../lib/types.js'

// The `-background.ts` filename makes Netlify 202 instantly then run to completion (15-min cap).
// Owns the whole job — job file, generation, and the fit commit — so the browser can't orphan it.
const model = 'gpt-4o'
const prompt = 'The first image shows the base subject, for body type and pose reference only. Generate a realistic fashion image of a model with the same general build, proportions, skin tone, and relaxed pose as the base subject, wearing all of the clothing items together as one complete outfit. Treat it as a styling mockup — the goal is to show how the items look worn together, not to depict any specific individual. Most items should be worn with a loose, oversized, relaxed fit unless an item is clearly a fitted/slim cut.'
const quality = 'low' as const
const size = '1024x1024' as const
const CONTEXT_MAX = 500 // defensive server-side cap (textarea caps at 300)

type ImageOutput = { result: string }

const ok: HandlerResponse = { statusCode: 200, headers: JSON_HEADERS, body: '' }

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'POST' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { jobId, items, context: stylingContext, stub, name, existingId, suitcaseId, workspace } =
    (event.body ? JSON.parse(event.body) : {}) as {
      jobId?: string; items?: StoredFitItem[]; context?: string; stub?: boolean
      name?: string; existingId?: string; suitcaseId?: string; workspace?: string
    }
  // Validate before it touches an S3 key — path-traversal guard.
  if (!jobId || !JOB_ID_RE.test(jobId)) return errorRes(400, 'Valid jobId required')

  // Auth resolves before any write, so an unauthenticated caller can't litter the jobs prefix.
  const netlifyUser = await requireAuthFromHeader(event)
  if (!netlifyUser) return unauthorized()

  // Same caps fits.ts enforces on PUT; this path writes the record directly so it can't inherit them.
  const safeName = typeof name === 'string' ? name.slice(0, 60) : undefined
  const safeContext = typeof stylingContext === 'string' ? stylingContext.slice(0, CONTEXT_MAX) : undefined
  const safeSuitcaseId = typeof suitcaseId === 'string' ? suitcaseId : undefined

  const base = { jobId, items: items ?? [], startedAt: new Date().toISOString(), ...(safeName ? { name: safeName } : {}), ...(existingId ? { existingId } : {}) }
  // Netlify answers 202 before this runs, so a returned error never reaches the browser — failures
  // go in the job file, authz ones in the caller's own workspace so they can read it back.
  const failIn = async (ownerEmail: string, error: string): Promise<HandlerResponse> => {
    await writeJob({ ...base, ownerEmail, status: 'error', error })
    return ok
  }
  const own = norm(netlifyUser.email)

  if (!items?.length) return failIn(own, 'No items selected')
  const existing = existingId ? await readFit(existingId) : null
  if (existingId && !existing) return failIn(own, 'Fit no longer exists')
  // Regenerate stays in the fit's own workspace; a new fit lands in the active one.
  const ownerEmail = existing
    ? ((await canActOn(netlifyUser, existing.ownerEmail)) ? existing.ownerEmail : null)
    : await targetWorkspace(netlifyUser, workspace)
  if (!ownerEmail) return failIn(own, 'Not a member of that workspace')

  // Preserve the suitcase tag on regenerate; use the passed id for a brand-new suitcase fit.
  const effectiveSuitcaseId = existing?.suitcaseId ?? safeSuitcaseId
  const job: FitJob = {
    ...base,
    items,
    status: 'pending',
    ownerEmail,
    ...(effectiveSuitcaseId ? { suitcaseId: effectiveSuitcaseId } : {}),
  }
  await writeJob(job)

  const fail = async (error: string): Promise<HandlerResponse> => {
    await writeJob({ ...job, status: 'error', error })
    return ok
  }

  try {
    let imageBase64: string

    // Dev-only placeholder; double-gated on NETLIFY_DEV so a stray `stub:true` can't stub in prod.
    if (stub && process.env.NETLIFY_DEV === 'true') {
      // WebP so the stored object's bytes match its image/webp key + content-type (see lib/fits.ts).
      imageBase64 = readFileSync(join(process.cwd(), 'public', 'base-subject.webp')).toString('base64')
    } else {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return fail('OpenAI not configured')

      // Inline as a data URL — OpenAI can't fetch a localhost URL in dev.
      const baseSubjectBase64 = readFileSync(join(process.cwd(), 'public', 'base-subject.webp')).toString('base64')
      const baseSubjectUrl = `data:image/webp;base64,${baseSubjectBase64}`

      const openai = new OpenAI({ apiKey })
      const label = (text: string) => ({ type: 'input_text' as const, text })
      const image = (url: string) => ({ type: 'input_image' as const, image_url: url, detail: 'auto' as const })

      // Label each image so the model can map a name (e.g. "basketcase") to the right item.
      const ctx = (safeContext ?? '').trim()
      const instructions = ctx ? `${prompt}\n\nAdditional styling direction: ${ctx}` : prompt
      const content = [
        label('Body type and pose reference:'), image(baseSubjectUrl),
        ...items.flatMap((it, i) => [label(`Item ${i + 1} — "${it.name}":`), image(it.imageUrl)]),
        label(instructions),
      ]

      const started = Date.now()
      const response = await openai.responses.create({
        model,
        input: [{ role: 'user', content }],
        // WebP to match the rest of the app's images (and the bg-removal fallback below).
        tools: [{ type: 'image_generation' as const, quality, size, output_format: 'webp' as const }],
      })
      console.log(`[create-fit] job ${jobId} generated in ${((Date.now() - started) / 1000).toFixed(1)}s`)

      const imageOutput = response.output.find(item => item.type === 'image_generation_call') as ImageOutput | undefined
      if (!imageOutput) return fail('No image generated')
      imageBase64 = imageOutput.result

      // Best-effort bg removal — a NAS outage falls back to the raw generated WebP.
      if (bgRemovalConfigured()) {
        try {
          const cleaned = await removeBackground(Buffer.from(imageBase64, 'base64'), 'image/webp', 'webp')
          imageBase64 = cleaned.toString('base64')
        } catch (err) {
          console.warn(`[create-fit] job ${jobId} bg removal skipped:`, err instanceof Error ? err.message : err)
        }
      }
    }

    // Commit here, not on the client — the fit exists whether or not anyone is still polling.
    const fit = existing
      ? await patchFit(existing, { name: safeName, items, imageBase64, context: safeContext, suitcaseId: effectiveSuitcaseId })
      : await createFit({ name: safeName, items, imageBase64, context: safeContext, suitcaseId: effectiveSuitcaseId, ownerEmail })
    await writeJob({ ...job, status: 'done', fitId: fit.id })
    return ok
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[create-fit] job ${jobId} error:`, message)
    return fail(message)
  }
}
