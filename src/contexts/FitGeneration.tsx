import { useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createFit, saveFit, updateFit } from '../api'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { FitGenerationContext } from './fitGenerationContext'
import type { PendingFit, GenResult, FitGenerationCtx } from './fitGenerationContext'

// Lives above <Routes> so generation + polling survive in-app navigation (leaving /fits won't
// abort an in-flight job); outcomes always surface via the global toast here.
export function FitGenerationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingFit[]>([])
  const { toast, showToast } = useToast()
  const listeners = useRef(new Set<(r: GenResult) => void>())

  const subscribe = useCallback((cb: (r: GenResult) => void) => {
    listeners.current.add(cb)
    return () => { listeners.current.delete(cb) }
  }, [])

  const generate: FitGenerationCtx['generate'] = (name, items, context, token, existingFit, stub, suitcaseId, workspace) => {
    // Preserve the suitcase tag on regenerate; use the passed id for a brand-new suitcase fit.
    const effectiveSuitcaseId = existingFit?.suitcaseId ?? suitcaseId
    const tempId = crypto.randomUUID()
    setPending(prev => [{ tempId, name, items, existingId: existingFit?.id, suitcaseId: effectiveSuitcaseId }, ...prev])
    void (async () => {
      try {
        // No AbortSignal: the job must run to completion even if the user leaves /fits.
        const base64 = await createFit(items, context, token, stub)
        // New fits land in the active workspace; regenerate keeps the existing fit's workspace.
        const fit = existingFit
          ? await updateFit(existingFit.id, { name, items, imageBase64: base64, context, suitcaseId: effectiveSuitcaseId }, token)
          : await saveFit(name, items, base64, token, context, effectiveSuitcaseId, workspace)
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
