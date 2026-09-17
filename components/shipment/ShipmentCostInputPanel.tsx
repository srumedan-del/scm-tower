'use client'

import { useEffect, useState, useTransition } from 'react'
import { getTruckingRate, upsertShipmentCost, type ShipmentCostRow } from '@/app/(app)/shipment-cost/actions'
import { displayVendorName } from '@/lib/vendor-display'

type Props = {
  row: ShipmentCostRow
  onClose: () => void
  onSaved: () => void
}

function rp(v: number | null | undefined) {
  if (!v) return '-'
  return 'Rp ' + v.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-700 mb-0.5 block">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400 mt-0.5 block">{hint}</span>}
    </label>
  )
}

function AmountField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string | number | null | undefined
  onChange: (value: string | number) => void
  hint?: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,42%)] items-center gap-1 border border-gray-100 px-1 py-0">
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-gray-700">{label}</div>
        {hint && <div className="mt-0.5 text-[10px] leading-tight text-gray-400">{hint}</div>}
      </div>
      <CurrencyInput value={value} onChange={onChange} className={INP} placeholder="0" />
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <div className={`text-xs font-bold uppercase tracking-wide mb-1 border-b pb-0.5 ${color}`}>{title}</div>
      {children}
    </section>
  )
}

const INP = 'w-full px-2 py-1 border border-gray-200 text-sm focus:outline-none focus:border-indigo-400'
const INP_MONO = INP + ' font-mono'

function parseCurrency(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!normalized) return ''
  const number = Number(normalized)
  return Number.isFinite(number) ? number : ''
}

function formatCurrency(value: string | number | null | undefined) {
  if (value === '' || value == null || !Number.isFinite(Number(value))) return ''
  return Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function CurrencyInput({
  value,
  onChange,
  className = INP,
  placeholder = '0,00',
}: {
  value: string | number | null | undefined
  onChange: (value: string | number) => void
  className?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function beginEditing() {
    setEditing(true)
    setDraft(value === '' || value == null ? '' : String(value).replace('.', ','))
  }

  function finishEditing() {
    setEditing(false)
    setDraft('')
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? draft : formatCurrency(value)}
      onFocus={beginEditing}
      onBlur={finishEditing}
      onChange={event => {
        const next = event.target.value.replace(/[^0-9,.]/g, '')
        setDraft(next)
        onChange(parseCurrency(next))
      }}
      className={`${className} text-right tabular-nums`}
      placeholder={placeholder}
    />
  )
}

export default function ShipmentCostInputPanel({ row, onClose, onSaved }: Props) {
  const model = row.cost_model

  const [form, setForm] = useState({
    // common
    payment_voucher_no:  row.payment_voucher_no ?? '',
    invoice_value:       row.invoice_value ?? '',
    // Internal
    bbm_rupiah:          row.bbm_rupiah ?? '',
    bongkar_muat_cost:   row.bongkar_muat_cost ?? '',
    hotel_cost:          row.hotel_cost ?? '',
    uang_makan_driver:   row.uang_makan_driver ?? '',
    uang_makan_helper:   row.uang_makan_helper ?? '',
    toll_cost:           row.toll_cost ?? '',
    parkir_cost:         row.parkir_cost ?? '',
    kirim_paket_cost:    row.kirim_paket_cost ?? '',
    // Retail — Indah Logistik
    no_resi:             row.no_resi ?? '',
    invoice_no_eksternal: row.invoice_no_eksternal ?? '',
    total_biaya_eksternal: row.total_biaya_eksternal ?? '',
    // Trucking — ASSA
    biaya_trucking:      row.biaya_trucking ?? '',
    biaya_tkbm:          row.biaya_tkbm ?? '',
  })
  const [manualTkbm, setManualTkbm] = useState(String(row.biaya_tkbm ?? ''))

  const n = (v: string | number | null | undefined) => {
    if (v === '' || v === null || v === undefined) return null
    const num = Number(v)
    return isNaN(num) ? null : num
  }
  const s = (v: string) => v.trim() || null

  const up = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const biayaTrucking = Number(form.biaya_trucking) || 0
  const biayaTkbm = Number(manualTkbm) || 0

  // Preview total
  const previewTotal = (() => {
    if (model === 'Retail') return n(form.total_biaya_eksternal) ?? 0
    if (model === 'Trucking') return Number(form.biaya_trucking || 0) + Number(manualTkbm || 0)
    // Internal
    const costs: number[] = [
      n(form.bbm_rupiah), n(form.bongkar_muat_cost), n(form.hotel_cost),
      n(form.uang_makan_driver), n(form.uang_makan_helper),
      n(form.toll_cost), n(form.parkir_cost), n(form.kirim_paket_cost),
    ].map(value => value ?? 0)
    return costs.reduce((sum, value) => sum + value, 0)
  })()

  const invoiceValue = n(form.invoice_value) ?? 0
  const previewRatio = model !== 'Internal' && previewTotal > 0 && invoiceValue > 0
    ? ((previewTotal / invoiceValue) * 100).toFixed(1)
    : null

  const [saving, startSaving] = useTransition()
  const [rateLoading, setRateLoading] = useState(false)
  const [rateMessage, setRateMessage] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (model !== 'Trucking' || !row.destination_city || !row.vehicle_type) return
    setRateLoading(true)
    getTruckingRate(row.destination_city, row.vehicle_type, row.transporter_name)
      .then(rate => {
        if (rate != null) {
          setForm(current => ({ ...current, biaya_trucking: rate }))
          setRateMessage(`Rate ${displayVendorName(row.transporter_name) || 'Trucking'}: Rp ${rate.toLocaleString('id-ID')}`)
        } else {
          setRateMessage(`Rate ${displayVendorName(row.transporter_name) || 'Trucking'} tidak ditemukan untuk tujuan dan jenis kendaraan ini.`)
        }
      })
      .catch(() => setRateMessage('Rate ADI SARANA tidak dapat dimuat.'))
      .finally(() => setRateLoading(false))
  }, [model, row.destination_city, row.vehicle_type, row.transporter_name])

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
          bbm_rupiah:           n(form.bbm_rupiah),
          bongkar_muat_cost:    n(form.bongkar_muat_cost),
          hotel_cost:           n(form.hotel_cost),
          uang_makan_driver:    n(form.uang_makan_driver),
          uang_makan_helper:    n(form.uang_makan_helper),
          toll_cost:            n(form.toll_cost),
          parkir_cost:          n(form.parkir_cost),
          kirim_paket_cost:     n(form.kirim_paket_cost),
          // Retail
          no_resi:              s(form.no_resi),
          invoice_no_eksternal: s(form.invoice_no_eksternal),
          total_biaya_eksternal: n(form.total_biaya_eksternal),
          // Trucking
          biaya_trucking:       n(form.biaya_trucking),
          biaya_tkbm:           biayaTkbm,
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
    model === 'Trucking' ? `${displayVendorName(row.transporter_name) || 'Trucking'} (Trucking)` :
    'Internal'

  const modelColor =
    model === 'Retail'   ? 'text-purple-600' :
    model === 'Trucking' ? 'text-orange-600' :
    'text-indigo-600'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden bg-white font-sans text-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
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

        <div className="p-3 space-y-3 overflow-y-auto">

          {/* Info row */}
          <div className="bg-gray-50 p-2 text-xs text-gray-600 grid grid-cols-2 gap-1">
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
                  <CurrencyInput
                    value={form.invoice_value}
                    onChange={value => up('invoice_value', value)}
                    className={INP}
                    placeholder="0,00"
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
                    <CurrencyInput
                    value={form.total_biaya_eksternal}
                      onChange={value => up('total_biaya_eksternal', value)}
                    className={INP}
                      placeholder="0,00"
                  />
                </Field>
              </div>
            </Section>
          )}

          {/* ── TRUCKING — ASSA ── */}
          {model === 'Trucking' && (
            <Section title={`${displayVendorName(row.transporter_name) || 'Trucking'} — Biaya Trucking`} color="text-orange-600">
              <div className="space-y-1">
                <Field label={`No. Invoice ${displayVendorName(row.transporter_name) || 'Trucking'}`}>
                  <input
                    value={form.invoice_no_eksternal}
                    onChange={e => up('invoice_no_eksternal', e.target.value)}
                    className={INP_MONO}
                    placeholder="INV/2026/..."
                  />
                </Field>
                <AmountField
                  label="Biaya Kirim Trucking (Rp)"
                  value={form.biaya_trucking}
                  onChange={value => up('biaya_trucking', value)}
                  hint={rateLoading ? 'Mencari rate...' : rateMessage ?? `Tujuan: ${row.destination_city ?? '-'} · Kendaraan: ${row.vehicle_type ?? '-'}`}
                />
                <AmountField
                  label="Biaya TKBM (Rp)"
                  value={manualTkbm}
                  onChange={value => {
                    setManualTkbm(String(value))
                    setForm(current => ({ ...current, biaya_tkbm: value }))
                  }}
                  hint="Input manual sesuai kwitansi pengirim barang"
                />
              </div>
            </Section>
          )}

          {/* ── INTERNAL ── */}
          {(model === 'Internal' || !model) && (
            <Section title="Internal SRU — Biaya Operasional" color="text-indigo-600">
              <div className="space-y-1">
                <AmountField label="Biaya BBM (Rp)" value={form.bbm_rupiah} onChange={value => up('bbm_rupiah', value)} />
                <AmountField label="Biaya TKBM/SPSI (Rp)" value={form.bongkar_muat_cost} onChange={value => up('bongkar_muat_cost', value)} />
                <AmountField label="Biaya Hotel (Rp)" value={form.hotel_cost} onChange={value => up('hotel_cost', value)} />
                <AmountField label="Biaya Makan Driver (Rp)" value={form.uang_makan_driver} onChange={value => up('uang_makan_driver', value)} />
                <AmountField label="Biaya Makan Helper (Rp)" value={form.uang_makan_helper} onChange={value => up('uang_makan_helper', value)} />
                <AmountField label="Biaya Tol (Rp)" value={form.toll_cost} onChange={value => up('toll_cost', value)} />
                <AmountField label="Biaya Parkir (Rp)" value={form.parkir_cost} onChange={value => up('parkir_cost', value)} />
                <AmountField label="Biaya Kirim Paket (Rp)" value={form.kirim_paket_cost} onChange={value => up('kirim_paket_cost', value)} />
              </div>
            </Section>
          )}

          {/* Preview Total */}
          <div className="flex items-center justify-end gap-3 border border-indigo-100 bg-indigo-50 px-3 py-2 text-right">
            <div className="text-xs font-medium text-indigo-500 whitespace-nowrap">Total Biaya Dikeluarkan</div>
            <div className="text-lg font-bold text-indigo-700 whitespace-nowrap">{rp(previewTotal)}</div>
          </div>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-4 py-2.5 bg-gray-50 shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 border text-sm">Batal</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan Biaya'}
          </button>
        </div>

      </div>
    </div>
  )
}
