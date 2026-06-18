// Shared client for the NAS background-removal service.
// Proxied to clients by functions/withoutbg.ts; called server-side by create-fit-background.ts.

export type BgFormat = 'webp' | 'png'

export const bgRemovalConfigured = (): boolean =>
  !!process.env.WITHOUTBG_URL && !!process.env.WITHOUTBG_SECRET

// Throws on missing config, non-2xx, or timeout. Callers decide whether that's fatal.
export async function removeBackground(
  image: Buffer,
  contentType: string,
  format: BgFormat = 'webp',
): Promise<Buffer> {
  const url = process.env.WITHOUTBG_URL
  const secret = process.env.WITHOUTBG_SECRET
  if (!url || !secret) throw new Error('Background removal not configured')

  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(image)], { type: contentType }), 'image')
  formData.append('format', format)
  formData.append('quality', '85')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(`${url}/api/remove-background`, {
      method: 'POST',
      headers: { 'X-Withoutbg-Secret': secret },
      body: formData,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Background removal failed (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}
