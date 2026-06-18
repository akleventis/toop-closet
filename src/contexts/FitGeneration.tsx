import { createContext, useContext, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Fit, FitItem } from '../types'
import { createFit, saveFit, updateFit } from '../api'
import Toast from '../components/Toast'
import type { ToastVariant } from '../components/Toast'

// Client-side loading state for a fit being generated. `existingId` set = regenerating
// an existing fit (spinner overlays that card); unset = a brand-new fit (standalone card).
export type PendingFit = { tempId: string; name?: string; items: FitItem[]; existingId?: string }

// Result handed to any mounted subscriber (FitsPage) so it can patch its local list.
// If no one is subscribed (user navigated away), the fit is still persisted server-side
// and shows up on the next fetchFits — so nothing is lost.
type GenResult = { fit: Fit; existingId?: string }

type Ctx = {
  pending: PendingFit[]
  generate: (
    name: string | undefined,
    items: FitItem[],
    context: string,
    token: string,
    existingFit?: Fit,
    stub?: boolean,
  ) => void
  subscribe: (cb: (r: GenResult) => void) => () => void
}

const FitGenerationContext = createContext<Ctx | null>(null)

// Lives above <Routes> so generation + polling survive in-app navigation: leaving /fits
// no longer aborts an in-flight job. Outcomes always surface via the global toast here,
// regardless of which page is showing.
export function FitGenerationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingFit[]>([])
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null)
  const listeners = useRef(new Set<(r: GenResult) => void>())

  const showToast = (msg: string, variant: ToastVariant = 'success') => {
    setToast({ msg, variant })
    setTimeout(() => setToast(null), variant === 'error' ? 6000 : 2200)
  }

  const subscribe = useCallback((cb: (r: GenResult) => void) => {
    listeners.current.add(cb)
    return () => { listeners.current.delete(cb) }
  }, [])

  const generate: Ctx['generate'] = (name, items, context, token, existingFit, stub) => {
    const tempId = crypto.randomUUID()
    setPending(prev => [{ tempId, name, items, existingId: existingFit?.id }, ...prev])
    void (async () => {
      try {
        // No AbortSignal: the job must run to completion even if the user leaves /fits.
        const base64 = await createFit(items, context, token, stub)
        const fit = existingFit
          ? await updateFit(existingFit.id, { name, items, imageBase64: base64, context }, token)
          : await saveFit(name, items, base64, token, context)
        listeners.current.forEach(cb => cb({ fit, existingId: existingFit?.id }))
        showToast(existingFit ? 'Fit regenerated.' : 'Fit created.')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[fit] generation failed:', msg)
        showToast(`Failed to generate fit: ${msg}`, 'error')
      } finally {
        setPending(prev => prev.filter(p => p.tempId !== tempId))
      }
    })()
  }

  return (
    <FitGenerationContext.Provider value={{ pending, generate, subscribe }}>
      {children}
      {toast && <Toast message={toast.msg} variant={toast.variant} />}
    </FitGenerationContext.Provider>
  )
}

export function useFitGeneration(): Ctx {
  const ctx = useContext(FitGenerationContext)
  if (!ctx) throw new Error('useFitGeneration must be used within FitGenerationProvider')
  return ctx
}
