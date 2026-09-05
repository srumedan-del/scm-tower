'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  upsertShipmentTracking, deleteShipmentTracking,
  getShipmentTMSOptions,
  type ShipmentTrackingRow,
  type TransporterOption, type VehicleOption,
  type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'

const STATUS_OPTS = ['Draft', 'Dispatched', 'In Transit', 'Delivered'] as const

type Props = {
  shipment: ShipmentTrackingRow | null  // null = tambah baru
  onClose: () => void
  onSaved: () => void
}

export default function ShipmentTMSPanel({ shipment, onClose, onSaved }: Props) {
  const [transporters, setTransporters] = useState<TransporterOption[]>([])
  const [vehicles,     setVehicles]     = useState<VehicleOption[]>([])
  const [drivers,      setDrivers]      = useState<DriverOption[]>([])
  const [routes,       setRoutes]       = useState<RouteOption[]>([])
  const [pssOptions,   setPssOptions]   = useState<any[]>([])
  const [optLoading,   setOptLoading]   = useState(true)

  const [form, setForm] = useState<Partial<ShipmentTrackingRow>>(() => shipment ?? {
    source_type: 'PSS', status: 'Draft', cost_model: null,
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: keyof ShipmentTrackingRow, v: any) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getShipmentTMSOptions().then(opts => {
      setTransporters(opts.transporters)
      setVehicles(opts.vehicles)
      setDrivers(opts.drivers)
      setRoutes(opts.routes)
      setPssOptions(opts.pssOptions)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

  // Saat transporter berubah, auto-set cost_model
  useEffect(() => {
    if (!form.transporter_id) return
    const t = transporters.find(t => t.id === form.transporter_id)
    if (t) {
      up('cost_model', t.type === 'Internal' ? 'Internal' : (t.service_model as any ?? null))
    }
  }, [form.transporter_id, transporters])

  // Saat PSS dipilih, auto-fill fields dari outbound_header
  function onPssChange(pssNo: string) {
    up('pss_no', pssNo)
    const pss = pssOptions.find((p: any) => p.pss_no === pssNo)
    if (pss) {
      setForm(f => ({
        ...f,
        pss_no: pssNo,
        outbound_header_id: pss.id,
        customer_name: pss.customer_name,
        destination_city: pss.destination_city ?? pss.ship_to_city,
        promised_delivery_date: pss.promised_delivery_date,
        document_date: pss.document_date,
      }))
    }
  }

  const selectedTransporter = transporters.find(t => t.id === form.transporter_id)
  const isInternal = selectedTransporter?.type === 'Internal'

  function del() {
    if (!shipment) return
    if (!confirm('Hapus shipment ini?')) return
    startDeleting(async () => {
      try { await deleteShipmentTracking(shipment.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.status) { setErr('Status wajib diisi'); return }
      try {
        await upsertShipmentTracking({ ...form, id: shipment?.id })
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <h3 className="font-bold text-lg uppercase">
            {shipment ? 'Edit Shipment TMS' : 'Tambah Shipment TMS'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat opsi...</p>}

          {/* ── Source type ── */}
          <section>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sumber Shipment</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipe Sumber">
                <select value={form.source_type ?? 'PSS'} onChange={e => up('source_type', e.target.value)} className="inp">
                  <option value="PSS">PSS (dari NAV)</option>
                  <option value="Crossdocking">Crossdocking (manual)</option>
                </select>
              </Field>
              {form.source_type === 'PSS' && (
                <Field label="PSS No.">
                  <select value={form.pss_no ?? ''} onChange={e => onPssChange(e.target.value)} className="inp">
                    <option value="">-- Pilih PSS --</option>
                    {pssOptions.map((p: any) => (
                      <option key={p.pss_no} value={p.pss_no}>
                        {p.pss_no} — {p.customer_name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {form.source_type === 'Crossdocking' && (
                <Field label="Crossdocking ID">
                  <input type="number" value={form.crossdocking_id ?? ''} onChange={e => up('crossdocking_id', e.target.value ? Number(e.target.value) : null)} className="inp" />
                </Field>
              )}
            </div>
          </section>

          {/* ── Customer & tujuan ── */}
          <section>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Customer & Tujuan</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer Name">
                <input value={form.customer_name ?? ''} onChange={e => up('customer_name', e.target.value)} className="inp" />
              </Field>
              <Field label="Kota Tujuan">
                <input value={form.destination_city ?? ''} onChange={e => up('destination_city', e.target.value)} className="inp" />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Document Date">
                <input type="date" value={form.document_date?.slice(0,10) ?? ''} onChange={e => up('document_date', e.target.value || null)} className="inp" />
              </Field>
              <Field label="Promised Delivery Date">
                <input type="date" value={form.promised_delivery_date?.slice(0,10) ?? ''} onChange={e => up('promised_delivery_date', e.target.value || null)} className="inp" />
              </Field>
            </div>
          </section>

          {/* ── Transporter & armada ── */}
          <section>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Transporter & Armada</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Transporter">
                <select value={form.transporter_id ?? ''} onChange={e => up('transporter_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                  <option value="">-- Pilih transporter --</option>
                  {transporters.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} [{t.type}{t.service_model ? ` · ${t.service_model}` : ''}]
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rute">
                <select value={form.route_id ?? ''} onChange={e => up('route_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                  <option value="">-- Pilih rute (opsional) --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.route_code} — {r.origin} → {r.destination}</option>
                  ))}
                </select>
              </Field>
            </div>
            {isInternal && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Kendaraan (Internal)">
                  <select value={form.vehicle_id ?? ''} onChange={e => up('vehicle_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                    <option value="">-- Pilih kendaraan --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_no} {v.vehicle_type ? `(${v.vehicle_type})` : ''}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Driver (Internal)">
                  <select value={form.driver_id ?? ''} onChange={e => up('driver_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                    <option value="">-- Pilih driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <div className="mt-3">
              <Field label="Trip ID (multi-drop, opsional)">
                <input value={form.trip_id ?? ''} onChange={e => up('trip_id', e.target.value || null)} className="inp" placeholder="TRIP-20260904-01" />
              </Field>
            </div>
          </section>

          {/* ── Status & timeline ── */}
          <section>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Status & Timeline</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Status *">
                <select value={form.status ?? 'Draft'} onChange={e => up('status', e.target.value)} className="inp">
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Waktu Dispatch">
                <input type="datetime-local" value={form.dispatch_time?.slice(0,16) ?? ''} onChange={e => up('dispatch_time', e.target.value ? new Date(e.target.value).toISOString() : null)} className="inp" />
              </Field>
              <Field label="Waktu Delivered">
                <input type="datetime-local" value={form.delivery_time?.slice(0,16) ?? ''} onChange={e => up('delivery_time', e.target.value ? new Date(e.target.value).toISOString() : null)} className="inp" />
              </Field>
            </div>
          </section>

          {/* ── Biaya ── */}
          <section>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Biaya</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Model Biaya">
                <select value={form.cost_model ?? ''} onChange={e => up('cost_model', e.target.value || null)} className="inp" disabled={!!selectedTransporter}>
                  <option value="">-</option>
                  <option value="Internal">Internal (operasional aktual)</option>
                  <option value="Retail">Retail (per kg/tujuan)</option>
                  <option value="Trucking">Trucking (per trip/FTL)</option>
                </select>
              </Field>
              <Field label="Berat (kg)">
                <input type="number" min={0} value={form.weight_kg ?? ''} onChange={e => up('weight_kg', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
              </Field>
              <Field label="Biaya Trip (Rp)">
                <input type="number" min={0} value={form.trip_cost ?? ''} onChange={e => up('trip_cost', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
              </Field>
            </div>
          </section>

          <Field label="Catatan">
            <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} className="inp" rows={2} />
          </Field>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 bg-gray-50 shrink-0">
          <div>
            {shipment && (
              <button onClick={del} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}.inp:disabled{background:#f9fafb;color:#9ca3af}`}</style>
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
