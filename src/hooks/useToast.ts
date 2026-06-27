import { useState } from 'react'
import type { ToastVariant } from '../components/Toast'

// Top-center toast with auto-dismiss. Pair with `{toast && <Toast .../>}` at the page root.
export function useToast() {
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null)
  const showToast = (msg: string, variant: ToastVariant = 'success') => {
    setToast({ msg, variant })
    setTimeout(() => setToast(null), variant === 'error' ? 6000 : 2200)
  }
  return { toast, showToast }
}
