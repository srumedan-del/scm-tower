'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ImagePlus, Trash2, ExternalLink, ScanSearch, CheckCircle2, XCircle } from 'lucide-react'
import { checkResiText, readResiImage, type ResiCheck } from '@/lib/resi-ocr'
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
export function ResiImageField({ trackingId, noResi, amount }: { trackingId: number | null | undefined; noResi?: string | null; amount?: number | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(trackingId))
  const [error, setError] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const [check, setCheck] = useState<ResiCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  // Cocokkan isi gambar dengan nomor resi dan biaya yang diinput; hanya peringatan, tidak memblokir simpan.
  async function runCheck(source: string) {
    setChecking(true)
    setCheck(null)
    setCheckError(null)
    try {
      setCheck(checkResiText(await readResiImage(source), noResi, amount))
    } catch {
      setCheckError('Gambar tidak dapat dibaca otomatis. Periksa nomor resi dan nilai secara manual.')
    } finally {
      setChecking(false)
    }
  }

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
        setUrl(await uploadResiImage(trackingId, dataUrl, noResi))
        void runCheck(dataUrl)
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
        setCheck(null)
        setCheckError(null)
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
            <button type="button" disabled={busy || checking} onClick={() => url && runCheck(url)} className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline disabled:opacity-50">
              <ScanSearch className="h-3.5 w-3.5" /> Periksa ulang
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
      {checking && <p className="text-xs text-slate-500">Memeriksa nomor resi dan nilai di gambar…</p>}
      {checkError && <p className="text-xs text-amber-700">{checkError}</p>}
      {check && <ResiCheckResult check={check} noResi={noResi} amount={amount} />}
    </div>
  )
}

const rp = (value: number) => `Rp ${value.toLocaleString('id-ID')}`

function CheckLine({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : XCircle
  const tone = ok === null ? 'text-slate-500' : ok ? 'text-green-700' : 'text-red-700'
  return (
    <div className={`flex items-start gap-1.5 ${tone}`}>
      {ok === null ? <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-slate-400" /> : <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

function ResiCheckResult({ check, noResi, amount }: { check: ResiCheck; noResi?: string | null; amount?: number | null }) {
  const allOk = check.resiMatch !== false && check.amountMatch !== false
  return (
    <div className={`space-y-1 rounded-lg border px-3 py-2 text-xs ${allOk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <p className="font-semibold text-slate-800">Pemeriksaan gambar resi</p>
      <CheckLine ok={check.resiMatch}>
        {check.resiMatch === null
          ? 'Nomor resi di form belum diisi.'
          : check.resiMatch
            ? `Nomor resi ${noResi} cocok dengan gambar.`
            : `Nomor resi ${noResi} tidak ditemukan di gambar${check.resiCandidates.length ? ` (terbaca: ${check.resiCandidates.join(', ')})` : ''}.`}
      </CheckLine>
      <CheckLine ok={check.amountMatch}>
        {check.amountMatch === null
          ? 'Biaya kirim di form belum diisi.'
          : check.amountMatch
            ? `Nilai ${rp(Number(amount))} cocok dengan gambar.`
            : `Nilai ${rp(Number(amount))} tidak ditemukan di gambar${check.amountsFound.length ? ` (terbaca: ${check.amountsFound.map(rp).join(', ')})` : ''}.`}
      </CheckLine>
      {!allOk && <p className="text-slate-600">Periksa kembali input atau gambarnya. Pembacaan otomatis bisa keliru bila foto buram atau miring.</p>}
    </div>
  )
}
