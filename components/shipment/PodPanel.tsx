'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { useState, useTransition, useEffect } from 'react'
import {
  getPodByTrackingId, getPodImageUrls, upsertPod, deletePod, confirmDelivery,
  type PodRow, type ShipmentTrackingRow,
} from '@/app/(app)/shipment/actions'
import { CheckCircle2, PackageCheck, Trash2 } from 'lucide-react'
import { confirmAction, showSuccess } from '@/lib/feedback'

type Props = {
  shipment: ShipmentTrackingRow
  onClose: () => void
  onSaved: () => void
}

function nowLocal() {
  // datetime-local format: "YYYY-MM-DDTHH:mm"
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function PodPanel({ shipment, onClose, onSaved }: Props) {
  const [pod,        setPod]        = useState<PodRow | null>(null)
  const [podLoading, setPodLoading] = useState(true)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    receiver_name: '',
    received_at:   nowLocal(),
    notes:         '',
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const receivedDate = form.received_at.slice(0, 10)
  const receivedClock = form.received_at.slice(11, 16)

  function updateReceivedDate(date: string) {
    up('received_at', `${date}T${receivedClock}`)
  }

  function updateReceivedClock(clock: string) {
    up('received_at', `${receivedDate}T${clock}`)
  }

  useEffect(() => {
    getPodByTrackingId(shipment.id).then(p => {
      if (p) {
        setPod(p)
        getPodImageUrls(p).then(setImageUrls).catch(() => setImageUrls({}))
        setForm({
          receiver_name: p.receiver_name,
          received_at:   p.received_at.slice(0, 16),
          notes:         p.notes ?? '',
        })
      }
      setPodLoading(false)
    }).catch(() => setPodLoading(false))
  }, [shipment.id])

  async function del() {
    if (!pod) return
    if (!(await confirmAction({ title: 'Hapus POD?', message: 'Data POD shipment ini akan dihapus. Status shipment tidak berubah.' }))) return
    startDeleting(async () => {
      try { await deletePod(pod.id); setPod(null); await showSuccess({ title: 'POD dihapus' }); onSaved() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.receiver_name.trim()) { setErr('Nama penerima wajib diisi'); return }
      if (!form.received_at)         { setErr('Waktu terima wajib diisi'); return }
      if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(form.received_at)) {
        setErr('Tanggal dan jam terima harus diisi dengan format yang benar')
        return
      }
      try {
        const receivedAtISO = new Date(form.received_at).toISOString()

        await upsertPod({
          id:            pod?.id,
          tracking_id:   shipment.id,
          receiver_name: form.receiver_name.trim(),
          received_at:   receivedAtISO,
          notes:         form.notes.trim() || null,
          photo_url:     pod?.photo_url ?? null,
          signature_url: pod?.signature_url ?? null,
          input_by:      null,
        })

        // Jika shipment belum Delivered, otomatis update ke Delivered
        if (shipment.status !== 'Delivered') {
          await confirmDelivery(shipment.id, receivedAtISO)
        }

        onClose(); void showSuccess({ title: 'POD tersimpan' }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  const alreadyDelivered = shipment.status === 'Delivered'

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title="Proof of Delivery" subtitle="Konfirmasi penerimaan barang" icon={PackageCheck} />

        {/* Shipment info */}
        <div className="shrink-0 px-6 pt-5">
          <div className="rounded-xl bg-gray-50 border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Shipment</span>
              <span className="font-mono text-sm font-semibold text-slate-800 text-indigo-700">
                {shipment.pss_no ?? `#${shipment.id}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Customer</span>
              <span className="text-sm font-semibold text-slate-800">{shipment.customer_name ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Promised Date</span>
              <span className="text-xs">{shipment.promised_delivery_date?.slice(0,10) ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Status Sekarang</span>
              <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                alreadyDelivered
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {shipment.status}
              </span>
            </div>
            {shipment.is_on_time !== null && alreadyDelivered && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">OTD</span>
                <span className={`text-xs font-bold ${shipment.is_on_time ? 'text-green-600' : 'text-red-600'}`}>
                  {shipment.is_on_time ? '✓ On Time' : '✗ Late'}
                </span>
              </div>
            )}
          </div>
        </div>

        {podLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-gray-400">Memuat data POD...</div>
        ) : (
          <div className={dialogBodyClass}>

            {/* Sudah ada POD sebelumnya */}
            {pod && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <div className="text-xs text-green-700">
                  POD sudah tercatat — diterima oleh <strong>{pod.receiver_name}</strong> pada{' '}
                  {new Date(pod.received_at).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}. Edit di bawah jika perlu koreksi.
                </div>
              </div>
            )}

            {!alreadyDelivered && !pod && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                <strong>Menyimpan POD ini akan otomatis mengubah status shipment → Delivered</strong>{' '}
                dan mengisi waktu delivery sesuai waktu terima yang diinput.
              </div>
            )}

            {/* Form */}
            <Field label="Nama Penerima *">
              <input
                value={form.receiver_name}
                onChange={e => up('receiver_name', e.target.value)}
                className="inp"
                placeholder="Nama staff / petugas yang menerima barang"
                autoFocus
              />
            </Field>

            <Field label="Waktu Diterima *">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  type="date"
                  value={receivedDate}
                  onChange={e => updateReceivedDate(e.target.value)}
                  className="inp"
                  aria-label="Tanggal diterima"
                />
                <input
                  type="text"
                  value={receivedClock}
                  onChange={e => updateReceivedClock(e.target.value)}
                  placeholder="HH:MM"
                  inputMode="numeric"
                  maxLength={5}
                  className="inp"
                  aria-label="Jam diterima, dapat diketik manual"
                  title="Ketik jam secara manual, contoh 15:25"
                />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">Jam dapat diketik manual, contoh: 15:25</p>
            </Field>

            <Field label="Catatan (opsional)">
              <textarea
                value={form.notes}
                onChange={e => up('notes', e.target.value)}
                className="inp"
                rows={3}
                placeholder="Kondisi barang, catatan penerima, dll."
              />
            </Field>

            {(pod?.photo_url || pod?.signature_url) && (
              <div className="grid grid-cols-2 gap-3">
                {[['Foto bukti terima', pod.photo_url], ['Tanda tangan', pod.signature_url]].map(([label, path]) => path && (
                  <div key={label}>
                    <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
                    {imageUrls[path] ? (
                      <a href={imageUrls[path]} target="_blank" rel="noreferrer">
                        <img src={imageUrls[path]} alt={label ?? ''} className="h-40 w-full rounded-lg border object-cover" />
                      </a>
                    ) : (
                      <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">Foto belum bisa ditampilkan</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
          </div>
        )}

        {/* Footer */}
        <div className={dialogFooterClass}>
          <div>
            {pod && (
              <button onClick={del} disabled={deleting}
                className={dialogDangerClass}>
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Menghapus…' : 'Hapus POD'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button
              onClick={save}
              disabled={saving || podLoading}
              className={dialogPrimaryClass}
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Menyimpan…' : pod ? 'Update POD' : 'Konfirmasi Terima'}
            </button>
          </div>
        </div>

    </DialogShell>
  )
}
