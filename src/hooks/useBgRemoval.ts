import { useEffect, useRef } from 'react'
import { fetchItems, startBgRemoval } from '../api'
import { isBgPending } from '../types'
import type { ClothingItem } from '../types'

const POLL_MS = 4000
// The function hasn't flagged the item until it cold-starts; adopting early cancels the spinner.
const START_GRACE_MS = 30_000

type Args = {
  slug: string
  token: string
  items: ClothingItem[]
  setItems: (fn: (prev: ClothingItem[]) => ClothingItem[]) => void
  onError: (msg: string) => void
  enabled: boolean   // write access — bg state is public, but only the owner's business
}

// Job state lives on the items, not in this tab, so any mount that sees a pending one resumes it.
export function useBgRemoval({ slug, token, items, setItems, onError, enabled }: Args) {
  const anyPending = enabled && items.some(isBgPending)
  const reported = useRef(new Set<string>())

  useEffect(() => {
    if (!anyPending) return
    let stopped = false
    void (async () => {
      while (!stopped) {
        await new Promise(r => setTimeout(r, POLL_MS))
        if (stopped) return
        const fresh = await fetchItems(slug).catch(() => null)
        if (stopped || !fresh) continue
        // Only adopt items we were watching, so unrelated local edits aren't clobbered.
        setItems(prev => prev.map(p => {
          if (!p.bgPendingAt) return p
          const next = fresh.find(f => f.id === p.id)
          if (!next) return p
          if (!next.bgPendingAt && Date.now() - Date.parse(p.bgPendingAt) < START_GRACE_MS) return p
          return next
        }))
      }
    })()
    return () => { stopped = true }
  }, [slug, anyPending, setItems])

  // Once per session; the flag clears itself on the next edit or retry.
  useEffect(() => {
    if (!enabled) return
    for (const item of items) {
      if (!item.bgError || reported.current.has(item.id)) continue
      reported.current.add(item.id)
      onError(`Background removal failed for "${item.name}".`)
    }
  }, [items, onError, enabled])

  const start = (itemId: string, indexes: number[]) => {
    const at = new Date().toISOString()
    reported.current.delete(itemId)
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, bgPendingAt: at, bgError: undefined } : i)))
    startBgRemoval(slug, itemId, indexes, token).catch(() => {
      setItems(prev => prev.map(i => (i.id === itemId ? { ...i, bgPendingAt: undefined } : i)))
      onError('Could not start background removal.')
    })
  }

  return { start }
}
