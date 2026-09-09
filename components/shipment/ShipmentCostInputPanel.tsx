'use client'

import { useState, useTransition } from 'react'
import { upsertShipmentCost, type ShipmentCostRow } from '@/app/(app)/shipment-cost/actions'

type Props = {
  row: ShipmentCostRow
  onClose: () => void
  onSaved: () => void
}

function rp(v: number | null | undefined) {
  if (!v) return '-'
  return 'Rp ' + v.toLocaleString('id-ID')
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400 mt-0.5 block">{hint}</span>}
    </label>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <div className={`text-xs font-bold uppercase tracking-wide mb-2 border-b pb-1 ${color}`}>{title}</div>
      {children}
    </section>
  )
}

const INP = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400'
const INP_MONO = INP + ' font-mono'

export default function ShipmentCostInputPanel({ row, onClose, onSaved }: Props) {
  const model = row.cost_model

  const [form, setForm] = useState({
    // common
    payment_voucher_no:  row.payment_voucher_no ?? '',
    invoice_value:       row.invoice_value ?? '',
    // Internal
    bbm_liter:           row.bbm_liter ?? '',
    bbm_rupiah:          row.bbm_rupiah ?? '',
    bongkar_muat_cost:   row.bongkar_muat_cost ?? '',
    hotel_cost:          row.hotel_cost ?? '',
    uang_makan_driver:   row.uang_makan_driver ?? '',
    uang_makan_helper:   row.uang_makan_helper ?? '',
    toll_cost:           row.toll_cost ?? '',
    parkir_cost:         row.parkir_cost ?? '',
    kirim_paket_cost:    row.kirim_paket_cost ?? '',
    misc_cost:           row.misc_cost ?? '',
    misc_cost_notes:     row.misc_cost_notes ?? '',
    // Retail — Indah Logistik
    no_resi:             row.no_resi ?? '',
    invoice_no_eksternal: row.invoice_no_eksternal ?? '',
    total_biaya_eksternal: row.total_biaya_eksternal ?? '',
    // Trucking — ASSA
    biaya_trucking:      row.biaya_trucking ?? '',
    biaya_tkbm:          row.biaya_tkbm ?? '',
  })

  const n = (v: string | number | null | undefined) => {
    if (v === '' || v === null || v === undefined) return null
    const num = Number(v)
    return isNaN(num) ? null : num
  }
  const s = (v: string) => v.trim() || null

  const up = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  // Preview total
  const previewTotal = (() => {
    if (model === 'Retail') return n(form.total_biaya_eksternal) ?? 0
    if (model === 'Trucking') return (n(form.biaya_trucking) ?? 0) + (n(form.biaya_tkbm) ?? 0)
    // Internal
    const costs: number[] = [
      n(form.bbm_rupiah), n(form.bongkar_muat_cost), n(form.hotel_cost),
      n(form.uang_makan_driver), n(form.uang_makan_helper),
      n(form.toll_cost), n(form.parkir_cost), n(form.kirim_paket_cost), n(form.misc_cost),
    ].map(value => value ?? 0)
    return costs.reduce((sum, value) => sum + value, 0)
  })()

  const invoiceValue = n(form.invoice_value) ?? 0
  const previewRatio = model !== 'Internal' && previewTotal > 0 && invoiceValue > 0
    ? ((previewTotal / invoiceValue) * 100).toFixed(1)
    : null

  const [saving, startSaving] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function save() {
    startSaving(async () => {
      setErr(null)
      try {
        await upsertShipmentCost({
          id: row.id,
          cost_model: row.cost_model,
          payment_voucher_no:   s(form.payment_voucher_no),
          invoice_value:        n(form.invoice_value),
          // Internal
          bbm_liter:            n(form.bbm_liter),
          bbm_rupiah:           n(form.bbm_rupiah),
          bongkar_muat_cost:    n(form.bongkar_muat_cost),
          hotel_cost:           n(form.hotel_cost),
          uang_makan_driver:    n(form.uang_makan_driver),
          uang_makan_helper:    n(form.uang_makan_helper),
          toll_cost:            n(form.toll_cost),
          parkir_cost:          n(form.parkir_cost),
          kirim_paket_cost:     n(form.kirim_paket_cost),
          misc_cost:            n(form.misc_cost),
          misc_cost_notes:      s(form.misc_cost_notes),
          // Retail
          no_resi:              s(form.no_resi),
          invoice_no_eksternal: s(form.invoice_no_eksternal),
          total_biaya_eksternal: n(form.total_biaya_eksternal),
          // Trucking
          biaya_trucking:       n(form.biaya_trucking),
          biaya_tkbm:           n(form.biaya_tkbm),
        })
        onSaved()
        onClose()
      } catch (e: any) {
        setErr(e.message)
      }
    })
  }

  const modelLabel =
    model === 'Retail'   ? 'Indah Logistik (Retail)' :
    model === 'Trucking' ? 'ASSA (Trucking)' :
    'Internal'

  const modelColor =
    model === 'Retail'   ? 'text-purple-600' :
    model === 'Trucking' ? 'text-orange-600' :
    'text-indigo-600'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div>
            <h3 className="font-bold text-base uppercase">Input Biaya Shipment</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs text-indigo-600">{row.trip_id ?? '-'}</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500">{row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')}</span>
              <span className="text-gray-300">·</span>
              <span className={`text-xs font-bold ${modelColor}`}>{modelLabel}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">

          {/* Info row */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 grid grid-cols-2 gap-2">
            <div><span className="font-bold">Customer:</span> {row.customer_name ?? '-'}</div>
            <div><span className="font-bold">Tujuan:</span> {row.destination_city ?? '-'}</div>
            <div><span className="font-bold">Transporter:</span> {row.transporter_name ?? '-'}</div>
            <div><span className="font-bold">DK/LK:</span> {row.dk_lk ?? '-'}</div>
          </div>

          {/* Common reference. Internal shipments do not use an invoice value. */}
          <Section title="Referensi" color="text-gray-500">
            <div className={model === 'Internal' || !model ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
              <Field label="No. Payment Voucher">
                <input
                  value={form.payment_voucher_no}
                  onChange={e => up('payment_voucher_no', e.target.value)}
                  className={INP_MONO}
                  placeholder="K-MDN-B-2609-001"
                />
              </Field>
              {model !== 'Internal' && model && (
                <Field label="Invoice Value (Rp)" hint="Nilai PSS dari NAV">
                  <input
                    type="number" min={0}
                    value={form.invoice_value}
                    onChange={e => up('invoice_value', e.target.value)}
                    className={INP}
                    placeholder="0"
                  />
                </Field>
              )}
            </div>
          </Section>

          {/* ── RETAIL — Indah Logistik ── */}
          {model === 'Retail' && (
            <Section title="Indah Logistik — Biaya Pengiriman" color="text-purple-600">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="No. Resi" hint="Nomor resi pengiriman Indah">
                    <input
                      value={form.no_resi}
                      onChange={e => up('no_resi', e.target.value)}
                      className={INP_MONO}
                      placeholder="ILP-2609-XXXXX"
                    />
                  </Field>
                  <Field label="No. Invoice Ekspedisi">
                    <input
                      value={form.invoice_no_eksternal}
                      onChange={e => up('invoice_no_eksternal', e.target.value)}
                      className={INP_MONO}
                      placeholder="INV/ILP/2026/..."
                    />
                  </Field>
                </div>
                <Field label="Total Biaya Kirim (Rp)" hint="Total biaya seluruh paket pengiriman">
                  <input
                    type="number" min={0}
                    value={form.total_biaya_eksternal}
                    onChange={e => up('total_biaya_eksternal', e.target.value)}
                    className={INP}
                    placeholder="0"
                  />
                </Field>
              </div>
            </Section>
          )}

          {/* ── TRUCKING — ASSA ── */}
          {model === 'Trucking' && (
            <Section title="ASSA — Biaya Trucking" color="text-orange-600">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="No. Invoice ASSA">
                    <input
                      value={form.invoice_no_eksternal}
                      onChange={e => up('invoice_no_eksternal', e.target.value)}
                      className={INP_MONO}
                      placeholder="INV/ASSA/2026/..."
                    />
                  </Field>
                  <Field label="Biaya Kirim Trucking (Rp)" hint="Biaya per trip / FTL">
                    <input
                      type="number" min={0}
                      value={form.biaya_trucking}
                      onChange={e => up('biaya_trucking', e.target.value)}
                      className={INP}
                      placeholder="0"
                    />
                  </Field>
                </div>
                <Field label="Biaya TKBM (Rp)" hint="Tenaga Kerja Bongkar Muat">
                  <input
                    type="number" min={0}
                    value={form.biaya_tkbm}
                    onChange={e => up('biaya_tkbm', e.target.value)}
                    className={INP}
                    placeholder="0"
                  />
                </Field>
              </div>
            </Section>
          )}

          {/* ── INTERNAL ── */}
          {(model === 'Internal' || !model) && (
            <Section title="Internal — Komponen Biaya Operasional" color="text-indigo-600">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="BBM (Liter)">
                    <input type="number" min={0} step={0.1}
                      value={form.bbm_liter}
                      onChange={e => up('bbm_liter', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                  <Field label="BBM (Rp)">
                    <input type="number" min={0}
                      value={form.bbm_rupiah}
                      onChange={e => up('bbm_rupiah', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bongkar Muat (Rp)">
                    <input type="number" min={0}
                      value={form.bongkar_muat_cost}
                      onChange={e => up('bongkar_muat_cost', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                  <Field label="Hotel (Rp)" hint="Opsional — LK">
                    <input type="number" min={0}
                      value={form.hotel_cost}
                      onChange={e => up('hotel_cost', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Uang Makan Driver (Rp)">
                    <input type="number" min={0}
                      value={form.uang_makan_driver}
                      onChange={e => up('uang_makan_driver', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                  <Field label="Uang Makan Helper (Rp)">
                    <input type="number" min={0}
                      value={form.uang_makan_helper}
                      onChange={e => up('uang_makan_helper', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tol (Rp)">
                    <input type="number" min={0}
                      value={form.toll_cost}
                      onChange={e => up('toll_cost', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                  <Field label="Parkir (Rp)">
                    <input type="number" min={0}
                      value={form.parkir_cost}
                      onChange={e => up('parkir_cost', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                  <Field label="Kirim Paket (Rp)" hint="Opsional">
                    <input type="number" min={0}
                      value={form.kirim_paket_cost}
                      onChange={e => up('kirim_paket_cost', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Biaya Lain-lain (Rp)">
                    <input type="number" min={0}
                      value={form.misc_cost}
                      onChange={e => up('misc_cost', e.target.value)}
                      className={INP} placeholder="0" />
                  </Field>
                  <Field label="Keterangan Lain-lain">
                    <input
                      value={form.misc_cost_notes}
                      onChange={e => up('misc_cost_notes', e.target.value)}
                      className={INP} placeholder="Uang jalan, dll" />
                  </Field>
                </div>
              </div>
            </Section>
          )}

          {/* Preview Total */}
          {typeof previewTotal === 'number' && previewTotal > 0 && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-indigo-500 font-medium">Estimasi Total Biaya</div>
                <div className="text-lg font-bold text-indigo-700">{rp(previewTotal)}</div>
              </div>
              {previewRatio && (
                <div className="text-right">
                  <div className="text-xs text-gray-500">Cost Ratio</div>
                  <div className={`text-lg font-bold ${Number(previewRatio) > 20 ? 'text-red-600' : Number(previewRatio) > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {previewRatio}%
                  </div>
                </div>
              )}
            </div>
          )}

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t p-4 bg-gray-50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan Biaya'}
          </button>
        </div>

      </div>
    </div>
  )
}
