import { useEffect, useRef } from 'react'

// Ref for a container that calls onOutside on a mousedown outside it while `active`.
// Keeps the latest callback in a ref so it only (re)subscribes when `active` flips.
export function useOutsideClick<T extends HTMLElement>(active: boolean, onOutside: () => void) {
  const ref = useRef<T>(null)
  const cb = useRef(onOutside)
  useEffect(() => { cb.current = onOutside })
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) cb.current() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active])
  return ref
}
