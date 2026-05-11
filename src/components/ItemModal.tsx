import { useState, useEffect, useMemo } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CATEGORIES } from '../constants'
import { uploadImage } from '../api'
import type { ModalState, SavePayload } from '../types'

type FormState = {
  id?: string
  name: string
  category: string
  imageUrl: string
}

const empty: FormState = { name: '', category: 'Tee Shirts', imageUrl: '' }

const field = 'w-full px-2.5 py-2 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none focus:ring-1 focus:ring-[--text]'
const label = 'flex flex-col gap-1 text-sm font-medium text-[--muted]'

type Props = {
  modal: ModalState
  onSave: (item: SavePayload) => Promise<void>
  onClose: () => void
  token: string
  slug: string
}

export default function ItemModal({ modal, onSave, onClose, token, slug }: Props) {
  const initial: FormState = modal.mode === 'edit' ? { ...modal.item } : empty
  const [form, setForm] = useState<FormState>(initial)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile]
  )

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const set = (f: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let imageUrl = form.imageUrl
      if (imageFile) imageUrl = await uploadImage(imageFile, slug, token)
      await onSave({ ...form, imageUrl })
    } catch (err) {
      console.error('Save failed', err)
      setError('Save failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-[--bg] border border-[--border] rounded-lg p-7 w-full max-w-[460px] max-h-[90svh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="m-0 mb-5 text-base font-semibold">
          {modal.mode === 'edit' ? 'Edit item' : 'Add item'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className={label}>
            Name
            <input type="text" required value={form.name} onChange={set('name')} className={field} />
          </label>
          <label className={label}>
            Category
            <select value={form.category} onChange={set('category')} className={field}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className={label}>
            Photo
            {(previewUrl ?? (form.imageUrl && !imageFile)) && (
              <img src={previewUrl ?? form.imageUrl} alt="preview" className="w-full max-h-40 object-cover rounded mb-1.5" />
            )}
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] ?? null)} className="text-sm text-[--muted]" />
          </label>
          {error && <p className="text-[--danger] text-sm">{error}</p>}
          <div className="flex justify-end gap-2.5 mt-2">
            <button type="button" disabled={busy} onClick={onClose} className="px-3.5 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors disabled:opacity-45 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-3.5 py-1.5 border border-[--border] rounded bg-[--text] text-[--bg] text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed">
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
