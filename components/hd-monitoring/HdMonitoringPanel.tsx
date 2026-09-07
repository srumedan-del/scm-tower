'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  upsertHdMonitoring, deleteHdMonitoring,
  getHdCustomers,
  type HdMonitoringRow, type HdCustomerOption,
} from '@/app/(app)/inventory/hd-monitoring/actions'

// Defaults sesuai PRD
const DEFAULTS = {
  treatment_per_day_per_machine: 2,
  working_days_per_month: 25,
  safety_stock_days: 6,
  rop_days: 8,
  lead_time_reorder_days: 9,  // midpoint 8-11
}

type Props = {
  row: HdMonitoringRow | null
  onClose: () => void
  onSaved: () => void
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Client-side preview kalkulasi (mirror logika DB)
function calcPreview(form: any, machineCount: number | null) {
  const machines = machineCount ?? 0
  const tpd = Number(form.treatment_per_day_per_machine) || 2
  const wd  = Number(form.working_days_per_month) || 25
  const ssd = Number(form.safety_stock_days) || 6
  const ropd= Number(form.rop_days) || 8
  const ltd = Number(form.lead_time_reorder_days) || 9

  const dailyUsage    = machines * tpd
  const monthlyNeed   = dailyUsage * wd
  const safetyStockQty= dailyUsage * ssd
  const ropQty        = dailyUsage * ropd

  const lastKnownQty  = Number(form.last_known_stock_qty) || 0
  const lastShipQty   = Number(form.last_shipment_qty) || 0
  const estimatedStock= lastKnownQty + lastShipQty
  const doi           = dailyUsage > 0 ? estimatedStock / dailyUsage : null

  let stockoutDate: Date | null = null
  if (doi != null && form.last_shipment_date) {
    stockoutDate = new Date(form.last_shipment_date)
    stockoutDate.setDate(stockoutDate.getDate() + Math.floor(doi))
  }

  let fuPoDate: Date | null = null
  if (stockoutDate) {
    fuPoDate = new Date(stockoutDate)
    fuPoDate.setDate(fuPoDate.getDate() - ltd)
  }

  const availableStock = estimatedStock - ropQty
  const availableDays  = dailyUsage > 0 ? availableStock / dailyUsage : null

  return {
    dailyUsage, monthlyNeed, safetyStockQty, ropQty,
    estimatedStock, doi,
    stockoutDate: stockoutDate?.toISOString().slice(0, 10) ?? null,
    fuPoDate:     fuPoDate?.toISOString().slice(0, 10) ?? null,
    availableStock, availableDays,
  }
}

export default function HdMonitoringPanel({ row, onClose, onSaved }: Props) {
  const [customers,  setCustomers]  = useState<HdCustomerOption[]>([])
  const [custLoading, setCustLoading] = useState(true)

  const [form, setForm] = useState({
    customer_id:                    row?.customer_id ?? 0,
    snapshot_date:                  row?.snapshot_date ?? today(),
    treatment_per_day_per_machine:  row?.treatment_per_day_per_machine ?? DEFAULTS.treatment_per_day_per_machine,
    working_days_per_month:         row?.working_days_per_month ?? DEFAULTS.working_days_per_month,
    safety_stock_days:              row?.safety_stock_days ?? DEFAULTS.safety_stock_days,
    rop_days:                       row?.rop_days ?? DEFAULTS.rop_days,
    lead_time_reorder_days:         row?.lead_time_reorder_days ?? DEFAULTS.lead_time_reorder_days,
    last_known_stock_date:          row?.last_known_stock_date ?? '',
    last_known_stock_qty:           row?.last_known_stock_qty ?? '',
    last_shipment_date:             row?.last_shipment_date ?? '',
    last_shipment_qty:              row?.last_shipment_qty ?? '',
    notes:                          row?.notes ?? '',
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getHdCustomers().then(c => {
      setCustomers(c)
      setCustLoading(false)
    }).catch(() => setCustLoading(false))
  }, [])

  const selectedCust = customers.find(c => c.id === Number(form.customer_id))
  const preview = calcPreview(form, selectedCust?.machine_count ?? row?.hd_machine_count ?? null)

  function del() {
    if (!row) return
    if (!confirm(`Hapus snapshot ${row.customer_code} tanggal ${row.snapshot_date}?`)) return
    startDeleting(async () => {
      try { await deleteHdMonitoring(row.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.customer_id) { setErr('Customer wajib dipilih'); return }
      if (!form.snapshot_date) { setErr('Tanggal snapshot wajib diisi'); return }
      try {
        await upsertHdMonitoring({
          id: row?.id,
          customer_id:                   Number(form.customer_id),
          snapshot_date:                 form.snapshot_date,
          treatment_per_day_per_machine: Number(form.treatment_per_day_per_machine),
          working_days_per_month:        Number(form.working_days_per_month),
          safety_stock_days:             Number(form.safety_stock_days),
          rop_days:                      Number(form.rop_days),
          lead_time_reorder_days:        Number(form.lead_time_reorder_days),
          last_known_stock_date:         (form.last_known_stock_date as string) || null,
          last_known_stock_qty:          form.last_known_stock_qty !== '' ? Number(form.last_known_stock_qty) : null,
          last_shipment_date:            (form.last_shipment_date as string) || null,
          last_shipment_qty:             form.last_shipment_qty !== '' ? Number(form.last_shipment_qty) : null,
          notes:                         (form.notes as string) || null,
        } as any)
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  const fmtNum = (v: number | null, decimals = 0) =>
    v == null ? '—' : v.toLocaleString('id-ID', { maximumFractionDigits: decimals })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <h3 className="font-bold text-lg uppercase">
            {row ? `Edit Snapshot — ${row.customer_name ?? row.customer_code}` : 'Input Snapshot HD Monitoring'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">

          {/* Customer & Tanggal */}
          <Sec title="Customer & Snapshot">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer HD *">
                {row ? (
                  <div className="inp bg-gray-50 text-gray-700">
                    {row.customer_name ?? row.customer_code}
                  </div>
                ) : (
                  <select
                    value={form.customer_id}
                    onChange={e => up('customer_id', e.target.value)}
                    className="inp"
                    disabled={custLoading}
                  >
                    <option value={0}>-- Pilih customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name ?? c.customer_code} — {c.city} ({c.machine_count ?? 0} mesin)
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Tanggal Snapshot *">
                <input type="date" value={form.snapshot_date} onChange={e => up('snapshot_date', e.target.value)} className="inp" />
              </Field>
            </div>
            {selectedCust && (
              <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
                <strong>{selectedCust.customer_name}</strong> · {selectedCust.city} ·{' '}
                <strong>{selectedCust.machine_count ?? 0}</strong> mesin HD
              </div>
            )}
          </Sec>

          {/* Konfigurasi asumsi */}
          <Sec title="Konfigurasi Asumsi (per customer)">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tindakan/Hari/Mesin">
                <input type="number" min={1} value={form.treatment_per_day_per_machine} onChange={e => up('treatment_per_day_per_machine', e.target.value)} className="inp" />
              </Field>
              <Field label="Hari Kerja/Bulan">
                <input type="number" min={1} max={31} value={form.working_days_per_month} onChange={e => up('working_days_per_month', e.target.value)} className="inp" />
              </Field>
              <Field label="Lead Time Reorder (hari)">
                <input type="number" min={1} value={form.lead_time_reorder_days} onChange={e => up('lead_time_reorder_days', e.target.value)} className="inp" />
              </Field>
              <Field label="Safety Stock (hari)">
                <input type="number" min={0} value={form.safety_stock_days} onChange={e => up('safety_stock_days', e.target.value)} className="inp" />
              </Field>
              <Field label="ROP (hari)">
                <input type="number" min={0} value={form.rop_days} onChange={e => up('rop_days', e.target.value)} className="inp" />
              </Field>
            </div>
          </Sec>

          {/* Input Manual Stok */}
          <Sec title="Data Stok (Input Manual)">
            <div className="text-xs text-gray-500 mb-2">
              SCM tidak memiliki visibilitas stok fisik di gudang customer — estimasi dari data pengiriman.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tanggal Stok Akhir Diketahui">
                <input type="date" value={form.last_known_stock_date as string} onChange={e => up('last_known_stock_date', e.target.value)} className="inp" />
              </Field>
              <Field label="Qty Stok Akhir">
                <input type="number" min={0} value={form.last_known_stock_qty as any} onChange={e => up('last_known_stock_qty', e.target.value)} className="inp" placeholder="0 jika tidak diketahui" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Tanggal Pengiriman Terakhir *">
                <input type="date" value={form.last_shipment_date as string} onChange={e => up('last_shipment_date', e.target.value)} className="inp" />
              </Field>
              <Field label="Qty Pengiriman Terakhir *">
                <input type="number" min={0} value={form.last_shipment_qty as any} onChange={e => up('last_shipment_qty', e.target.value)} className="inp" placeholder="pcs" />
              </Field>
            </div>
          </Sec>

          {/* Preview Kalkulasi */}
          {(selectedCust?.machine_count || row?.hd_machine_count) && (
            <Sec title="Preview Kalkulasi (otomatis tersimpan di DB)">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Pemakaian Harian', value: fmtNum(preview.dailyUsage) + ' pcs' },
                  { label: 'Kebutuhan Bulanan', value: fmtNum(preview.monthlyNeed) + ' pcs' },
                  { label: 'Safety Stock', value: fmtNum(preview.safetyStockQty) + ' pcs' },
                  { label: 'ROP', value: fmtNum(preview.ropQty) + ' pcs' },
                  { label: 'Stok Estimasi', value: fmtNum(preview.estimatedStock) + ' pcs', bold: (preview.estimatedStock ?? 0) < 0 ? 'text-red-600' : '' },
                  { label: 'DOI', value: preview.doi != null ? fmtNum(preview.doi, 1) + ' hari' : '—' },
                  { label: 'Estimasi Habis', value: preview.stockoutDate ?? '—' },
                  { label: 'Available Stock', value: fmtNum(preview.availableStock) + ' pcs' },
                  { label: 'FU-PO', value: preview.fuPoDate ?? '—', bold: 'text-indigo-700 font-bold' },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-gray-50 border px-3 py-2">
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className={`text-sm font-semibold ${item.bold ?? 'text-gray-800'}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </Sec>
          )}

          <Field label="Catatan">
            <textarea value={form.notes as string} onChange={e => up('notes', e.target.value)} className="inp" rows={2} placeholder="Opsional" />
          </Field>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 bg-gray-50 shrink-0">
          <div>
            {row && (
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
              {saving ? 'Menyimpan…' : 'Simpan Snapshot'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}.inp:disabled{background:#f9fafb;color:#9ca3af}`}</style>
      </div>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
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
