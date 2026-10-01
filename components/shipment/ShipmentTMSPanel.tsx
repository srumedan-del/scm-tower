'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  upsertShipmentTracking, deleteShipmentTracking,
  updateShipmentRetailCost,
  getShipmentTMSOptions, lookupCustomerDkLk,
  type ShipmentTrackingRow,
  type TransporterOption, type VehicleOption,
  type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'
import SearchableSelect from '@/components/ui/SearchableSelect'

const STATUS_OPTS = ['Draft', 'Dispatched', 'In Transit', 'Delivered'] as const

type Props = {
  shipment: ShipmentTrackingRow | null
  relatedShipments?: ShipmentTrackingRow[]
  prefillPss?: import('@/app/(app)/shipment/actions').UntrackedPssRow | null
  onClose: () => void
  onSaved: () => void
}

export default function ShipmentTMSPanel({ shipment, relatedShipments, prefillPss, onClose, onSaved }: Props) {
  const [transporters, setTransporters] = useState<TransporterOption[]>([])
  const [vehicles,     setVehicles]     = useState<VehicleOption[]>([])
  const [allCrew,      setAllCrew]      = useState<DriverOption[]>([])
  const [routes,       setRoutes]       = useState<RouteOption[]>([])
  const [pssOptions,   setPssOptions]   = useState<any[]>([])
  const [optLoading,   setOptLoading]   = useState(true)

  const [form, setForm] = useState<Partial<ShipmentTrackingRow>>(() => {
    if (shipment) return shipment
    // Pre-fill dari PSS untracked
    if (prefillPss) return {
      source_type:            'PSS',
      status:                 'Draft',
      cost_model:             null,
      pss_no:                 prefillPss.pss_no,
      outbound_header_id:     prefillPss.id,
      customer_name:          prefillPss.customer_name ?? undefined,
      destination_city:       prefillPss.destination_city ?? undefined,
      promised_delivery_date: prefillPss.promised_delivery_date ?? undefined,
      document_date:          prefillPss.document_date ?? undefined,
    }
    return { source_type: 'PSS', status: 'Draft', cost_model: null }
  })

  useEffect(() => {
    if (shipment) {
      setForm(shipment)
      return
    }

    if (prefillPss) {
      setForm({
        source_type: 'PSS',
        status: 'Draft',
        cost_model: null,
        pss_no: prefillPss.pss_no,
        outbound_header_id: prefillPss.id,
        customer_name: prefillPss.customer_name ?? undefined,
        destination_city: prefillPss.destination_city ?? undefined,
        promised_delivery_date: prefillPss.promised_delivery_date ?? undefined,
        document_date: prefillPss.document_date ?? undefined,
      })
      return
    }

    setForm({ source_type: 'PSS', status: 'Draft', cost_model: null })
  }, [shipment, prefillPss])

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: keyof ShipmentTrackingRow, v: any) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getShipmentTMSOptions().then(opts => {
      setTransporters(opts.transporters)
      setVehicles(opts.vehicles)
      setAllCrew(opts.drivers)
      setRoutes(opts.routes)
      setPssOptions(opts.pssOptions)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

  useEffect(() => {
    if (!shipment || form.transporter_id || form.cost_model !== 'Internal' || !transporters.length) return
    const internalSru = transporters.find(t => t.type === 'Internal' && /sru\s*[-—]?\s*medan/i.test(t.name))
    if (internalSru) up('transporter_id', internalSru.id)
  }, [shipment, form.transporter_id, form.cost_model, transporters])

  // Auto-lookup DK/LK dari customer jika masih kosong (untuk record lama)
  useEffect(() => {
    if (form.dk_lk) return  // sudah ada, tidak perlu lookup
    const name = form.customer_name
    if (!name) return
    lookupCustomerDkLk(name as string).then(dk => {
      if (dk) up('dk_lk', dk)
    }).catch(() => {})
  }, [form.customer_name])

  // Filter drivers & helpers by role
  const drivers = allCrew.filter(d => d.role === 'Driver' || !d.role)
  const helpers = allCrew.filter(d => d.role === 'Helper')

  // Auto-set cost_model & fleet_type saat transporter berubah
  useEffect(() => {
    if (!form.transporter_id) return
    const t = transporters.find(t => t.id === form.transporter_id)
    if (t) {
      up('cost_model', t.type === 'Internal' ? 'Internal' : (t.service_model as any ?? null))
      up('fleet_type', t.type === 'Internal' ? 'Internal' : 'Eksternal')
    }
  }, [form.transporter_id, transporters])

  // Saat PSS dipilih, auto-fill fields dari outbound_header + dk_lk dari customers
  function onPssChange(pssNo: string) {
    const pss = pssOptions.find((p: any) => p.pss_no === pssNo)
    if (pss) {
      setForm(f => ({
        ...f,
        pss_no:                 pssNo,
        outbound_header_id:     pss.id,
        customer_name:          pss.customer_name,
        destination_city:       pss.destination_city ?? pss.ship_to_city,
        promised_delivery_date: pss.promised_delivery_date,
        document_date:          pss.document_date,
        dk_lk:                  pss.dk_lk ?? f.dk_lk,  // dari customer lookup
      }))
    } else {
      up('pss_no', pssNo)
    }
  }

  const noteTransporterName = form.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? ''
  const noteTransporter = transporters.filter(t => {
    const optionName = t.name.trim().toLowerCase()
    const noteName = noteTransporterName.toLowerCase()
    return noteName && (optionName === noteName || optionName.includes(noteName) || noteName.includes(optionName))
  }).sort((first, second) => {
    const firstRetail = form.cost_model === 'Retail' && first.service_model === 'Retail' ? 1 : 0
    const secondRetail = form.cost_model === 'Retail' && second.service_model === 'Retail' ? 1 : 0
    return secondRetail - firstRetail
  })[0]
  const effectiveTransporterId = form.transporter_id ?? noteTransporter?.id ?? ''
  const selectedTransporter = transporters.find(t => t.id === Number(effectiveTransporterId))
  const isInternal = selectedTransporter?.type === 'Internal'
  const transporterName = selectedTransporter?.name
    ?? form.transporter_name
    ?? form.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim()
    ?? ''
  const isRetailCourier = /indah\s+logistik|jne/i.test(transporterName) || Boolean(String(form.no_resi ?? '').trim())

  useEffect(() => {
    if (form.transporter_id || !noteTransporter) return
    up('transporter_id', noteTransporter.id)
  }, [form.transporter_id, noteTransporter?.id])

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
        const selectedVendor = transporters.find(t => t.id === Number(effectiveTransporterId))
        const retailFields = Boolean(String(form.no_resi ?? '').trim()) || form.cost_model === 'Retail' || isRetailCourier
        const sharedFields = {
          transporter_id: effectiveTransporterId ? Number(effectiveTransporterId) : null,
          transporter_name: selectedVendor?.name ?? form.transporter_name,
          vehicle_id: form.vehicle_id ?? null,
          driver_id: form.driver_id ?? null,
          helper_id: form.helper_id ?? null,
          route_id: form.route_id ?? null,
          trip_id: form.trip_id ?? null,
          cost_model: retailFields ? 'Retail' : (form.cost_model ?? null),
          fleet_type: form.fleet_type ?? (isInternal ? 'Internal' : 'Eksternal'),
          status: retailFields || form.trip_id ? 'In Transit' : form.status,
          dispatch_time: form.dispatch_time ?? null,
          no_resi: form.no_resi?.trim() || null,
          total_biaya_eksternal: form.total_biaya_eksternal == null
            ? null
            : Number(form.total_biaya_eksternal),
        }
        const rowsToUpdate = shipment ? (relatedShipments?.length ? relatedShipments : [shipment]) : [null]
        await Promise.all(rowsToUpdate.map(row => upsertShipmentTracking({
          ...(row ?? form),
          ...sharedFields,
          id: row?.id,
        })))
        await Promise.all(rowsToUpdate
          .filter((row): row is ShipmentTrackingRow => row != null && row.id != null)
          .map(row => updateShipmentRetailCost({
            id: row.id,
            no_resi: form.no_resi?.trim() || null,
            total_biaya_eksternal: form.total_biaya_eksternal == null
              ? null
              : Number(form.total_biaya_eksternal),
          })))
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white font-sans text-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <h3 className="font-bold uppercase">
            {shipment ? 'Edit Shipment TMS' : 'Tambah Shipment TMS'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="min-h-0 flex-1 content-start space-y-3 overflow-y-auto p-4">
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat opsi...</p>}

          {/* ── Source — read-only saat edit ── */}
          <Section title="Sumber Shipment">
            {shipment ? (
              // EDIT MODE: tampilkan info, tidak bisa diubah
              <div>
                <InfoField label={relatedShipments && relatedShipments.length > 1 ? `PSS / CD No. (${relatedShipments.length} dalam 1 Trip)` : 'PSS / CD No.'}>
                  <div className="space-y-1">
                    {(relatedShipments?.length ? relatedShipments : [shipment]).map(row => (
                      <div key={row.id} className="font-bold text-indigo-700">
                        {row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')}
                      </div>
                    ))}
                  </div>
                </InfoField>
              </div>
            ) : (
              // ADD MODE: bisa pilih PSS
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipe Sumber">
                  <select value={form.source_type ?? 'PSS'} onChange={e => up('source_type', e.target.value)} className="inp">
                    <option value="PSS">PSS (dari NAV)</option>
                    <option value="Crossdocking">Crossdocking (manual)</option>
                  </select>
                </Field>
                {form.source_type === 'PSS' ? (
                  <Field label="PSS No.">
                    <SearchableSelect value={form.pss_no ?? ''} onChange={onPssChange} placeholder="-- Pilih PSS --" options={pssOptions.map((p: any) => ({ value: p.pss_no, label: `${p.pss_no} — ${p.customer_name}` }))} />
                  </Field>
                ) : (
                  <Field label="Crossdocking ID">
                    <input type="number" value={form.crossdocking_id ?? ''} onChange={e => up('crossdocking_id', e.target.value ? Number(e.target.value) : null)} className="inp" />
                  </Field>
                )}
              </div>
            )}
          </Section>

          {/* ── Customer & Tujuan ── */}
          <Section title="Customer & Tujuan">
            <div className="grid grid-cols-2 gap-3">
              {shipment ? (
                <>
                  <InfoField label="Customer">
                    <span className="font-medium">{shipment.customer_name ?? '-'}</span>
                  </InfoField>
                  <InfoField label="Kota Tujuan">
                    <span>{shipment.destination_city ?? '-'}</span>
                  </InfoField>
                </>
              ) : (
                <>
                  <Field label="Customer Name">
                    <input value={form.customer_name ?? ''} onChange={e => up('customer_name', e.target.value)} className="inp" />
                  </Field>
                  <Field label="Kota Tujuan">
                    <input value={form.destination_city ?? ''} onChange={e => up('destination_city', e.target.value)} className="inp" />
                  </Field>
                </>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <InfoField label="Document Date">
                <span className="text-sm">{form.document_date?.slice(0,10) ?? '-'}</span>
              </InfoField>
              <InfoField label="Promised Delivery">
                <span className="text-sm">{form.promised_delivery_date?.slice(0,10) ?? '-'}</span>
              </InfoField>
              <InfoField label="DK / LK">
                {/* Auto dari customer — read-only */}
                <span className={`text-xs font-bold rounded px-2 py-0.5 ${
                  form.dk_lk === 'DK' ? 'bg-blue-100 text-blue-700' :
                  form.dk_lk === 'LK' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {form.dk_lk ?? '— belum diset di master customer —'}
                </span>
              </InfoField>
            </div>
          </Section>

          <Section title={isInternal ? 'Transporter & Armada' : 'Transporter & Rute'}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Model / Transporter">
                <SearchableSelect value={effectiveTransporterId} onChange={value => up('transporter_id', value ? Number(value) : null)} placeholder={isInternal ? 'Internal' : '-- Pilih transporter --'} options={transporters.map(t => ({ value: t.id, label: t.name }))} disabled={optLoading} />
              </Field>
              <Field label="Rute">
                <SearchableSelect value={form.route_id ?? ''} onChange={value => up('route_id', value ? Number(value) : null)} placeholder="-- Opsional --" options={routes.map(r => ({ value: r.id, label: `${r.route_code} — ${r.origin} → ${r.destination}` }))} />
              </Field>
            </div>
            {isInternal && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Field label="Armada">
                  <SearchableSelect value={form.vehicle_id ?? ''} onChange={value => up('vehicle_id', value ? Number(value) : null)} placeholder="-- Pilih --" options={vehicles.map(v => ({ value: v.id, label: `${v.vehicle_no}${v.vehicle_type ? ` (${v.vehicle_type})` : ''}` }))} />
                </Field>
                <Field label="Driver">
                  <SearchableSelect value={form.driver_id ?? ''} onChange={value => up('driver_id', value ? Number(value) : null)} placeholder="-- Pilih Driver --" options={drivers.map(d => ({ value: d.id, label: d.driver_name }))} />
                </Field>
                <Field label="Helper">
                  <SearchableSelect value={form.helper_id ?? ''} onChange={value => up('helper_id', value ? Number(value) : null)} placeholder="-- Pilih Helper --" options={helpers.map(d => ({ value: d.id, label: d.driver_name }))} />
                </Field>
              </div>
            )}
            <div className="mt-3">
              <Field label="Trip ID">
                <div className="inp bg-gray-50 text-gray-600 font-mono">{form.trip_id ?? '-'}</div>
              </Field>
            </div>
          </Section>

          {/* ── Status & Timeline ── */}
          <Section title="Status & Timeline">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status *">
                <select value={form.status ?? 'Draft'} onChange={e => up('status', e.target.value)} className="inp">
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Waktu Dispatch">
                <DateTimeInput value={form.dispatch_time ?? null} onChange={value => up('dispatch_time', value)} />
              </Field>
            </div>
            {isRetailCourier && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label="Nomor Resi Retail / Courier">
                  <input
                    value={form.no_resi ?? ''}
                    onChange={e => up('no_resi', e.target.value || null)}
                    className="inp font-mono"
                    placeholder="Masukkan nomor resi setelah serah-terima"
                  />
                </Field>
                <Field label="Biaya Kirim per Resi (Rp)">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.total_biaya_eksternal == null ? '' : String(form.total_biaya_eksternal)}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      up('total_biaya_eksternal', raw === '' ? null : Number(raw))
                    }}
                    className="inp"
                    placeholder="0"
                  />
                </Field>
              </div>
            )}
          </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 border-b pb-0.5 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs font-bold text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-0.5 block text-xs font-bold text-gray-500">{label}</span>
      <div className="py-0.5">{children}</div>
    </div>
  )
}

function DateTimeInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const [time, setTime] = useState(value ? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value)) : '')
  const date = value ? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value)) : ''

	useEffect(() => {
    setTime(value ? new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(value)) : '')
	}, [value])

	function save(dateValue: string, timeValue: string) {
		if (!dateValue && !timeValue) {
			onChange(null)
			return
		}
		if (!dateValue || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return
    onChange(new Date(`${dateValue}T${timeValue}:00+07:00`).toISOString())
	}

	return (
		<div className="grid grid-cols-[1fr_4.5rem] gap-1.5">
			<input type="date" value={date} onChange={event => save(event.target.value, time)} className="inp" />
			<input
				type="text"
				inputMode="numeric"
				value={time}
				onChange={event => {
					const nextTime = event.target.value
					setTime(nextTime)
					save(date, nextTime)
				}}
				placeholder="23:54"
				maxLength={5}
				className="inp"
				aria-label="Jam (HH:MM)"
			/>
		</div>
	)
}
