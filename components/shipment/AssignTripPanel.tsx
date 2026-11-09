'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, FormField as Field } from '@/components/ui/FormDialog'
import { showSuccess } from '@/lib/feedback'
import { useState, useTransition, useEffect } from 'react'
import {
  getShipmentTMSOptions, assignTrip,
  type ShipmentTrackingRow,
  type TransporterOption, type VehicleOption,
  type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'
import { Truck, CheckCircle2, Users } from 'lucide-react'
import SearchableSelect from '@/components/ui/SearchableSelect'

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
        onClose(); void showSuccess({ title: 'Trip berhasil ditugaskan', message: `${shipments.length} shipment` }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title="Assign Trip" subtitle={`${shipments.length} shipment dipilih`} icon={Truck} />

        {/* Shipment list */}
        <div className="shrink-0 px-6 pt-5">
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

        <div className={dialogBodyClass}>
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
            <SearchableSelect value={form.transporter_id} onChange={value => up('transporter_id', value)} placeholder="-- Pilih transporter --" options={transporters.map(t => ({ value: t.id, label: `${t.name}${t.service_model ? ` · ${t.service_model}` : ''}` }))} disabled={optLoading} />
          </Field>

          {/* Rute */}
          <Field label="Rute (opsional)">
            <SearchableSelect value={form.route_id} onChange={value => up('route_id', value)} placeholder="-- Opsional --" options={routes.map(r => ({ value: r.id, label: `${r.route_code} — ${r.origin} → ${r.destination}` }))} disabled={optLoading} />
          </Field>

          {/* Kendaraan, Driver, Helper — hanya Internal */}
          {isInternal && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wide">
                <Users className="h-3.5 w-3.5" /> Armada Internal
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Kendaraan">
                  <SearchableSelect value={form.vehicle_id} onChange={value => up('vehicle_id', value)} placeholder="-- Pilih --" options={vehicles.map(v => ({ value: v.id, label: `${v.vehicle_no}${v.vehicle_type ? ` (${v.vehicle_type})` : ''}` }))} />
                </Field>
                <Field label="Driver *">
                  <SearchableSelect value={form.driver_id} onChange={value => up('driver_id', value)} placeholder="-- Pilih --" options={drivers.map(d => ({ value: d.id, label: d.driver_name }))} />
                </Field>
                <Field label="Helper">
                  <SearchableSelect value={form.helper_id} onChange={value => up('helper_id', value)} placeholder="-- Opsional --" options={helpers.map(d => ({ value: d.id, label: d.driver_name }))} />
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
        <div className={dialogFooterClass}>
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button
            onClick={save}
            disabled={saving || optLoading}
            className={dialogPrimaryClass}
          >
            <Truck className="h-4 w-4" />
            {saving
              ? 'Menyimpan…'
              : `Assign ${shipments.length} Shipment${form.dispatch_now ? ' & Dispatch' : ''}`}
          </button>
        </div>

    </DialogShell>
  )
}
