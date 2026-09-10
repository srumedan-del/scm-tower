'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  upsertShipmentTracking, deleteShipmentTracking,
  getShipmentTMSOptions, lookupCustomerDkLk,
  type ShipmentTrackingRow,
  type TransporterOption, type VehicleOption,
  type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'

const STATUS_OPTS = ['Draft', 'Dispatched', 'In Transit', 'Delivered'] as const

type Props = {
  shipment: ShipmentTrackingRow | null
  prefillPss?: import('@/app/(app)/shipment/actions').UntrackedPssRow | null
  onClose: () => void
  onSaved: () => void
}

export default function ShipmentTMSPanel({ shipment, prefillPss, onClose, onSaved }: Props) {
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

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: keyof ShipmentTrackingRow, v: any) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (shipment) {
      setOptLoading(false)
      return
    }
    getShipmentTMSOptions().then(opts => {
      setTransporters(opts.transporters)
      setVehicles(opts.vehicles)
      setAllCrew(opts.drivers)
      setRoutes(opts.routes)
      setPssOptions(opts.pssOptions)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

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

  // Auto-set cost_model saat transporter berubah
  useEffect(() => {
    if (!form.transporter_id) return
    const t = transporters.find(t => t.id === form.transporter_id)
    if (t) {
      up('cost_model', t.type === 'Internal' ? 'Internal' : (t.service_model as any ?? null))
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

  const selectedTransporter = transporters.find(t => t.id === form.transporter_id)
  const isInternal = selectedTransporter?.type === 'Internal'
  const transporterName = selectedTransporter?.name
    ?? form.transporter_name
    ?? form.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim()
    ?? ''
  const isIndahLogistik = /indah\s+logistik/i.test(transporterName)

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

        <div className="p-4 space-y-5 overflow-y-auto">
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat opsi...</p>}

          {/* ── Source — read-only saat edit ── */}
          <Section title="Sumber Shipment">
            {shipment ? (
              // EDIT MODE: tampilkan info, tidak bisa diubah
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Tipe Sumber">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    shipment.source_type === 'PSS' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                  }`}>{shipment.source_type}</span>
                </InfoField>
                <InfoField label="PSS / CD No.">
                  <span className="font-mono text-sm font-bold text-indigo-700">
                    {shipment.pss_no ?? (shipment.crossdocking_id ? `CD-${shipment.crossdocking_id}` : '-')}
                  </span>
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
                    <select value={form.pss_no ?? ''} onChange={e => onPssChange(e.target.value)} className="inp">
                      <option value="">-- Pilih PSS --</option>
                      {pssOptions.map((p: any) => (
                        <option key={p.pss_no} value={p.pss_no}>
                          {p.pss_no} — {p.customer_name}
                        </option>
                      ))}
                    </select>
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
            <div className="grid grid-cols-3 gap-3 mt-3">
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

          {/* Data vendor, armada, dan driver ditetapkan saat buat shipment. */}
          {!shipment && (
            <Section title="Transporter & Armada">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Transporter">
                <select value={form.transporter_id ?? ''} onChange={e => up('transporter_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                  <option value="">-- Pilih transporter --</option>
                  {transporters.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.service_model ? ` · ${t.service_model}` : ''}
                    </option>
                  ))}
                </select>
                </Field>
                <Field label="Rute">
                <select value={form.route_id ?? ''} onChange={e => up('route_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                  <option value="">-- Opsional --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.route_code} — {r.origin} → {r.destination}</option>
                  ))}
                </select>
                </Field>
              </div>
              {isInternal && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <Field label="Kendaraan">
                  <select value={form.vehicle_id ?? ''} onChange={e => up('vehicle_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                    <option value="">-- Pilih --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_no}{v.vehicle_type ? ` (${v.vehicle_type})` : ''}</option>
                    ))}
                  </select>
                  </Field>
                  <Field label="Driver">
                  <select value={form.driver_id ?? ''} onChange={e => up('driver_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                    <option value="">-- Pilih Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_name}</option>
                    ))}
                  </select>
                  </Field>
                  <Field label="Helper">
                  <select value={form.helper_id ?? ''} onChange={e => up('helper_id', e.target.value ? Number(e.target.value) : null)} className="inp">
                    <option value="">-- Pilih Helper --</option>
                    {helpers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_name}</option>
                    ))}
                  </select>
                  </Field>
                </div>
              )}
              <div className="mt-3">
                <Field label="Trip ID">
                  <div className="inp bg-gray-50 text-gray-600 font-mono">
                    {form.trip_id ?? '-'}
                  </div>
                </Field>
              </div>
            </Section>
          )}

          {/* ── Status & Timeline ── */}
          <Section title="Status & Timeline">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status *">
                <select value={form.status ?? 'Draft'} onChange={e => up('status', e.target.value)} className="inp">
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Waktu Dispatch">
				<DateTimeInput value={form.dispatch_time ?? null} onChange={value => up('dispatch_time', value)} />
              </Field>
            </div>
            {isIndahLogistik && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Nomor Resi Indah Logistik">
                  <input
                    value={form.no_resi ?? ''}
                    onChange={e => up('no_resi', e.target.value || null)}
                    className="inp font-mono"
                    placeholder="Masukkan nomor resi setelah serah-terima"
                  />
                </Field>
                <Field label="Biaya Kirim per Resi (Rp)">
                  <input
                    type="number"
                    min={0}
                    value={form.total_biaya_eksternal ?? ''}
                    onChange={e => up('total_biaya_eksternal', e.target.value === '' ? null : Number(e.target.value))}
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
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 border-b pb-1">{title}</div>
      {children}
    </section>
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

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="text-xs font-bold text-gray-500 mb-1 block">{label}</span>
      <div className="py-1.5">{children}</div>
    </div>
  )
}

function DateTimeInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
	const [time, setTime] = useState(value?.slice(11, 16) ?? '')
	const date = value?.slice(0, 10) ?? ''

	useEffect(() => {
		setTime(value?.slice(11, 16) ?? '')
	}, [value])

	function save(dateValue: string, timeValue: string) {
		if (!dateValue && !timeValue) {
			onChange(null)
			return
		}
		if (!dateValue || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return
		onChange(new Date(`${dateValue}T${timeValue}:00`).toISOString())
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
