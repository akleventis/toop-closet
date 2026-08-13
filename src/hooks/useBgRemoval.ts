import { useEffect } from 'react'
import { fetchItems, startBgRemoval } from '../api'
import { isBgPending, getImages } from '../types'
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

  useEffect(() => {
    if (!anyPending) return
    let stopped = false
    // The jobs this loop is watching. Scoped to the loop, so a failure toasts once as it happens
    // and the errors already sitting on the closet at load time stay quiet (⋮ Retry shows those).
    const watching = new Set(items.filter(isBgPending).map(i => i.id))
    void (async () => {
      while (!stopped) {
        await new Promise(r => setTimeout(r, POLL_MS))
        if (stopped) return
        const fresh = await fetchItems(slug).catch(() => null)
        if (stopped || !fresh) continue
        for (const f of fresh) {
          if (isBgPending(f)) watching.add(f.id)
          else if (f.bgError && watching.delete(f.id)) onError(`Background removal failed for "${f.name}" — retry from its ⋮ menu.`)
        }
        // Only adopt items we were watching, so unrelated local edits aren't clobbered.
        setItems(prev => prev.map(p => {
          if (!p.bgPendingAt) return p
          const next = fresh.find(f => f.id === p.id)
          if (!next) return p
          // An outcome is never "hasn't started yet", so only a blank record waits out the grace.
          if (!next.bgPendingAt && !next.bgError && Date.now() - Date.parse(p.bgPendingAt) < START_GRACE_MS) return p
          return next
        }))
      }
    })()
    return () => { stopped = true }
    // items is read once to seed `watching`; re-running on every edit would restart the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, anyPending, setItems, onError])

  const start = (itemId: string, indexes: number[]) => {
    const at = new Date().toISOString()
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, bgPendingAt: at, bgError: undefined, bgRetry: undefined } : i)))
    startBgRemoval(slug, itemId, indexes, token).catch(() => {
      setItems(prev => prev.map(i => (i.id === itemId ? { ...i, bgPendingAt: undefined } : i)))
      onError('Could not start background removal.')
    })
  }

  // Photos are already in S3, so a failed job re-runs on the slots it never finished.
  const retry = (item: ClothingItem) => {
    const indexes = item.bgRetry?.length ? item.bgRetry : getImages(item).map((_, i) => i)
    if (indexes.length) start(item.id, indexes)
  }

  return { start, retry }
}
