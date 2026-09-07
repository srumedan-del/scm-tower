'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  getShipmentTMSOptions, assignTrip,
  type ShipmentTrackingRow,
  type TransporterOption, type VehicleOption,
  type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'
import { Truck, CheckCircle2, Users } from 'lucide-react'

type Props = {
  shipments: ShipmentTrackingRow[]   // shipment yang sudah dipilih
  onClose:  () => void
  onSaved:  () => void
}

function generateTripId() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const rnd = Math.floor(Math.random() * 90 + 10)
  return `TRIP-${ymd}-${rnd}`
}

function nowLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function AssignTripPanel({ shipments, onClose, onSaved }: Props) {
  const [transporters, setTransporters] = useState<TransporterOption[]>([])
  const [vehicles,     setVehicles]     = useState<VehicleOption[]>([])
  const [allCrew,      setAllCrew]      = useState<DriverOption[]>([])
  const [routes,       setRoutes]       = useState<RouteOption[]>([])
  const [optLoading,   setOptLoading]   = useState(true)

  const [form, setForm] = useState({
    transporter_id: '' as string | number,
    vehicle_id:     '' as string | number,
    driver_id:      '' as string | number,
    helper_id:      '' as string | number,
    route_id:       '' as string | number,
    trip_id:        generateTripId(),
    dispatch_now:   false,
    dispatch_time:  nowLocal(),
    status:         'Dispatched' as 'Draft' | 'Dispatched',
  })

  const [saving, startSaving] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getShipmentTMSOptions().then(opts => {
      setTransporters(opts.transporters)
      setVehicles(opts.vehicles)
      setAllCrew(opts.drivers)
      setRoutes(opts.routes)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

  const selectedTransporter = transporters.find(t => t.id === Number(form.transporter_id))
  const isInternal = selectedTransporter?.type === 'Internal'

  // Auto-set status saat dispatch_now berubah
  useEffect(() => {
    up('status', form.dispatch_now ? 'Dispatched' : 'Draft')
  }, [form.dispatch_now])

  // Reset internal fields jika transporter bukan Internal
  useEffect(() => {
    if (!isInternal) {
      up('vehicle_id', '')
      up('driver_id',  '')
      up('helper_id',  '')
    }
  }, [isInternal])

  const drivers = allCrew.filter(d => d.role === 'Driver' || !d.role)
  const helpers = allCrew.filter(d => d.role === 'Helper')

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.transporter_id) { setErr('Transporter wajib dipilih'); return }
      if (isInternal && !form.driver_id) { setErr('Driver wajib dipilih untuk transporter Internal'); return }
      try {
        const count = await assignTrip(
          shipments.map(s => s.id),
          {
            transporter_id: form.transporter_id ? Number(form.transporter_id) : null,
            vehicle_id:     form.vehicle_id     ? Number(form.vehicle_id)     : null,
            driver_id:      form.driver_id      ? Number(form.driver_id)      : null,
            helper_id:      form.helper_id      ? Number(form.helper_id)      : null,
            route_id:       form.route_id       ? Number(form.route_id)       : null,
            trip_id:        form.trip_id.trim() || null,
            dispatch_time:  form.dispatch_now ? new Date(form.dispatch_time).toISOString() : null,
            status:         form.status,
          }
        )
        onSaved()
        onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-lg uppercase">Assign Trip</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Shipment list */}
        <div className="px-4 pt-4 shrink-0">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            {shipments.length} Shipment Dipilih
          </div>
          <div className="rounded-xl border bg-gray-50 divide-y max-h-40 overflow-y-auto">
            {shipments.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span className="font-mono text-indigo-700 whitespace-nowrap">
                  {s.pss_no ?? `CD-${s.crossdocking_id ?? s.id}`}
                </span>
                <span className="flex-1 truncate text-gray-600">{s.customer_name ?? '—'}</span>
                <span className="text-gray-400 whitespace-nowrap">
                  {s.promised_delivery_date?.slice(0, 10) ?? '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Trip ID yang sama akan di-assign ke semua shipment di atas (multi-drop).
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat opsi...</p>}

          {/* Trip ID */}
          <Field label="Trip ID">
            <div className="flex gap-2">
              <input
                value={form.trip_id}
                onChange={e => up('trip_id', e.target.value)}
                className="inp flex-1 font-mono"
                placeholder="TRIP-20260904-01"
              />
              <button
                type="button"
                onClick={() => up('trip_id', generateTripId())}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 text-gray-600 shrink-0"
              >
                ↺ Generate
              </button>
            </div>
          </Field>

          {/* Transporter */}
          <Field label="Transporter *">
            <select
              value={form.transporter_id}
              onChange={e => up('transporter_id', e.target.value)}
              className="inp"
              disabled={optLoading}
            >
              <option value="">-- Pilih transporter --</option>
              {transporters.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} [{t.type}{t.service_model ? ` · ${t.service_model}` : ''}]
                </option>
              ))}
            </select>
          </Field>

          {/* Rute */}
          <Field label="Rute (opsional)">
            <select
              value={form.route_id}
              onChange={e => up('route_id', e.target.value)}
              className="inp"
              disabled={optLoading}
            >
              <option value="">-- Opsional --</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.route_code} — {r.origin} → {r.destination}
                </option>
              ))}
            </select>
          </Field>

          {/* Kendaraan, Driver, Helper — hanya Internal */}
          {isInternal && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wide">
                <Users className="h-3.5 w-3.5" /> Armada Internal
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Kendaraan">
                  <select value={form.vehicle_id} onChange={e => up('vehicle_id', e.target.value)} className="inp">
                    <option value="">-- Pilih --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_no}{v.vehicle_type ? ` (${v.vehicle_type})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Driver *">
                  <select value={form.driver_id} onChange={e => up('driver_id', e.target.value)} className="inp">
                    <option value="">-- Pilih --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Helper">
                  <select value={form.helper_id} onChange={e => up('helper_id', e.target.value)} className="inp">
                    <option value="">-- Opsional --</option>
                    {helpers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Dispatch sekarang */}
          <div className="rounded-xl border p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.dispatch_now}
                onChange={e => up('dispatch_now', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Langsung Dispatch setelah assign
              </span>
              <span className="text-xs text-gray-400 ml-1">
                (status → Dispatched, isi waktu keluar gudang)
              </span>
            </label>

            {form.dispatch_now && (
              <Field label="Waktu Dispatch (keluar gudang)">
                <input
                  type="datetime-local"
                  value={form.dispatch_time}
                  onChange={e => up('dispatch_time', e.target.value)}
                  className="inp"
                />
              </Field>
            )}

            {!form.dispatch_now && (
              <div className="text-xs text-gray-400">
                Status akan tetap <strong>Draft</strong> — dispatch bisa dilakukan nanti via edit shipment.
              </div>
            )}
          </div>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 bg-gray-50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
          <button
            onClick={save}
            disabled={saving || optLoading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            <Truck className="h-4 w-4" />
            {saving
              ? 'Menyimpan…'
              : `Assign ${shipments.length} Shipment${form.dispatch_now ? ' & Dispatch' : ''}`}
          </button>
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
