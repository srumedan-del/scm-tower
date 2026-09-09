'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  createTripFromShipments,
  getTripCreationOptions,
  type ShipmentOption,
  type VendorOption,
} from './actions'

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
        window.alert(`Trip ${result.trip_no} berhasil dibuat.`)
        window.location.reload()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal membuat trip')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h2 className="text-lg font-bold">Buat Trip</h2>
            <p className="mt-1 text-xs text-gray-500">Pilih transporter dan shipment yang belum masuk trip.</p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">Tutup</button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <label className="block text-sm font-medium text-gray-700">
            Transporter
            <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="mt-1 w-full rounded-lg border border-border p-2.5 text-sm">
              <option value="">Pilih transporter</option>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Catatan trip (opsional)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border p-2.5 text-sm" />
          </label>

          <div className="overflow-x-auto rounded-xl border border-border">
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Shipment tersedia</span>
              <span className="text-xs text-gray-500">{selected.size} dipilih</span>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs text-gray-600">
                <tr><th className="px-4 py-2">Pilih</th><th className="px-4 py-2">Referensi</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Kota</th><th className="px-4 py-2">Janji Kirim</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>}
                {!loading && shipments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada shipment yang tersedia.</td></tr>}
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-indigo-50">
                    <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(shipment.id)} onChange={() => toggle(shipment.id)} /></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-indigo-700">{shipment.reference_no}</td>
                    <td className="px-4 py-2.5 text-xs">{shipment.customer_name ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs">{shipment.destination_city ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs">{shipment.promised_delivery_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Batal</button>
          <button disabled={saving || !vendorId || selected.size === 0} onClick={submit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Membuat...' : `Buat Trip (${selected.size})`}
          </button>
        </footer>
      </div>
    </div>
  )
}
