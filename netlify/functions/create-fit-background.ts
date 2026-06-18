import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { requireAuthFromHeader, canCreateFits } from '../lib/auth.js'
import { removeBackground, bgRemovalConfigured } from '../lib/bgRemoval.js'
import { writeJson } from '../lib/s3.js'
import { JSON_HEADERS } from '../lib/types.js'
import type { HandlerEvent, HandlerResponse } from '../lib/types.js'

// The `-background.ts` filename makes Netlify 202 instantly then run to completion (15-min cap); the result lands in an S3 job file that `fit-status` polls.
const model = 'gpt-4o'
const prompt = 'The first image shows the base subject, for body type and pose reference only. Generate a realistic fashion image of a model with the same general build, proportions, skin tone, and relaxed pose as the base subject, wearing all of the clothing items together as one complete outfit. Treat it as a styling mockup — the goal is to show how the items look worn together, not to depict any specific individual. Most items should be worn with a loose, oversized, relaxed fit unless an item is clearly a fitted/slim cut.'
const quality = 'low' as const
const size = '1024x1024' as const
const CONTEXT_MAX = 500 // defensive server-side cap (textarea caps at 300)

type FitItem = { name: string; imageUrl: string }

type ImageOutput = { result: string }
type JobResult = { status: 'done' | 'error'; imageBase64?: string; error?: string }

const JOB_ID_RE = /^[a-zA-Z0-9_-]+$/
const jobKey = (jobId: string) => `fits/_jobs/${jobId}.json`
const ok: HandlerResponse = { statusCode: 200, headers: JSON_HEADERS, body: '' }

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'POST' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { jobId, items, context: stylingContext, stub } = (event.body ? JSON.parse(event.body) : {}) as { jobId?: string; items?: FitItem[]; context?: string; stub?: boolean }
  // Validate before it touches an S3 key — path-traversal guard.
  if (!jobId || !JOB_ID_RE.test(jobId)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Valid jobId required' }) }
  }

  // Caller already has its 202 — report every outcome via the job file.
  const fail = async (error: string): Promise<HandlerResponse> => {
    await writeJson(jobKey(jobId), { status: 'error', error } satisfies JobResult)
    return ok
  }

  try {
    const netlifyUser = await requireAuthFromHeader(event)
    if (!netlifyUser) return fail('Unauthorized')
    if (!canCreateFits(netlifyUser.email)) return fail('Forbidden')
    if (!items?.length) return fail('items required')

    // Dev-only placeholder; double-gated on NETLIFY_DEV so a stray `stub:true` can't stub in prod.
    if (stub && process.env.NETLIFY_DEV === 'true') {
      // WebP so the stored object's bytes match its image/webp key + content-type (see fits.ts).
      const imageBase64 = readFileSync(join(process.cwd(), 'public', 'base-subject.webp')).toString('base64')
      await writeJson(jobKey(jobId), { status: 'done', imageBase64 } satisfies JobResult)
      return ok
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return fail('OpenAI not configured')

    // Inline as a data URL — OpenAI can't fetch a localhost URL in dev.
    const baseSubjectBase64 = readFileSync(join(process.cwd(), 'public', 'base-subject.webp')).toString('base64')
    const baseSubjectUrl = `data:image/webp;base64,${baseSubjectBase64}`

    const openai = new OpenAI({ apiKey })
    const label = (text: string) => ({ type: 'input_text' as const, text })
    const image = (url: string) => ({ type: 'input_image' as const, image_url: url, detail: 'auto' as const })

    // Label each image so the model can map a name (e.g. "basketcase") to the right item.
    const ctx = (stylingContext ?? '').trim().slice(0, CONTEXT_MAX)
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

    // Best-effort bg removal — a NAS outage falls back to the raw generated WebP.
    let imageBase64 = imageOutput.result
    if (bgRemovalConfigured()) {
      try {
        const cleaned = await removeBackground(Buffer.from(imageBase64, 'base64'), 'image/webp', 'webp')
        imageBase64 = cleaned.toString('base64')
      } catch (err) {
        console.warn(`[create-fit] job ${jobId} bg removal skipped:`, err instanceof Error ? err.message : err)
      }
    }

    await writeJson(jobKey(jobId), { status: 'done', imageBase64 } satisfies JobResult)
    return ok
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[create-fit] job ${jobId} error:`, message)
    return fail(message)
  }
}
