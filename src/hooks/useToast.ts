import { useState, useCallback } from 'react'
import type { ToastVariant } from '../components/Toast'

// Top-center toast with auto-dismiss. Pair with `{toast && <Toast .../>}` at the page root.
// showToast is stable so it can sit in effect deps.
export function useToast() {
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null)
  const showToast = useCallback((msg: string, variant: ToastVariant = 'success') => {
    setToast({ msg, variant })
    setTimeout(() => setToast(null), variant === 'error' ? 6000 : 2200)
  }, [])
  return { toast, showToast }
}
