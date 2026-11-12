'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogCancelClass, dialogPrimaryClass } from '@/components/ui/FormDialog'
import { Truck } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import {
  createTripFromShipments,
  getTripCreationOptions,
  type ShipmentOption,
  type VendorOption,
} from './actions'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { showSuccess } from '@/lib/feedback'
import { SkeletonRows } from '@/components/ui/LoadingStates'

type Props = { onClose: () => void }

export function TripCreatePanel({ onClose }: Props) {
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [shipments, setShipments] = useState<ShipmentOption[]>([])
  const [vendorId, setVendorId] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, startLoad] = useTransition()
  const [saving, startSave] = useTransition()

  useEffect(() => {
    startLoad(async () => {
      try {
        const options = await getTripCreationOptions()
        setVendors(options.vendors)
        setShipments(options.shipments)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal memuat data')
      }
    })
  }, [])

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function submit() {
    setError('')
    startSave(async () => {
      try {
        const result = await createTripFromShipments({
          vendorId: Number(vendorId),
          shipmentIds: [...selected],
          notes,
        })
        onClose()
        void showSuccess({ title: 'Trip berhasil dibuat', details: [{ label: 'Nomor trip', value: result.trip_no }] }).then(() => window.location.reload())
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal membuat trip')
      }
    })
  }

  return (
    <DialogShell onClose={onClose} size="3xl">
      <DialogHeader title="Buat Trip" subtitle="Pilih transporter dan shipment yang belum masuk trip." icon={Truck} />

        <div className={dialogBodyClass}>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <label className="block text-sm font-medium text-gray-700">
            Transporter
            <div className="mt-1">
              <SearchableSelect value={vendorId} onChange={setVendorId} placeholder="Pilih transporter" options={vendors.map(vendor => ({ value: vendor.id, label: vendor.vendor_name }))} />
            </div>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Catatan trip (opsional)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="inp mt-1" />
          </label>

          <div className="overflow-x-auto rounded-xl border border-border">
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Shipment tersedia</span>
              <span className="text-xs text-gray-500">{selected.size} dipilih</span>
            </div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-slate-50">
                <tr><th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">Pilih</th><th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">Referensi</th><th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">Customer</th><th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">Kota</th><th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">Janji Kirim</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <SkeletonRows cols={5} />}
                {!loading && shipments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada shipment yang tersedia.</td></tr>}
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="group border-t border-gray-100 hover:bg-indigo-50">
                    <td className="px-4 py-0.25 text-xs font-medium text-slate-600"><input type="checkbox" checked={selected.has(shipment.id)} onChange={() => toggle(shipment.id)} /></td>
                    <td className="px-4 py-0.25 text-xs font-medium font-medium text-slate-600">{shipment.reference_no}</td>
                    <td className="px-4 py-0.25 text-xs font-medium text-slate-600">{shipment.customer_name ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs font-medium text-slate-600">{shipment.destination_city ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs font-medium text-slate-600">{shipment.promised_delivery_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button disabled={saving || !vendorId || selected.size === 0} onClick={submit} className={dialogPrimaryClass} data-busy={saving}>
            {saving ? 'Membuat...' : `Buat Trip (${selected.size})`}
          </button>
        </footer>
    </DialogShell>
  )
}
