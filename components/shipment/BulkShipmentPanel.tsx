'use client'
import { useState, useTransition, useEffect } from 'react'
import {
  bulkCreateShipments, generateTripId, getShipmentTMSOptions,
  type UntrackedPssRow, type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'
import { getVendors, type VendorRow } from '@/app/(app)/vendor/actions'
import { Truck, Users, Route, AlertCircle } from 'lucide-react'

type Props = {
  selectedPss: UntrackedPssRow[]
  onClose: () => void
  onSaved: () => void
}

async function genTripId(): Promise<string> {
  return generateTripId()
}

const VEHICLE_TYPES = ['CDD', 'CDE', 'Fuso', 'Tronton', 'Box', 'Pickup', 'L300', 'Engkel', 'Lainnya']

export default function BulkShipmentPanel({ selectedPss, onClose, onSaved }: Props) {
  const [vendors,    setVendors]    = useState<VendorRow[]>([])
  const [allCrew,    setAllCrew]    = useState<DriverOption[]>([])
  const [routes,     setRoutes]     = useState<RouteOption[]>([])
  const [optLoading, setOptLoading] = useState(true)
	const [routeQuery, setRouteQuery] = useState('')

  const [form, setForm] = useState({
    // Vendor
    vendor_id:       null as number | null,
    vendor_name:     '' as string,
    // Kendaraan (manual untuk eksternal)
    vehicle_nopol:   '',
    vehicle_type:    '',
    // Driver (manual untuk eksternal)
    driver_name_ext: '',
    // Rute & trip
    route_id:        null as number | null,
    trip_id:         '',          // di-fill async di useEffect
    cost_model:      'Trucking' as 'Internal' | 'Retail' | 'Trucking' | null,
    // Status
    status:          'Draft' as 'Draft' | 'Dispatched',
    dispatch_time:   new Date().toISOString().slice(0, 16),
  })

  const [saving, startSaving] = useTransition()
  const [err, setErr]         = useState<string | null>(null)
  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const dispatchDate = form.dispatch_time.slice(0, 10)
  const dispatchClock = form.dispatch_time.slice(11, 16)

  function updateDispatchDate(date: string) {
    up('dispatch_time', `${date}T${dispatchClock}`)
  }

  function updateDispatchClock(clock: string) {
    up('dispatch_time', `${dispatchDate}T${clock}`)
  }

  useEffect(() => {
    Promise.all([
      getVendors(),
      getShipmentTMSOptions(),
      genTripId(),
    ]).then(([vends, opts, tripId]) => {
      setVendors(vends.filter(v => v.is_active !== false))
      setAllCrew(opts.drivers)
      setRoutes(opts.routes)
      setForm(f => ({ ...f, trip_id: tripId }))
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

  // Saat vendor dipilih, auto-fill nama vendor
  function onVendorChange(id: string) {
    const vid = id ? Number(id) : null
    const v = vendors.find(v => v.id === vid)
    up('vendor_id', vid)
    up('vendor_name', v?.vendor_name ?? '')
  }

	function routeLabel(route: RouteOption) {
		return `${route.route_code} · ${route.origin} → ${route.destination}`
	}

	function onRouteQueryChange(value: string) {
		setRouteQuery(value)
		const selectedRoute = routes.find(route => routeLabel(route).toLocaleLowerCase('id-ID') === value.toLocaleLowerCase('id-ID'))
		up('route_id', selectedRoute?.id ?? null)
	}

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.vendor_id) { setErr('Vendor wajib dipilih'); return }
      if (!form.vehicle_nopol.trim()) { setErr('Nomor Polisi kendaraan wajib diisi'); return }
      if (!form.driver_name_ext.trim()) { setErr('Nama Driver wajib diisi'); return }
      if (form.status === 'Dispatched' && !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(form.dispatch_time)) {
        setErr('Tanggal dan jam dispatch harus diisi dengan format yang benar')
        return
      }
      try {
        await bulkCreateShipments({
          pssRows:         selectedPss,
          vendor_id:       form.vendor_id,
          vendor_name:     form.vendor_name,
          vehicle_nopol:   form.vehicle_nopol.trim().toUpperCase(),
          vehicle_type:    form.vehicle_type || null,
          driver_name_ext: form.driver_name_ext.trim().toUpperCase(),
          vehicle_id:      null,
          driver_id:       null,
          helper_id:       null,
          route_id:        form.route_id,
          trip_id:         form.trip_id || null,
          cost_model:      form.cost_model,
          status:          form.status,
          dispatch_time:   form.status === 'Dispatched' ? form.dispatch_time : null,
        })
        onSaved()
        onClose()
      } catch (e: any) {
        setErr(e.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div>
            <h3 className="font-bold text-lg">BUAT SHIPMENT — {selectedPss.length} PSS</h3>
            <p className="text-xs text-gray-500 mt-0.5">Semua PSS terpilih akan masuk dalam 1 trip</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">

          {/* Daftar PSS terpilih */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> PSS yang akan dibuatkan Shipment
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {selectedPss.map(p => (
                <div key={p.pss_no} className="flex items-center gap-3 text-xs">
                  <span className="font-mono font-bold text-indigo-600 whitespace-nowrap">{p.pss_no}</span>
                  <span className="text-gray-700 truncate flex-1">{p.customer_name}</span>
                  <span className="text-gray-400 whitespace-nowrap">{p.destination_city ?? '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {optLoading && <p className="text-sm text-gray-400 text-center py-2">Memuat data...</p>}

          {/* Trip ID — auto-generated, read only */}
          <Field label="TRIP ID">
            <div className="inp bg-gray-50 text-gray-600 font-mono select-all">
              {form.trip_id || <span className="text-gray-400 italic">Generating...</span>}
            </div>
          </Field>

          {/* ── Vendor ── */}
          <Section icon={<Truck className="h-4 w-4" />} title="Vendor Pengiriman">
            <Field label="VENDOR *">
              <select
                value={form.vendor_id ?? ''}
                onChange={e => onVendorChange(e.target.value)}
                className="inp"
              >
                <option value="">— Pilih Vendor —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_name}
                    {v.vendor_type ? ` · ${v.vendor_type}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {/* Kendaraan */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="NO. POLISI KENDARAAN *">
                <input
                  value={form.vehicle_nopol}
                  onChange={e => up('vehicle_nopol', e.target.value)}
                  placeholder="BK 1234 AB"
                  className="inp uppercase"
                />
              </Field>
              <Field label="TIPE KENDARAAN">
                <select value={form.vehicle_type} onChange={e => up('vehicle_type', e.target.value)} className="inp">
                  <option value="">— Pilih —</option>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            {/* Driver */}
            <Field label="NAMA DRIVER *">
              <input
                value={form.driver_name_ext}
                onChange={e => up('driver_name_ext', e.target.value)}
                placeholder="Nama lengkap driver..."
                className="inp uppercase"
              />
            </Field>
          </Section>

          {/* ── Rute ── */}
          <Section icon={<Route className="h-4 w-4" />} title="Rute (opsional)">
            <Field label="RUTE">
				<input
					list="bulk-shipment-routes"
					value={routeQuery}
					onChange={event => onRouteQueryChange(event.target.value)}
					placeholder="Ketik kota atau kode rute, mis. LANGSA"
					className="inp"
					disabled={optLoading}
				/>
				<datalist id="bulk-shipment-routes">
					{routes.map(route => <option key={route.id} value={routeLabel(route)} />)}
				</datalist>
				<select value={form.route_id ?? ''} onChange={e => up('route_id', e.target.value ? Number(e.target.value) : null)} className="hidden" tabIndex={-1} aria-hidden="true">
                <option value="">— Pilih Rute —</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.route_code} · {r.origin} → {r.destination}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* ── Status Awal ── */}
          <Section icon={<Users className="h-4 w-4" />} title="Status Awal">
            <div className="grid grid-cols-2 gap-3">
              <Field label="STATUS">
                <select value={form.status} onChange={e => up('status', e.target.value as any)} className="inp">
                  <option value="Draft">Draft</option>
                  <option value="Dispatched">Dispatched (langsung kirim)</option>
                </select>
              </Field>
              {form.status === 'Dispatched' && (
                <Field label="WAKTU DISPATCH">
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <input
                      type="date"
                      value={dispatchDate}
                      onChange={e => updateDispatchDate(e.target.value)}
                      className="inp"
                      aria-label="Tanggal dispatch"
                    />
                    <input
                      type="text"
                      value={dispatchClock}
                      onChange={e => updateDispatchClock(e.target.value)}
                      placeholder="HH:MM"
                      inputMode="numeric"
                      maxLength={5}
                      className="inp"
                      aria-label="Jam dispatch, dapat diketik manual"
                      title="Ketik jam secara manual, contoh 15:25"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Jam dapat diketik manual, contoh: 15:25</p>
                </Field>
              )}
            </div>
          </Section>

          {err && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{err}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4 bg-gray-50 shrink-0">
          <p className="text-xs text-gray-500">
            Akan membuat <strong>{selectedPss.length}</strong> shipment sekaligus
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">
              Batal
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving
                ? `Membuat ${selectedPss.length} Shipment…`
                : `Buat ${selectedPss.length} Shipment`}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}`}</style>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1">
        {icon} {title}
      </div>
      <div className="space-y-2">{children}</div>
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
