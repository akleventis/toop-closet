import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { uploadImage, resizeImage } from '../api'
import type { ModalState, SavePayload, ClothingItem } from '../types'
import { getImages } from '../types'

type ImageSlot =
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File; preview: string }

type FormState = {
  id?: string
  name: string
  category: string
  notes: string
}

const field = 'w-full px-2 py-1.5 border border-[--border] rounded text-xs bg-[--bg] text-[--text] focus:outline-none focus:ring-1 focus:ring-[--text]'
const label = 'flex flex-col gap-1 text-xs font-medium text-[--muted]'

type Props = {
  modal: ModalState
  onSave: (item: SavePayload, bgFiles?: (File | null)[]) => Promise<void>
  onClose: () => void
  token: string
  slug: string
  categories: string[]
}

function initImages(modal: ModalState): ImageSlot[] {
  if (modal.mode !== 'edit') return []
  return getImages(modal.item as ClothingItem).map(url => ({ kind: 'url', url }))
}

export default function ItemModal({ modal, onSave, onClose, token, slug, categories }: Props) {
  const initial: FormState = modal.mode === 'edit'
    ? { id: modal.item.id, name: modal.item.name, category: modal.item.category, notes: modal.item.notes ?? '' }
    : { name: '', category: categories[0] ?? '', notes: '' }
  const [form, setForm] = useState<FormState>(initial)
  const [images, setImages] = useState<ImageSlot[]>(() => initImages(modal))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removeBg, setRemoveBg] = useState(() => localStorage.getItem('removeBg') !== 'false')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      images.forEach(slot => { if (slot.kind === 'file') URL.revokeObjectURL(slot.preview) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (f: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }))

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const remaining = 4 - images.length
    const toAdd = files.slice(0, remaining)
    setImages(prev => [
      ...prev,
      ...toAdd.map(file => ({ kind: 'file' as const, file, preview: URL.createObjectURL(file) })),
    ])
    e.target.value = ''
  }

  const removeImage = (i: number) => {
    setImages(prev => {
      const slot = prev[i]
      if (slot.kind === 'file') URL.revokeObjectURL(slot.preview)
      return prev.filter((_, j) => j !== i)
    })
  }

  const shiftLeft = (i: number) => {
    if (i === 0) return
    setImages(prev => { const a = [...prev]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a })
  }

  const shiftRight = (i: number) => {
    setImages(prev => {
      if (i >= prev.length - 1) return prev
      const a = [...prev]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const uploadedUrls: string[] = []
      const bgFiles: (File | null)[] = []
      for (const slot of images) {
        if (slot.kind === 'url') {
          uploadedUrls.push(slot.url)
          bgFiles.push(null)
        } else {
          const resized = await resizeImage(slot.file)
          const url = await uploadImage(resized, slug, token)
          uploadedUrls.push(url)
          bgFiles.push(removeBg ? resized : null)
        }
      }
      const imageUrl = uploadedUrls[0] ?? ''
      const hasBgWork = bgFiles.some(f => f !== null)
      await onSave(
        { ...form, imageUrl, imageUrls: uploadedUrls },
        hasBgWork ? bgFiles : undefined,
      )
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
        className="bg-[--bg] border border-[--border] rounded-lg p-5 w-full max-w-[420px] max-h-[90svh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="m-0 mb-3 text-sm font-semibold">
          {modal.mode === 'edit' ? 'Edit item' : 'Add item'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <label className={label}>
            Name
            <input type="text" required value={form.name} onChange={set('name')} className={field} />
          </label>
          <label className={label}>
            Tag
            <select value={form.category} onChange={set('category')} className={field}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[--muted]">Photos</span>
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((slot, i) => {
                  const src = slot.kind === 'url' ? slot.url : slot.preview
                  return (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="w-16 h-16 object-cover rounded border border-[--border]" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center"
                      >
                        <span className="w-4 h-4 bg-[--text] text-[--bg] rounded-full text-[10px] flex items-center justify-center leading-none">×</span>
                      </button>
                      {images.length > 1 && (
                        <div className="flex gap-0.5 mt-1">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => shiftLeft(i)}
                            className="flex-1 h-8 border border-[--border] rounded text-xs disabled:opacity-25 hover:bg-[--bg-subtle] transition-colors"
                          >←</button>
                          <button
                            type="button"
                            disabled={i === images.length - 1}
                            onClick={() => shiftRight(i)}
                            className="flex-1 h-8 border border-[--border] rounded text-xs disabled:opacity-25 hover:bg-[--bg-subtle] transition-colors"
                          >→</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {images.length < 4 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="self-start px-2.5 py-1 border border-dashed border-[--border] rounded text-xs text-[--muted] hover:bg-[--bg-subtle] transition-colors"
              >
                + Add photo{images.length === 0 ? '' : ' (' + (4 - images.length) + ' left)'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
              className="hidden"
            />
          </div>

          <label className={label}>
            Notes
            <div className="relative">
              <input
                type="text"
                maxLength={50}
                value={form.notes}
                onChange={set('notes')}
                placeholder="optional"
                className={field}
              />
              {form.notes.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[--muted]">
                  {50 - form.notes.length}
                </span>
              )}
            </div>
          </label>
          <label className="flex items-center gap-2 text-xs text-[--muted] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={e => {
                setRemoveBg(e.target.checked)
                localStorage.setItem('removeBg', String(e.target.checked))
              }}
              className="cursor-pointer"
            />
            Remove background
          </label>
          {error && <p className="text-[--danger] text-xs">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" disabled={busy} onClick={onClose} className="px-3 py-1 border border-[--border] rounded text-xs font-medium hover:bg-[--bg-subtle] transition-colors disabled:opacity-45 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-3 py-1 border border-[--border] rounded bg-[--text] text-[--bg] text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed">
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
