import { createContext, useContext } from 'react'
import type { Fit, FitItem } from '../types'

// Client-side loading state for a fit being generated. `existingId` set = regenerating
// an existing fit (spinner overlays that card); unset = a brand-new fit (standalone card).
export type PendingFit = { tempId: string; name?: string; items: FitItem[]; existingId?: string; suitcaseId?: string }

// Handed to a mounted subscriber (FitsPage / SuitcaseDetailPage) to patch its local list.
// If nobody's subscribed, the fit is still persisted and shows up on the next fetchFits.
export type GenResult = { fit: Fit; existingId?: string }

export type FitGenerationCtx = {
  pending: PendingFit[]
  generate: (
    name: string | undefined,
    items: FitItem[],
    context: string,
    token: string,
    existingFit?: Fit,
    stub?: boolean,
    suitcaseId?: string,
  ) => void
  subscribe: (cb: (r: GenResult) => void) => () => void
}

export const FitGenerationContext = createContext<FitGenerationCtx | null>(null)

export function useFitGeneration(): FitGenerationCtx {
  const ctx = useContext(FitGenerationContext)
  if (!ctx) throw new Error('useFitGeneration must be used within FitGenerationProvider')
  return ctx
}
