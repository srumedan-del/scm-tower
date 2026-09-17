'use client'
import { useState, useTransition, useEffect } from 'react'
import {
  bulkCreateShipments, generateTripId, getShipmentTMSOptions,
  type UntrackedPssRow, type DriverOption, type RouteOption, type VehicleOption,
} from '@/app/(app)/shipment/actions'
import { getVendors, type VendorRow } from '@/app/(app)/vendor/actions'
import { Truck, Users, Route } from 'lucide-react'
import SearchableSelect from '@/components/ui/SearchableSelect'

type Props = {
  selectedPss: UntrackedPssRow[]
  onClose: () => void
  onSaved: () => void
}

async function genTripId(): Promise<string> {
  return generateTripId()
}

const VEHICLE_TYPES = ['CDD', 'CDD-L', 'CDE', 'CDE-L', 'FUSO', 'TRONTON', 'BOX', 'PICKUP', 'L300', 'ENGKEL', 'LAINNYA']

export default function BulkShipmentPanel({ selectedPss, onClose, onSaved }: Props) {
  const [vendors,    setVendors]    = useState<VendorRow[]>([])
  const [allCrew,    setAllCrew]    = useState<DriverOption[]>([])
  const [vehicles,   setVehicles]   = useState<VehicleOption[]>([])
  const [routes,     setRoutes]     = useState<RouteOption[]>([])
  const [optLoading, setOptLoading] = useState(true)
	const [routeQuery, setRouteQuery] = useState('')

  const defaultShipmentMode = selectedPss.every(pss => pss.source_type === 'Crossdocking' || pss.dk_lk === 'LK')
    ? 'Eksternal'
    : 'Internal'
  const [form, setForm] = useState({
    shipment_mode:   defaultShipmentMode as 'Internal' | 'Eksternal',
    // Vendor
    vendor_id:       null as number | null,
    vendor_name:     '' as string,
    // Kendaraan (manual untuk eksternal)
    vehicle_nopol:   '',
    vehicle_type:    '',
    vehicle_id:      null as number | null,
    driver_id:       null as number | null,
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
  const loadHasMetrics = selectedPss.some(pss => pss.total_koli != null || pss.total_tonnage != null || pss.total_volume_cbm != null)
  const totalKoli = selectedPss.reduce((sum, pss) => sum + Number(pss.total_koli ?? 0), 0)
  const totalTonnage = selectedPss.reduce((sum, pss) => sum + Number(pss.total_tonnage ?? 0), 0)
  const totalVolume = selectedPss.reduce((sum, pss) => sum + Number(pss.total_volume_cbm ?? 0), 0)
  const formatLoadTonnage = (tonnage: number) => tonnage < 1
    ? `${(tonnage * 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`
    : `${tonnage.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ton`

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
      setVehicles(opts.vehicles)
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
    if (v?.vendor_type?.toUpperCase().includes('RETAIL') || /indah\s+logistik/i.test(v?.vendor_name ?? '')) {
      up('cost_model', 'Retail')
    } else {
      up('cost_model', 'Trucking')
    }
  }

  function onShipmentModeChange(mode: 'Internal' | 'Eksternal') {
    setForm(current => ({
      ...current,
      shipment_mode: mode,
      cost_model: mode === 'Internal' ? 'Internal' : 'Trucking',
      vendor_id: mode === 'Internal' ? null : current.vendor_id,
      vendor_name: mode === 'Internal' ? '' : current.vendor_name,
      vehicle_nopol: mode === 'Internal' ? '' : current.vehicle_nopol,
      vehicle_type: mode === 'Internal' ? '' : current.vehicle_type,
      driver_name_ext: mode === 'Internal' ? '' : current.driver_name_ext,
      vehicle_id: mode === 'Eksternal' ? null : current.vehicle_id,
      driver_id: mode === 'Eksternal' ? null : current.driver_id,
    }))
  }

  function onInternalVehicleChange(id: string) {
    const vehicleId = id ? Number(id) : null
    const vehicle = vehicles.find(item => item.id === vehicleId)
    setForm(current => ({ ...current, vehicle_id: vehicleId, vehicle_type: vehicle?.vehicle_type ?? '' }))
  }

	function routeLabel(route: RouteOption) {
		return `${route.route_code} · ${route.origin} → ${route.destination}`
	}

  function onRouteQueryChange(value: string) {
		const normalizedValue = value.toLocaleUpperCase('id-ID')
		setRouteQuery(normalizedValue)
		const selectedRoute = routes.find(route => routeLabel(route).toLocaleLowerCase('id-ID') === normalizedValue.toLocaleLowerCase('id-ID'))
		up('route_id', selectedRoute?.id ?? null)
	}

  function save() {
    startSaving(async () => {
      setErr(null)
      if (form.shipment_mode === 'Eksternal' && !form.vendor_id) { setErr('Vendor wajib dipilih'); return }
      if (form.shipment_mode === 'Eksternal' && !form.vehicle_nopol.trim()) { setErr('Nomor Polisi kendaraan wajib diisi'); return }
      if (form.shipment_mode === 'Eksternal' && !form.vehicle_type.trim()) { setErr('Tipe kendaraan wajib diisi'); return }
      if (form.shipment_mode === 'Eksternal' && !form.driver_name_ext.trim()) { setErr('Nama Driver wajib diisi'); return }
      if (form.shipment_mode === 'Eksternal' && !form.route_id) { setErr('Rute wajib dipilih'); return }
      if (form.shipment_mode === 'Internal' && !form.vehicle_id) { setErr('Armada internal wajib dipilih'); return }
      if (form.shipment_mode === 'Internal' && !form.driver_id) { setErr('Driver wajib dipilih'); return }
      if (form.shipment_mode === 'Internal' && !form.route_id) { setErr('Rute wajib dipilih'); return }
      if (form.status === 'Dispatched' && !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(form.dispatch_time)) {
        setErr('Tanggal dan jam dispatch harus diisi dengan format yang benar')
        return
      }
      try {
        await bulkCreateShipments({
          pssRows:         selectedPss,
          vendor_id:       form.shipment_mode === 'Eksternal' ? form.vendor_id : null,
          vendor_name:     form.shipment_mode === 'Eksternal' ? form.vendor_name : null,
          vehicle_nopol:   form.shipment_mode === 'Eksternal' ? form.vehicle_nopol.trim().toUpperCase() : null,
          vehicle_type:    form.vehicle_type || null,
          driver_name_ext: form.shipment_mode === 'Eksternal' ? form.driver_name_ext.trim().toUpperCase() : null,
          vehicle_id:      form.shipment_mode === 'Internal' ? form.vehicle_id : null,
          driver_id:       form.shipment_mode === 'Internal' ? form.driver_id : null,
          helper_id:       null,
          route_id:        form.route_id,
          trip_id:         form.trip_id || null,
          cost_model:      form.shipment_mode === 'Internal' ? 'Internal' : form.cost_model,
          status:          'In Transit',
          // Both shipment modes start when the create button is processed.
          dispatch_time:   new Date().toISOString(),
        })
        onSaved()
        onClose()
      } catch (e: any) {
        setErr(e.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white font-sans text-sm shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b p-4">
          <h3 className="font-bold uppercase">Buat Shipment TMS — {selectedPss.length} PSS</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="min-h-0 flex-1 content-start space-y-3 overflow-y-auto p-4">

          {/* Ringkasan PSS dan muatan */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="space-y-0.5">
              {selectedPss.map(p => (
                <div key={p.pss_no} className="flex items-center gap-3">
                  <span className="font-bold text-indigo-600 whitespace-nowrap">{p.pss_no}</span>
                  <span className="text-gray-700 truncate flex-1">{p.customer_name}</span>
                  <span className="text-gray-500 whitespace-nowrap">{p.destination_city ?? '-'}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 border-t border-orange-200 pt-2 text-sm font-bold text-gray-900">
              TONASE : {loadHasMetrics ? formatLoadTonnage(totalTonnage) : '-'}
              <span className="mx-2 text-orange-300">-</span>
              VOLUME : {loadHasMetrics ? `${totalVolume.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m3` : '-'}
              <span className="mx-2 text-orange-300">-</span>
              KOLI : {loadHasMetrics ? totalKoli.toLocaleString('id-ID') : '-'}
            </p>
          </div>

          {optLoading && <p className="py-2 text-center text-sm text-gray-400">Memuat data...</p>}

          <Section icon={<Truck className="h-4 w-4" />} title="Model Pengiriman">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onShipmentModeChange('Internal')} className={`rounded-lg border px-3 py-2 text-left text-sm ${form.shipment_mode === 'Internal' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                <span className="block font-semibold">Internal</span>
              </button>
              <button type="button" onClick={() => onShipmentModeChange('Eksternal')} className={`rounded-lg border px-3 py-2 text-left text-sm ${form.shipment_mode === 'Eksternal' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                <span className="block font-semibold">Eksternal</span>
              </button>
            </div>
          </Section>

          {/* Trip ID — auto-generated, read only */}
          <Field label="TRIP ID">
            <div className="inp select-all bg-gray-50 text-gray-600">
              {form.trip_id || <span className="text-gray-400 italic">Generating...</span>}
            </div>
          </Field>

          {form.shipment_mode === 'Eksternal' ? <>
          {/* ── Vendor ── */}
          <Section className="min-[480px]:col-span-2" icon={<Truck className="h-4 w-4" />} title="Vendor Pengiriman">
            <Field label="VENDOR *">
              <SearchableSelect value={form.vendor_id ?? ''} onChange={value => onVendorChange(value)} placeholder="— Pilih Vendor —" options={vendors.map(v => ({ value: v.id, label: `${v.vendor_name}${v.vendor_type ? ` · ${v.vendor_type}` : ''}` }))} />
            </Field>

            {/* Kendaraan */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="NO. POLISI KENDARAAN *">
                <input
                  value={form.vehicle_nopol}
                  onChange={e => up('vehicle_nopol', e.target.value.toLocaleUpperCase('id-ID'))}
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
                  onChange={e => up('driver_name_ext', e.target.value.toLocaleUpperCase('id-ID'))}
                placeholder="Nama lengkap driver..."
                className="inp uppercase"
              />
            </Field>
          </Section>
          </> : (
          <Section icon={<Truck className="h-4 w-4" />} title="Armada Internal">
            <Field label="MODEL / TRANSPORTER">
              <div className="inp bg-gray-50 font-semibold text-indigo-700">SRU MEDAN (otomatis)</div>
            </Field>
            <Field label="ARMADA *">
              <select value={form.vehicle_id ?? ''} onChange={e => onInternalVehicleChange(e.target.value)} className="inp">
                <option value="">— Pilih Armada —</option>
                {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_no} · {vehicle.vehicle_type ?? 'Armada'}</option>)}
              </select>
            </Field>
            <Field label="DRIVER">
              <select value={form.driver_id ?? ''} onChange={e => up('driver_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                <option value="">— Pilih Driver —</option>
                {allCrew.filter(crew => crew.role === 'Driver' || !crew.role).map(driver => <option key={driver.id} value={driver.id}>{driver.driver_name}</option>)}
              </select>
            </Field>
          </Section>
          )}

          {/* ── Rute ── */}
          <Section icon={<Route className="h-4 w-4" />} title="Rute">
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
                <div className="inp bg-gray-50 font-semibold text-indigo-700">In Transit (otomatis saat Buat Shipment)</div>
              </Field>
              <Field label="WAKTU PROSES">
                <div className="inp bg-gray-50 text-gray-600">Diisi otomatis saat klik Buat Shipment</div>
              </Field>
            </div>
          </Section>

          {err && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{err}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t bg-gray-50 p-3 sm:p-4">
          <p className="text-gray-500">
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

function Section({ icon, title, children, className = '' }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
      <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2 border-b border-gray-100 pb-1 font-bold uppercase tracking-wide text-gray-500">
        {icon} {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block font-bold text-gray-700">{label}</span>
      {children}
    </label>
  )
}
