'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, Loader2 } from 'lucide-react'
import { DialogShell, DialogHeader } from '@/components/ui/FormDialog'
import { notify, showSuccess } from '@/lib/feedback'
import { adminFinishTrip } from '@/app/(app)/trips/actions'

type Props = {
  tripNo: string
  odometerStart?: number | null
  onDone?: () => void
  compact?: boolean
}

/** Tombol End Trip untuk admin bila driver lupa menutup trip. */
export function AdminEndTripButton({ tripNo, odometerStart, onDone, compact }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [km, setKm] = useState('')
  const [reason, setReason] = useState('Driver lupa end trip')
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function submit() {
    const digits = km.replace(/\D/g, '')
    const odometerEnd = digits ? Number(digits) : null
    if (odometerEnd != null && odometerStart != null && odometerEnd < odometerStart) {
      setError(`KM akhir lebih kecil dari KM awal (${odometerStart.toLocaleString('id-ID')})`)
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await adminFinishTrip(tripNo, odometerEnd, reason)
        setOpen(false)
        void showSuccess({ title: 'Trip ditutup', message: tripNo })
        onDone?.()
        router.refresh()
      } catch (err: any) {
        setError(err?.message ?? 'Gagal menutup trip')
        notify.error('Gagal menutup trip', err?.message)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null) }}
        className={compact
          ? 'inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50'
          : 'mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50'}
      >
        <Flag className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        End Trip
      </button>

      {open && (
        <DialogShell onClose={() => !busy && setOpen(false)} size="md">
          <DialogHeader title={`End trip ${tripNo}`} icon={Flag} subtitle="Untuk driver yang lupa menutup trip. Semua pengiriman harus sudah selesai." />
          <div className="space-y-4 p-5">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">KM akhir <span className="font-normal text-slate-400">(opsional)</span></span>
              <input
                value={km}
                inputMode="numeric"
                onChange={e => { const d = e.target.value.replace(/\D/g, ''); setKm(d ? Number(d).toLocaleString('id-ID') : '') }}
                className="inp font-mono"
                placeholder={odometerStart != null ? `KM awal ${odometerStart.toLocaleString('id-ID')}` : 'Isi bila diketahui'}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Alasan</span>
              <input value={reason} onChange={e => setReason(e.target.value)} className="inp" />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                End Trip
              </button>
            </div>
          </div>
        </DialogShell>
      )}
    </>
  )
}
