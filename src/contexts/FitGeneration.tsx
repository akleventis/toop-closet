import { useRef, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { startFitJob, fetchFitJob, fetchFitJobs, ackFitJob, fetchFit } from '../api'
import type { FitJob } from '../api'
import { currentToken, currentWorkspace } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { FitGenerationContext } from './fitGenerationContext'
import type { PendingFit, GenResult, FitGenerationCtx } from './fitGenerationContext'

const POLL_MS = 2500
const JOB_MAX_MS = 20 * 60 * 1000    // matches the server's stale cutoff
const JOB_GRACE_MS = 45_000          // a missing job file this early just means a cold start

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Lives above <Routes>. The background function commits the fit; this only tracks progress, and
// on mount/refocus adopts whatever is still running server-side.
export function FitGenerationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingFit[]>([])
  const { toast, showToast } = useToast()
  const listeners = useRef(new Set<(r: GenResult) => void>())
  const tracked = useRef(new Set<string>())

  const subscribe = useCallback((cb: (r: GenResult) => void) => {
    listeners.current.add(cb)
    return () => { listeners.current.delete(cb) }
  }, [])

  // `adopted` changes what a missing job file means: another client acked it, vs. never started.
  const follow = useCallback((job: FitJob, adopted = false) => {
    if (tracked.current.has(job.jobId)) return
    tracked.current.add(job.jobId)
    const { jobId, name, items, existingId, suitcaseId } = job
    setPending(prev => prev.some(p => p.jobId === jobId) ? prev : [{ jobId, name, items, existingId, suitcaseId }, ...prev])

    void (async () => {
      const token = currentToken()
      const started = Date.parse(job.startedAt)
      try {
        if (!token) return   // logged out mid-job; the fit still lands, we just stop watching
        let settled = job.status === 'pending' ? null : job
        while (!settled) {
          await sleep(POLL_MS)
          const next = await fetchFitJob(jobId, token).catch(() => undefined)
          if (next === undefined) continue                                   // network blip, keep polling
          if (next === null) {
            if (Date.now() < started + JOB_GRACE_MS) continue                // job file not written yet
            if (adopted) return                                              // another client acked it
            throw new Error('Generation never started')
          }
          if (next.status !== 'pending') settled = next
          else if (Date.now() > started + JOB_MAX_MS) throw new Error('Fit generation timed out')
        }
        const done = settled
        if (done.status === 'error') throw new Error(done.error || 'Fit generation failed')
        const fit = done.fitId ? await fetchFit(done.fitId).catch(() => null) : null
        showToast(done.existingId ? 'Fit regenerated.' : 'Fit created.')
        // Failing to read back an already-committed fit isn't a generation failure: leave the job
        // unacked so a later resume() retries it, rather than reporting an error over a real fit.
        if (!fit) return
        listeners.current.forEach(cb => cb({ fit, existingId: done.existingId }))
        void ackFitJob(jobId, token).catch(() => {})
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[fit] generation failed:', msg)
        showToast(`Failed to generate fit: ${msg}`, 'error')
        void ackFitJob(jobId, token).catch(() => {})
      } finally {
        tracked.current.delete(jobId)
        setPending(prev => prev.filter(p => p.jobId !== jobId))
      }
    })()
  }, [showToast])

  const resume = useCallback(() => {
    const token = currentToken()
    if (!token) return
    fetchFitJobs(token, currentWorkspace()).then(jobs => jobs.forEach(job => follow(job, true))).catch(() => {})
  }, [follow])

  useEffect(() => {
    resume()
    const onVisible = () => { if (document.visibilityState === 'visible') resume() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [resume])

  const generate: FitGenerationCtx['generate'] = (name, items, context, token, existingFit, stub, suitcaseId, workspace) => {
    const effectiveSuitcaseId = existingFit?.suitcaseId ?? suitcaseId
    const jobId = crypto.randomUUID()
    // Optimistic card so the spinner shows before the 202 lands.
    setPending(prev => [{ jobId, name, items, existingId: existingFit?.id, suitcaseId: effectiveSuitcaseId }, ...prev])
    startFitJob({ jobId, name, items, context, existingId: existingFit?.id, suitcaseId: effectiveSuitcaseId, workspace, stub }, token)
      .then(follow)
      .catch(err => {
        showToast(`Failed to generate fit: ${err instanceof Error ? err.message : String(err)}`, 'error')
        setPending(prev => prev.filter(p => p.jobId !== jobId))
      })
  }

  return (
    <FitGenerationContext.Provider value={{ pending, generate, subscribe }}>
      {children}
      {toast && <Toast message={toast.msg} variant={toast.variant} />}
    </FitGenerationContext.Provider>
  )
}
