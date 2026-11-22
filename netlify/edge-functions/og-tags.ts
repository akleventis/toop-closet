// Link-preview bots don't run JS, so inject og:/twitter: tags into the SPA's index.html for share links.
// Reads go through the public functions (same origin, unscoped by id); any failure falls back to a generic preview.

type Context = { next(): Promise<Response> }
type FitItem = { itemId: string; slug: string; name: string; imageUrl: string }
type Item = { id: string; name: string; category: string; imageUrl: string; imageUrls?: string[]; notes?: string }
type Fit = { id: string; name?: string; imageUrl: string; items: FitItem[] }
type Suitcase = { id: string; name?: string }
type Preview = { title: string; description?: string; image?: string; large: boolean }

const SITE = 'MM6'
const SLUG_RE = /^[a-z0-9_-]{1,50}$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const RESERVED = new Set(['fits', 'suitcases'])

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

async function getJson<T>(origin: string, path: string): Promise<T | null> {
  try {
    // real users wait on this too, so cap a slow cold start; timeout → generic preview
    const res = await fetch(`${origin}/.netlify/functions/${path}`, { signal: AbortSignal.timeout(3000) })
    return res.ok ? (await res.json()) as T : null
  } catch {
    return null
  }
}

const fitPreview = (fit: Fit): Preview => ({
  title: fit.name || 'Fit',
  description: fit.items.map(i => i.name).join(', ') || undefined,
  image: fit.imageUrl,
  large: true,
})

async function preview(url: URL): Promise<Preview | null> {
  const [first, second, ...rest] = url.pathname.split('/').filter(Boolean)
  if (rest.length) return null
  const fitId = url.searchParams.get('fit')

  if (first === 'fits' && !second && fitId && ID_RE.test(fitId)) {
    const fit = (await getJson<Fit[]>(url.origin, `fits?id=${fitId}`))?.[0]
    return fit ? fitPreview(fit) : null
  }

  if (first === 'suitcases' && second && ID_RE.test(second)) {
    if (fitId && ID_RE.test(fitId)) {
      const fit = (await getJson<Fit[]>(url.origin, `fits?id=${fitId}`))?.[0]
      if (fit) return fitPreview(fit)
    }
    const suitcase = (await getJson<Suitcase[]>(url.origin, `suitcases?id=${second}`))?.[0]
    if (!suitcase) return null
    return { title: suitcase.name || 'Suitcase', large: false }
  }

  const itemId = url.searchParams.get('item')
  if (first && !second && !RESERVED.has(first) && SLUG_RE.test(first) && itemId && ID_RE.test(itemId)) {
    const [items, config] = await Promise.all([
      getJson<Item[]>(url.origin, `clothes?slug=${first}`),
      getJson<{ name?: string }>(url.origin, `config?slug=${first}`),
    ])
    const item = items?.find(i => i.id.startsWith(itemId))
    if (!item) return null
    const image = (item.imageUrls ?? [item.imageUrl])[0]
    const description = [config?.name || first, item.category, item.notes].filter(Boolean).join(' · ')
    return { title: item.name, description, image, large: !!image }
  }

  return null
}

function tags(p: Preview, url: URL): string {
  const meta: [string, string, string | undefined][] = [
    ['property', 'og:site_name', SITE],
    ['property', 'og:type', 'website'],
    ['property', 'og:title', p.title],
    ['property', 'og:description', p.description],
    ['property', 'og:image', p.image],
    ['property', 'og:url', url.href],
    ['name', 'twitter:card', p.large ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', p.title],
    ['name', 'twitter:description', p.description],
    ['name', 'twitter:image', p.image],
  ]
  return meta
    .filter(([, , v]) => v)
    .map(([attr, key, v]) => `<meta ${attr}="${key}" content="${esc(v!)}" />`)
    .join('\n    ')
}

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') return
  const res = await context.next()
  if (!res.headers.get('content-type')?.includes('text/html')) return res

  const url = new URL(request.url)
  const p = (await preview(url)) ?? { title: SITE, image: `${url.origin}/icon.png`, large: false }
  const html = (await res.text()).replace('</head>', `  ${tags(p, url)}\n  </head>`)

  const headers = new Headers(res.headers)
  headers.delete('content-length')
  return new Response(html, { status: res.status, headers })
}

export const config = {
  path: '/*',
  excludedPath: ['/.netlify/*', '/assets/*', '/*.*'],
}
