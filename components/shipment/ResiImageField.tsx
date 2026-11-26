'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ImagePlus, Trash2, ExternalLink } from 'lucide-react'
import { getResiImageUrl, uploadResiImage, removeResiImage } from '@/app/(app)/shipment/resi-actions'

// Foto resi dari HP bisa > 5 MB; kecilkan ke sisi terpanjang 1600 px (masih terbaca jelas saat dicetak).
async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Browser tidak mendukung kompresi gambar')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/** Satu gambar resi per PSS; langsung tersimpan saat dipilih, tidak menunggu tombol Simpan. */
export function ResiImageField({ trackingId }: { trackingId: number | null | undefined }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(trackingId))
  const [error, setError] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!trackingId) return
    let cancelled = false
    getResiImageUrl(trackingId)
      .then(next => { if (!cancelled) setUrl(next) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [trackingId])

  if (!trackingId) {
    return <p className="text-xs text-slate-500">Simpan shipment terlebih dahulu, lalu buka lagi untuk melampirkan gambar resi.</p>
  }

  function onPick(file: File | undefined) {
    if (!file || !trackingId) return
    setError(null)
    startBusy(async () => {
      try {
        const dataUrl = await compressImage(file)
        setUrl(await uploadResiImage(trackingId, dataUrl))
      } catch (e: any) {
        setError(e?.message ?? 'Gagal mengunggah gambar')
      } finally {
        if (inputRef.current) inputRef.current.value = ''
      }
    })
  }

  function onRemove() {
    if (!trackingId || !window.confirm('Hapus gambar resi ini?')) return
    setError(null)
    startBusy(async () => {
      try {
        await removeResiImage(trackingId)
        setUrl(null)
      } catch (e: any) {
        setError(e?.message ?? 'Gagal menghapus gambar')
      }
    })
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => onPick(e.target.files?.[0])} />
      {loading ? (
        <div className="h-24 w-full animate-pulse rounded-lg bg-slate-100" />
      ) : url ? (
        <div className="flex items-start gap-3">
          <a href={url} target="_blank" rel="noreferrer" className="block shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Gambar resi" className="h-32 w-auto max-w-[220px] object-contain" />
          </a>
          <div className="flex flex-col gap-1.5 text-xs">
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Lihat ukuran penuh
            </a>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline disabled:opacity-50">
              <ImagePlus className="h-3.5 w-3.5" /> Ganti gambar
            </button>
            <button type="button" disabled={busy} onClick={onRemove} className="inline-flex items-center gap-1 font-semibold text-red-700 hover:underline disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" /> {busy ? 'Mengunggah…' : 'Unggah gambar resi'}
        </button>
      )}
      {busy && url && <p className="text-xs text-slate-500">Memproses…</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
