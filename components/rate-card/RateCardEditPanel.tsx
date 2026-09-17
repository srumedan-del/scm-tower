'use client'
import { useEffect, useState, useTransition } from 'react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { upsertRateCard, deleteRateCard, getRateCardRoutes, type RateCardRouteOption } from '@/app/(app)/master-data/rate-card/actions'
import { getVendors, type VendorRow } from '@/app/(app)/vendor/actions'

type Rate = {
  id: number
  rate_code: string
  origin: string
  destination: string
  vehicle_type: string | null
  tonnage: number | null
  cbm: number | null
  tariff_model: string | null
  price: number | null
  status: string | null
  service_name: string | null
  effective_from: string | null
  vendor_id: number | null
  route_id: number | null
}

const TRUCK_TYPES = ['AVANZA', 'GRANMAX', 'L-300', 'CDE', 'CDE-L', 'CDD', 'CDD-L', 'FUSO', 'R4', 'R6']

function formatPrice(value: number | null) {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function formatDimension(value: number | null) {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function buildServiceName(vehicleType: string, tonnage: number | null, cbm: number | null, destination: string) {
  const parts = ['TRUCKING']
  if (tonnage != null) parts.push(`${formatDimension(tonnage)} TON`)
  if (cbm != null) parts.push(`${formatDimension(cbm)} CBM`)

  const fleetLabel = vehicleType === 'CDD' || vehicleType === 'CDD-L' ? 'R6' : vehicleType
  if (fleetLabel) parts.push(fleetLabel.toUpperCase())
  if (destination.trim()) parts.push(`TUJUAN ${destination.trim().toUpperCase()}`)

  return parts.length > 1 ? parts.join(', ') : ''
}

export default function RateCardEditPanel({ rate, onClose, onSaved }: {
  rate: Rate | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => rate ? {
    rate_code: rate.rate_code ?? '',
    origin: rate.origin ?? '',
    destination: rate.destination ?? '',
    vehicle_type: rate.vehicle_type ?? '',
    tonnage: rate.tonnage,
    cbm: rate.cbm,
    tariff_model: rate.tariff_model ?? 'per_trip',
    price: rate.price,
    status: rate.status ?? 'aktif',
    service_name: rate.service_name ?? '',
    effective_from: rate.effective_from ? rate.effective_from.slice(0,10) : '',
    vendor_id: rate.vendor_id ?? null as number | null,
    route_id: rate.route_id ?? null as number | null,
  } : {
    rate_code: '', origin: '', destination: '', vehicle_type: 'R6', tonnage: null as number | null, cbm: null as number | null, tariff_model: 'per_trip', price: null as number | null, status: 'aktif', service_name: '', effective_from: '', vendor_id: null as number | null, route_id: null as number | null,
  })
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [routes, setRoutes] = useState<RateCardRouteOption[]>([])
  const [routeSearch, setRouteSearch] = useState('')
  const [routeOpen, setRouteOpen] = useState(false)
  const [priceFocused, setPriceFocused] = useState(false)
  const [dimensionFocused, setDimensionFocused] = useState<'tonnage' | 'cbm' | null>(null)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f:any) => ({ ...f, [k]: v }))
  const routeLabel = (route: RateCardRouteOption) => `${route.route_code} — ${route.origin} → ${route.destination}`

  useEffect(() => {
    getVendors()
      .then(data => setVendors(data.filter(vendor => vendor.is_active !== false)))
      .catch(() => setVendors([]))
  }, [])

  useEffect(() => {
    getRateCardRoutes()
      .then(availableRoutes => {
        setRoutes(availableRoutes)
        if (!rate?.route_id) {
          const matchedRoute = availableRoutes.find(route =>
            route.origin.trim().toUpperCase() === rate?.origin.trim().toUpperCase() &&
            route.destination.trim().toUpperCase() === rate?.destination.trim().toUpperCase()
          )
          if (matchedRoute) {
            setForm(current => ({ ...current, route_id: matchedRoute.id, origin: matchedRoute.origin, destination: matchedRoute.destination }))
            setRouteSearch(routeLabel(matchedRoute))
          }
        } else {
          const selectedRoute = availableRoutes.find(route => route.id === rate.route_id)
          if (selectedRoute) setRouteSearch(routeLabel(selectedRoute))
        }
      })
      .catch(() => setRoutes([]))
  }, [rate])

  useEffect(() => {
    if (rate?.service_name?.trim()) return

    const generatedServiceName = buildServiceName(form.vehicle_type, form.tonnage, form.cbm, form.destination)
    setForm(current => current.service_name === generatedServiceName
      ? current
      : { ...current, service_name: generatedServiceName })
  }, [form.vehicle_type, form.tonnage, form.cbm, form.destination])

  function selectRoute(selectedRoute: RateCardRouteOption | undefined) {
    setForm(current => ({
      ...current,
      route_id: selectedRoute?.id ?? null,
      origin: selectedRoute?.origin ?? '',
      destination: selectedRoute?.destination ?? '',
    }))
    setRouteSearch(selectedRoute ? routeLabel(selectedRoute) : '')
    setRouteOpen(false)
  }

  const filteredRoutes = routes.filter(route => {
    const query = routeSearch.trim().toLowerCase()
    if (!query) return true
    return routeLabel(route).toLowerCase().includes(query)
  }).slice(0, 100)

  function del() {
    if (!rate) return
    if (!confirm(`HAPUS RATE ${rate.rate_code}?`)) return
    startDeleting(async () => {
      try {
        await deleteRateCard(rate.id)
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload: any = {
        rate_code: (form.rate_code as string).trim().toUpperCase(),
        origin: (form.origin as string).trim().toUpperCase(),
        destination: (form.destination as string).trim().toUpperCase(),
        vehicle_type: (form.vehicle_type as string).trim().toUpperCase() || null,
        tonnage: form.tonnage == null ? null : Number(form.tonnage),
        cbm: form.cbm == null ? null : Number(form.cbm),
        tariff_model: (form.tariff_model as string).trim().toLowerCase() || 'per_trip',
        price: form.price == null ? null : Number(form.price),
        status: (form.status as string).trim().toLowerCase() || 'aktif',
        service_name: (form.service_name as string).trim().toUpperCase() || null,
        effective_from: (form.effective_from as string) || null,
        vendor_id: form.vendor_id == null ? null : Number(form.vendor_id),
        route_id: form.route_id == null ? null : Number(form.route_id),
      }
      if (!payload.rate_code) { setErr('RATE CODE wajib diisi'); return }
      if (!payload.route_id) { setErr('RUTE wajib dipilih dari Master Routes'); return }
      try {
        await upsertRateCard(payload, rate?.id)
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white font-sans text-sm shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <h3 className="text-lg font-bold uppercase">{rate ? 'EDIT RATE CARD' : 'TAMBAH RATE CARD'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="RATE CODE *"><input value={form.rate_code} onChange={e=>up('rate_code', e.target.value)} className="inp font-mono" placeholder="BIA-EKS-2137" disabled={!!rate} /></Field>
          <Field label="VENDOR">
            <SearchableSelect
              value={form.vendor_id ?? ''}
              onChange={(value: string) => up('vendor_id', value === '' ? null : Number(value))}
              placeholder="— Pilih Vendor —"
              options={vendors.map(vendor => ({
                value: vendor.id,
                label: vendor.vendor_name,
              }))}
            />
          </Field>
          <Field label="RUTE *">
            <div className="relative">
              <input
                value={routeSearch}
                onFocus={() => setRouteOpen(true)}
                onChange={e => {
                  setRouteSearch(e.target.value)
                  up('route_id', null)
                  setRouteOpen(true)
                }}
                className="inp"
                placeholder="Ketik kode, origin, atau tujuan route"
                autoComplete="off"
              />
              {routeOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredRoutes.map(route => (
                    <button
                      key={route.id}
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => selectRoute(route)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      {routeLabel(route)}
                    </button>
                  ))}
                  {!filteredRoutes.length && <div className="px-3 py-2 text-sm text-gray-500">Route tidak ditemukan.</div>}
                </div>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="TYPE TRUCK">
              <select value={form.vehicle_type} onChange={e=>up('vehicle_type', e.target.value)} className="inp">
                <option value="">-- Pilih Type Truck --</option>
                {[...new Set([...(form.vehicle_type ? [form.vehicle_type] : []), ...TRUCK_TYPES])].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="TONNAGE">
              <input
                type="text"
                inputMode="decimal"
                value={dimensionFocused === 'tonnage' ? (form.tonnage ?? '') : formatDimension(form.tonnage)}
                onFocus={() => setDimensionFocused('tonnage')}
                onBlur={() => setDimensionFocused(null)}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.')
                  up('tonnage', raw === '' || raw === '-' ? null : Number(raw))
                }}
                className="inp text-right tabular-nums"
                placeholder="4"
              />
            </Field>
            <Field label="CBM">
              <input
                type="text"
                inputMode="decimal"
                value={dimensionFocused === 'cbm' ? (form.cbm ?? '') : formatDimension(form.cbm)}
                onFocus={() => setDimensionFocused('cbm')}
                onBlur={() => setDimensionFocused(null)}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.')
                  up('cbm', raw === '' || raw === '-' ? null : Number(raw))
                }}
                className="inp text-right tabular-nums"
                placeholder="15"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TARIFF MODEL">
              <select value={form.tariff_model} onChange={e=>up('tariff_model', e.target.value)} className="inp">
                <option value="per_trip">PER_TRIP</option>
                <option value="per_kg">PER_KG</option>
                <option value="per_cbm">PER_CBM</option>
                <option value="per_unit">PER_UNIT</option>
              </select>
            </Field>
            <Field label="PRICE *">
              <input
                type="text"
                inputMode="decimal"
                value={priceFocused ? (form.price ?? '') : formatPrice(form.price)}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.')
                  up('price', raw === '' || raw === '-' ? null : Number(raw))
                }}
                className="inp text-right tabular-nums"
                placeholder="1.250.000"
              />
            </Field>
          </div>
          <Field label="SERVICE NAME">
            <input
              value={form.service_name}
              readOnly
              className="inp bg-gray-50 text-gray-600"
              placeholder="Otomatis dari tipe truck, tonase, CBM, dan tujuan"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EFFECTIVE FROM"><input type="date" value={form.effective_from} onChange={e=>up('effective_from', e.target.value)} className="inp" /></Field>
            <Field label="STATUS">
              <select value={form.status} onChange={e=>up('status', e.target.value)} className="inp">
                <option value="aktif">AKTIF</option>
                <option value="nonaktif">NONAKTIF</option>
              </select>
            </Field>
          </div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>{rate && <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">{deleting ? 'MENGHAPUS…' : 'HAPUS'}</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.rate_code || !form.origin || !form.destination} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'MENYIMPAN…' : 'SIMPAN'}</button>
          </div>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#3b82f6}.inp:disabled{background:#f3f4f6;color:#6b7280}`}</style>
      </div>
    </div>
  )
}
function Field({label, children}:{label:string;children:React.ReactNode}) {
  return <label className="block"><span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>{children}</label>
}
