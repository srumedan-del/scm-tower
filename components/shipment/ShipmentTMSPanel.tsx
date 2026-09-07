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
  shipment: ShipmentTrackingRow | null
  onClose: () => void
  onSaved: () => void
}

function fmtRp(v: number | null | undefined) {
  if (v == null) return '-'
  return 'Rp ' + v.toLocaleString('id-ID')
}

export default function ShipmentTMSPanel({ shipment, onClose, onSaved }: Props) {
  const [transporters, setTransporters] = useState<TransporterOption[]>([])
  const [vehicles,     setVehicles]     = useState<VehicleOption[]>([])
  const [allCrew,      setAllCrew]      = useState<DriverOption[]>([])
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
      setAllCrew(opts.drivers)
      setRoutes(opts.routes)
      setPssOptions(opts.pssOptions)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

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

  // Saat PSS dipilih, auto-fill fields dari outbound_header
  function onPssChange(pssNo: string) {
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
    } else {
      up('pss_no', pssNo)
    }
  }

  const selectedTransporter = transporters.find(t => t.id === form.transporter_id)
  const isInternal = selectedTransporter?.type === 'Internal'

  // Hitung total_biaya sementara untuk preview
  const previewTotalBiaya = isInternal
    ? [form.bbm_rupiah, form.bongkar_muat_cost, form.hotel_cost,
       form.uang_makan_driver, form.uang_makan_helper,
       form.toll_cost, form.parkir_cost, form.kirim_paket_cost]
       .reduce((s, v) => (s ?? 0) + (v ?? 0), 0) ?? 0
    : (form.total_biaya_eksternal ?? 0)

  const previewCostRatio = previewTotalBiaya > 0 && (form.invoice_value ?? 0) > 0
    ? ((previewTotalBiaya / (form.invoice_value as number)) * 100).toFixed(1)
    : null

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

          {/* ── Source ── */}
          <Section title="Sumber Shipment">
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
          </Section>

          {/* ── Customer & Tujuan ── */}
          <Section title="Customer & Tujuan">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer Name">
                <input value={form.customer_name ?? ''} onChange={e => up('customer_name', e.target.value)} className="inp" />
              </Field>
              <Field label="Kota Tujuan">
                <input value={form.destination_city ?? ''} onChange={e => up('destination_city', e.target.value)} className="inp" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Document Date">
                <input type="date" value={form.document_date?.slice(0,10) ?? ''} onChange={e => up('document_date', e.target.value || null)} className="inp" />
              </Field>
              <Field label="Promised Delivery Date">
                <input type="date" value={form.promised_delivery_date?.slice(0,10) ?? ''} onChange={e => up('promised_delivery_date', e.target.value || null)} className="inp" />
              </Field>
              <Field label="DK / LK">
                <select value={form.dk_lk ?? ''} onChange={e => up('dk_lk', e.target.value || null)} className="inp">
                  <option value="">-- auto dari customer --</option>
                  <option value="DK">DK — Dalam Kota</option>
                  <option value="LK">LK — Luar Kota</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Transporter & Armada ── */}
          <Section title="Transporter & Armada">
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
              <Field label="Trip ID (multi-drop, opsional)">
                <input value={form.trip_id ?? ''} onChange={e => up('trip_id', e.target.value || null)} className="inp" placeholder="TRIP-20260904-01" />
              </Field>
            </div>
          </Section>

          {/* ── Status & Timeline ── */}
          <Section title="Status & Timeline">
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
          </Section>

          {/* ── Biaya ── */}
          <Section title={`Biaya${form.cost_model ? ` — ${form.cost_model}` : ''}`}>
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
              <Field label="Invoice Value (Rp)">
                <input type="number" min={0} value={form.invoice_value ?? ''} onChange={e => up('invoice_value', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
              </Field>
            </div>

            {/* No. Payment Voucher — semua model */}
            <div className="mt-3">
              <Field label="No. Payment Voucher">
                <input value={form.payment_voucher_no ?? ''} onChange={e => up('payment_voucher_no', e.target.value || null)} className="inp font-mono" placeholder="K-MDN-B-2606-070" />
              </Field>
            </div>

            {/* Biaya Internal */}
            {(form.cost_model === 'Internal' || (!form.cost_model && isInternal)) && (
              <div className="mt-3 space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Komponen Biaya Internal</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="BBM (Liter)">
                    <input type="number" min={0} step={0.1} value={form.bbm_liter ?? ''} onChange={e => up('bbm_liter', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                  <Field label="BBM (Rp)">
                    <input type="number" min={0} value={form.bbm_rupiah ?? ''} onChange={e => up('bbm_rupiah', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bongkar Muat (Rp)">
                    <input type="number" min={0} value={form.bongkar_muat_cost ?? ''} onChange={e => up('bongkar_muat_cost', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                  <Field label="Hotel (Rp)">
                    <input type="number" min={0} value={form.hotel_cost ?? ''} onChange={e => up('hotel_cost', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0 — opsional LK" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Uang Makan Driver (Rp)">
                    <input type="number" min={0} value={form.uang_makan_driver ?? ''} onChange={e => up('uang_makan_driver', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                  <Field label="Uang Makan Helper (Rp)">
                    <input type="number" min={0} value={form.uang_makan_helper ?? ''} onChange={e => up('uang_makan_helper', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tol (Rp)">
                    <input type="number" min={0} value={form.toll_cost ?? ''} onChange={e => up('toll_cost', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                  <Field label="Parkir (Rp)">
                    <input type="number" min={0} value={form.parkir_cost ?? ''} onChange={e => up('parkir_cost', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                  <Field label="Kirim Paket (Rp)">
                    <input type="number" min={0} value={form.kirim_paket_cost ?? ''} onChange={e => up('kirim_paket_cost', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0 — opsional" />
                  </Field>
                </div>
              </div>
            )}

            {/* Biaya Eksternal */}
            {(form.cost_model === 'Retail' || form.cost_model === 'Trucking') && (
              <div className="mt-3 space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Biaya Eksternal</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="No. Invoice Ekspedisi">
                    <input value={form.invoice_no_eksternal ?? ''} onChange={e => up('invoice_no_eksternal', e.target.value || null)} className="inp font-mono" placeholder="INV/EKS/2026/..." />
                  </Field>
                  <Field label="Total Biaya Eksternal (Rp)">
                    <input type="number" min={0} value={form.total_biaya_eksternal ?? ''} onChange={e => up('total_biaya_eksternal', e.target.value ? Number(e.target.value) : null)} className="inp" placeholder="0" />
                  </Field>
                </div>
              </div>
            )}

            {/* Preview total */}
            {previewTotalBiaya > 0 && (
              <div className="mt-3 rounded-lg bg-gray-50 border p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-xs text-gray-500">Estimasi Total Biaya</span>
                  <div className="font-bold text-gray-800">{fmtRp(previewTotalBiaya)}</div>
                </div>
                {previewCostRatio && (
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Cost Ratio</span>
                    <div className={`font-bold ${Number(previewCostRatio) > 10 ? 'text-red-600' : 'text-green-600'}`}>
                      {previewCostRatio}%
                    </div>
                  </div>
                )}
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
