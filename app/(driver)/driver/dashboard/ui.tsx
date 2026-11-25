'use client'

import React, { useState, type ReactNode } from 'react'

/**
 * Komponen dasar portal driver. Warna dan ukuran disamakan dengan aplikasi
 * Android (mobile/src/theme.ts dan mobile/src/ui.tsx) agar keduanya terasa satu produk.
 */
export const driverColors = {
  midnight: '#16302A',
  navy: '#1F3B34',
  gold: '#A9813F',
  goldLight: '#E6D6B5',
  goldDark: '#7A5C2A',
  ivory: '#F6F4EF',
  border: '#E4E0D6',
  text: '#17201C',
  textSoft: '#56605B',
  success: '#2F6B44',
  successSoft: '#E8F0EA',
  warning: '#9A6C20',
  warningSoft: '#F6EEDD',
  danger: '#9D3D31',
  dangerSoft: '#F6E7E4',
}

export function Card({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const base = 'w-full text-left rounded-[14px] border border-[#E4E0D6] bg-white p-4 flex flex-col gap-1.5'
  if (!onClick) return <div className={base}>{children}</div>
  return (
    <button type="button" onClick={onClick} className={`${base} transition active:scale-[0.99] hover:border-[#A9813F] focus-visible:outline-2 focus-visible:outline-[#A9813F]`}>
      {children}
    </button>
  )
}

type Tone = 'primary' | 'outline' | 'danger'
const toneClass: Record<Tone, string> = {
  primary: 'bg-[#1F3B34] text-white',
  outline: 'bg-white text-[#1F3B34] border-[1.5px] border-[#1F3B34]',
  danger: 'bg-[#9D3D31] text-white',
}

export function Button({ label, onClick, tone = 'primary', disabled, busy, type = 'button' }: {
  label: string
  onClick?: () => void
  tone?: Tone
  disabled?: boolean
  busy?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`min-h-[52px] w-full rounded-[14px] px-4 text-base font-bold flex items-center justify-center transition active:opacity-85 disabled:opacity-50 ${toneClass[tone]}`}
    >
      {busy ? <span className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-label="Memproses" /> : label}
    </button>
  )
}

export function Field({ label, value, onChange, type = 'text', inputMode, maxLength, multiline, disabled, autoCapitalize }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password'
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  multiline?: boolean
  disabled?: boolean
  autoCapitalize?: string
}) {
  const id = React.useId()
  const className = 'w-full min-h-[52px] rounded-[10px] border border-[#E4E0D6] bg-white px-3.5 text-base text-[#17201C] outline-none focus:border-[#1F3B34] focus:ring-2 focus:ring-[#1F3B34]/15 disabled:bg-[#EFEBE2]'
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-[#17201C]">{label}</label>
      {multiline
        ? <textarea id={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} rows={3} className={`${className} py-3`} />
        : <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} inputMode={inputMode} maxLength={maxLength} disabled={disabled} autoCapitalize={autoCapitalize} autoCorrect={autoCapitalize === 'none' ? 'off' : undefined} spellCheck={autoCapitalize === 'none' ? false : undefined} autoComplete="off" className={className} />}
    </div>
  )
}

export function ChoiceRow({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold text-[#17201C]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={`min-h-[44px] rounded-[10px] border px-3.5 text-sm transition ${option === value ? 'border-[#1F3B34] bg-[#1F3B34] font-semibold text-white' : 'border-[#E4E0D6] bg-white text-[#17201C]'}`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Perkecil foto sebelum dikirim agar upload ringan di sinyal lemah. */
async function compressImage(file: File, maxSize = 1600, quality = 0.7) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

export function PhotoField({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await compressImage(file))
    } catch {
      setError('Foto tidak bisa dibaca, coba ambil ulang')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-[#17201C]">{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt={label} className="h-[200px] w-full rounded-[10px] bg-[#EFEBE2] object-cover" /> : null}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <Button label={value ? 'Ambil ulang foto' : 'Ambil foto'} tone="outline" busy={busy} onClick={() => inputRef.current?.click()} />
      {error ? <p className="text-sm text-[#9D3D31]">{error}</p> : null}
    </div>
  )
}

const pillStyle: Record<string, { className: string; label: string }> = {
  Delivered: { className: 'bg-[#E8F0EA] text-[#2F6B44]', label: 'Terkirim' },
  'Failed Delivery': { className: 'bg-[#F6E7E4] text-[#9D3D31]', label: 'Gagal kirim' },
  Closed: { className: 'bg-[#E4E0D6] text-[#56605B]', label: 'Ditutup' },
}

export function StatusPill({ status }: { status: string }) {
  const style = pillStyle[status] ?? { className: 'bg-[#F6EEDD] text-[#9A6C20]', label: 'Belum dikirim' }
  return <span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold ${style.className}`}>{style.label}</span>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p role="alert" className="text-sm text-[#9D3D31]">{children}</p>
}

export function Meta({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[#56605B]">{children}</p>
}

export function formatRupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${meters.toLocaleString('id-ID')} m` : `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`
}

export function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    )
  })
}

/** Dialog konfirmasi bergaya lembar bawah, pengganti Alert di aplikasi Android. */
export function ConfirmSheet({ title, message, confirmLabel, cancelLabel = 'Batal', tone = 'primary', onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  tone?: Tone
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#16302A]/50" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-t-3xl bg-[#F6F4EF] p-5 pb-8 flex flex-col gap-3" onClick={event => event.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-bold text-[#16302A]">{title}</h2>
        <p className="text-sm text-[#56605B]">{message}</p>
        <Button label={confirmLabel} tone={tone} onClick={onConfirm} />
        <Button label={cancelLabel} tone="outline" onClick={onCancel} />
      </div>
    </div>
  )
}
