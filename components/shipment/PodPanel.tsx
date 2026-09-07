'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  getPodByTrackingId, upsertPod, deletePod, confirmDelivery,
  type PodRow, type ShipmentTrackingRow,
} from '@/app/(app)/shipment/actions'
import { CheckCircle2, PackageCheck, Trash2 } from 'lucide-react'

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

  const [form, setForm] = useState({
    receiver_name: '',
    received_at:   nowLocal(),
    notes:         '',
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getPodByTrackingId(shipment.id).then(p => {
      if (p) {
        setPod(p)
        setForm({
          receiver_name: p.receiver_name,
          received_at:   p.received_at.slice(0, 16),
          notes:         p.notes ?? '',
        })
      }
      setPodLoading(false)
    }).catch(() => setPodLoading(false))
  }, [shipment.id])

  function del() {
    if (!pod) return
    if (!confirm('Hapus data POD ini?')) return
    startDeleting(async () => {
      try { await deletePod(pod.id); setPod(null); onSaved() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.receiver_name.trim()) { setErr('Nama penerima wajib diisi'); return }
      if (!form.received_at)         { setErr('Waktu terima wajib diisi'); return }
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

        onSaved()
        onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  const alreadyDelivered = shipment.status === 'Delivered'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-green-600" />
            <h3 className="font-bold text-lg uppercase">Proof of Delivery</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Shipment info */}
        <div className="px-4 pt-4 shrink-0">
          <div className="rounded-xl bg-gray-50 border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Shipment</span>
              <span className="font-mono text-xs font-medium text-indigo-700">
                {shipment.pss_no ?? `#${shipment.id}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Customer</span>
              <span className="text-xs font-medium">{shipment.customer_name ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Promised Date</span>
              <span className="text-xs">{shipment.promised_delivery_date?.slice(0,10) ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status Sekarang</span>
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
                <span className="text-xs text-gray-500">OTD</span>
                <span className={`text-xs font-bold ${shipment.is_on_time ? 'text-green-600' : 'text-red-600'}`}>
                  {shipment.is_on_time ? '✓ On Time' : '✗ Late'}
                </span>
              </div>
            )}
          </div>
        </div>

        {podLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Memuat data POD...</div>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto">

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
              <input
                type="datetime-local"
                value={form.received_at}
                onChange={e => up('received_at', e.target.value)}
                className="inp"
              />
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

            {/* Foto POD — placeholder untuk future upload */}
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
              <PackageCheck className="h-6 w-6 mx-auto mb-1 text-gray-300" />
              Upload foto bukti terima — tersedia setelah integrasi Supabase Storage
            </div>

            {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between border-t p-4 bg-gray-50 shrink-0">
          <div>
            {pod && (
              <button onClick={del} disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Menghapus…' : 'Hapus POD'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
            <button
              onClick={save}
              disabled={saving || podLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Menyimpan…' : pod ? 'Update POD' : 'Konfirmasi Terima'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#16a34a}`}</style>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>
      {children}
    </label>
  )
}
