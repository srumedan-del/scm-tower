'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { DialogShell, DialogHeader, DialogCancelButton, dialogBodyClass, dialogFooterClass, dialogDangerClass } from '@/components/ui/FormDialog'
import type { TripRemovalReason } from '@/app/(app)/shipment/actions'

const REASONS: Array<{ value: TripRemovalReason; hint: string }> = [
  { value: 'Pindah Trip', hint: 'PSS akan dimuat di trip lain.' },
  { value: 'Perubahan muatan', hint: 'Muatan kendaraan diubah, PSS ditunda.' },
  { value: 'Batal kirim', hint: 'Pengiriman dibatalkan (permintaan customer atau sales).' },
]

/** Pop-up alasan saat PSS dikeluarkan dari trip. PSS kembali ke For Transport Planning dengan label alasannya. */
export function RemoveFromTripDialog({ pssNo, tripId, busy, onConfirm, onClose }: {
  pssNo: string
  tripId: string
  busy?: boolean
  onConfirm: (reason: TripRemovalReason, notes: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState<TripRemovalReason | null>(null)
  const [notes, setNotes] = useState('')

  return (
    <DialogShell onClose={onClose} size="md" guardDirty={false}>
      <DialogHeader title="Keluarkan dari trip" subtitle={`${pssNo} · ${tripId}`} icon={LogOut} />
      <div className={dialogBodyClass}>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-slate-700">Kenapa PSS ini dikeluarkan dari trip?</legend>
          {REASONS.map(option => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${reason === option.value ? 'border-gold-500 bg-gold-50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <input type="radio" name="removal-reason" value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{option.value}</span>
                <span className="block text-xs text-slate-500">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Catatan <span className="font-normal text-slate-400">(opsional)</span></span>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="inp" placeholder="Mis. pindah ke trip sore, muatan penuh" />
        </label>
        <p className="text-xs text-slate-500">PSS kembali ke <strong>For Transport Planning</strong> dengan label alasan ini. POD yang sudah ada ikut terhapus.</p>
      </div>
      <div className={dialogFooterClass}>
        <span />
        <div className="flex items-center gap-2.5">
          <DialogCancelButton onClose={onClose} />
          <button type="button" disabled={!reason || busy} onClick={() => reason && onConfirm(reason, notes)} className={`${dialogDangerClass} border border-red-200 disabled:opacity-50`}>
            {busy ? 'Memproses…' : 'Keluarkan dari Trip'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
