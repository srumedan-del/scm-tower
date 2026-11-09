'use client'

import { DialogShell, DialogHeader, dialogFooterClass, dialogCancelClass, dialogPrimaryClass } from '@/components/ui/FormDialog'
import { useEffect, useState, useTransition } from 'react'
import {
  getTruckingRate,
  upsertShipmentCost,
  getShipmentCostTripItems,
  type ShipmentCostRow,
  type TripSiblingItem,
} from '@/app/(app)/shipment-cost/actions'
import { displayVendorName } from '@/lib/vendor-display'
import { Plus, Trash2, Fuel, Truck, Gauge, Building2, MapPin, Wallet } from 'lucide-react'
import { showSuccess } from '@/lib/feedback'

type Props = {
  row: ShipmentCostRow
  onClose: () => void
  onSaved: (nextRow?: ShipmentCostRow) => void
}

const HARGA_BBM_PER_LITER = 6800

function rp(v: number | null | undefined) {
  if (!v) return 'Rp 0'
  return 'Rp ' + Number(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function parseCurrency(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!normalized) return ''
  const number = Number(normalized)
  return Number.isFinite(number) ? number : ''
}

function formatCurrency(value: string | number | null | undefined) {
  if (value === '' || value == null || !Number.isFinite(Number(value))) return ''
  return Number(value).toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function CurrencyInput({
  value,
  onChange,
  className = '',
  placeholder = '0',
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
    const next = value === '' || value == null ? '' : String(value).replace(/\./g, ',')
    setDraft(next)
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
      onChange={(event) => {
        const raw = event.target.value
        const next = raw.replace(/[^0-9,.]/g, '')
        setDraft(next)
        onChange(parseCurrency(next))
      }}
      className={`rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all text-right tabular-nums ${className}`}
      placeholder={placeholder}
    />
  )
}

type BbmEntry = {
  id: string
  label: string
  odometer: string
  liter: number | string
  amount: number
}

type TkbmEntry = {
  id: string | number
  pss_no: string
  customer_name?: string
  destination_city?: string
  amount: number
  is_sibling?: boolean
}

export default function ShipmentCostInputPanel({ row, onClose, onSaved }: Props) {
  const model = row.cost_model

  const [form, setForm] = useState({
    payment_voucher_no: row.payment_voucher_no ?? '',
    invoice_value: row.invoice_value ?? '',
    hotel_cost: row.hotel_cost ?? '',
    uang_makan_driver: row.uang_makan_driver ?? '',
    uang_makan_helper: row.uang_makan_helper ?? '',
    toll_cost: row.toll_cost ?? '',
    parkir_cost: row.parkir_cost ?? '',
    kirim_paket_cost: row.kirim_paket_cost ?? '',
    no_resi: row.no_resi ?? '',
    invoice_no_eksternal: row.invoice_no_eksternal ?? '',
    total_biaya_eksternal: row.total_biaya_eksternal ?? '',
    biaya_trucking: row.biaya_trucking ?? '',
  })

  // ── BBM Multi-Entry State ──
  const [bbmEntries, setBbmEntries] = useState<BbmEntry[]>([])

  // ── TKBM Multi-PSS State ──
  const [tkbmEntries, setTkbmEntries] = useState<TkbmEntry[]>([])
  const [loadingTripItems, setLoadingTripItems] = useState(false)

  // Inisialisasi BBM dan TKBM dari data yang ada
  useEffect(() => {
    let parsedNotes: any = null
    if (row.misc_cost_notes) {
      try {
        parsedNotes = JSON.parse(row.misc_cost_notes)
      } catch {
        parsedNotes = null
      }
    }

    // Inisialisasi BBM
    if (parsedNotes?.bbm_items && Array.isArray(parsedNotes.bbm_items) && parsedNotes.bbm_items.length > 0) {
      setBbmEntries(
        parsedNotes.bbm_items.map((b: any, idx: number) => {
          const amt = Number(b.amount) || 0
          const lit = b.liter !== undefined && b.liter !== null && b.liter !== ''
            ? b.liter
            : amt ? Number((amt / HARGA_BBM_PER_LITER).toFixed(2)) : ''
          return {
            id: String(b.id || idx + 1),
            label: b.label || `Pengisian ${idx + 1}`,
            odometer: b.odometer ? String(b.odometer) : '',
            liter: lit,
            amount: amt,
          }
        })
      )
    } else {
      const initialRupiah = Number(row.bbm_rupiah) || 0
      const initialLiter = row.bbm_liter != null && row.bbm_liter > 0
        ? row.bbm_liter
        : initialRupiah ? Number((initialRupiah / HARGA_BBM_PER_LITER).toFixed(2)) : ''
      setBbmEntries([
        {
          id: '1',
          label: 'Pengisian 1',
          odometer: '',
          liter: initialLiter,
          amount: initialRupiah,
        },
      ])
    }

    // Inisialisasi TKBM per PSS / Surat Jalan
    setLoadingTripItems(true)
    const tripId = row.trip_id
    if (tripId) {
      getShipmentCostTripItems(tripId)
        .then((siblings) => {
          if (siblings.length > 0) {
            setTkbmEntries(
              siblings.map((s) => {
                const isCurrent = s.id === row.id
                const amount = isCurrent
                  ? Number(row.bongkar_muat_cost || row.biaya_tkbm || 0)
                  : Number(s.bongkar_muat_cost || s.biaya_tkbm || 0)
                return {
                  id: s.id,
                  pss_no: s.pss_no || '-',
                  customer_name: s.customer_name || '-',
                  destination_city: s.destination_city || '-',
                  amount,
                  is_sibling: true,
                }
              })
            )
          } else {
            fallbackTkbm()
          }
        })
        .catch(() => fallbackTkbm())
        .finally(() => setLoadingTripItems(false))
    } else {
      fallbackTkbm()
      setLoadingTripItems(false)
    }

    function fallbackTkbm() {
      const initialTkbm = Number(row.bongkar_muat_cost || row.biaya_tkbm || 0)
      setTkbmEntries([
        {
          id: row.id,
          pss_no: row.pss_no || (row.crossdocking_id ? `CD-${row.crossdocking_id}` : 'Surat Jalan 1'),
          customer_name: row.customer_name || undefined,
          destination_city: row.destination_city || undefined,
          amount: initialTkbm,
          is_sibling: true,
        },
      ])
    }
  }, [row])

  // Hitung total BBM (Liter dan Rupiah)
  const totalBbmLiter = bbmEntries.reduce((sum, item) => sum + (Number(item.liter) || 0), 0)
  const totalBbmRupiah = bbmEntries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // Hitung total TKBM
  const totalTkbm = tkbmEntries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // Handler BBM
  const addBbmEntry = () => {
    setBbmEntries((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        label: `Pengisian ${prev.length + 1}`,
        odometer: '',
        liter: '',
        amount: 0,
      },
    ])
  }

  const updateBbmLabel = (index: number, val: string) => {
    setBbmEntries((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], label: val }
      return copy
    })
  }

  const handleBbmOdometerChange = (index: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, '')
    setBbmEntries((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], odometer: clean }
      return copy
    })
  }

  const handleBbmLiterChange = (index: number, val: string) => {
    // Bersihkan karakter selain angka, titik, koma
    const cleaned = val.replace(/[^0-9.,]/g, '')
    // Konversi koma ke titik untuk perhitungan internal
    const normalized = cleaned.replace(/,/g, '.')
    // Batasi hanya 1 titik desimal
    const parts = normalized.split('.')
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized

    if (sanitized === '' || sanitized === '.') {
      setBbmEntries((prev) => {
        const copy = [...prev]
        copy[index] = { ...copy[index], liter: sanitized, amount: 0 }
        return copy
      })
      return
    }

    const num = parseFloat(sanitized)
    const validNum = Number.isFinite(num) && num >= 0 ? num : 0
    const calculatedAmount = Math.round(validNum * HARGA_BBM_PER_LITER)
    setBbmEntries((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], liter: sanitized, amount: calculatedAmount }
      return copy
    })
  }

  const handleBbmAmountChange = (index: number, val: string | number) => {
    const num = Number(val) || 0
    const calculatedLiter = num > 0 ? Number((num / HARGA_BBM_PER_LITER).toFixed(2)) : ''
    setBbmEntries((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], amount: num, liter: calculatedLiter }
      return copy
    })
  }

  const removeBbmEntry = (index: number) => {
    if (bbmEntries.length <= 1) return
    setBbmEntries((prev) => prev.filter((_, i) => i !== index))
  }

  // Handler TKBM
  const addTkbmEntry = () => {
    setTkbmEntries((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        pss_no: `PSS Tambahan ${prev.length + 1}`,
        amount: 0,
        is_sibling: false,
      },
    ])
  }

  const updateTkbmEntry = (index: number, key: keyof TkbmEntry, val: any) => {
    setTkbmEntries((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [key]: val }
      return copy
    })
  }

  const removeTkbmEntry = (index: number) => {
    if (tkbmEntries.length <= 1) return
    setTkbmEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const n = (v: string | number | null | undefined) => {
    if (v === '' || v === null || v === undefined) return null
    const num = Number(v)
    return isNaN(num) ? null : num
  }
  const s = (v: string) => v.trim() || null

  const up = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Hitung preview total biaya
  const previewTotal = (() => {
    if (model === 'Retail') return n(form.total_biaya_eksternal) ?? 0
    if (model === 'Trucking') return (Number(form.biaya_trucking) || 0) + totalTkbm
    // Internal
    const costs: number[] = [
      totalBbmRupiah,
      totalTkbm,
      n(form.hotel_cost),
      n(form.uang_makan_driver),
      n(form.uang_makan_helper),
      n(form.toll_cost),
      n(form.parkir_cost),
      n(form.kirim_paket_cost),
    ].map((value) => value ?? 0)
    return costs.reduce((sum, value) => sum + value, 0)
  })()

  const [saving, startSaving] = useTransition()
  const [rateLoading, setRateLoading] = useState(false)
  const [rateMessage, setRateMessage] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (model !== 'Trucking' || !row.destination_city || !row.vehicle_type) return
    setRateLoading(true)
    getTruckingRate(row.destination_city, row.vehicle_type, row.transporter_name)
      .then((rate) => {
        if (rate != null) {
          setForm((current) => ({ ...current, biaya_trucking: rate }))
          setRateMessage(`Rate ${displayVendorName(row.transporter_name) || 'Trucking'}: Rp ${rate.toLocaleString('id-ID')}`)
        } else {
          setRateMessage(`Rate ${displayVendorName(row.transporter_name) || 'Trucking'} tidak ditemukan untuk rute ini.`)
        }
      })
      .catch(() => setRateMessage('Rate tidak dapat dimuat.'))
      .finally(() => setRateLoading(false))
  }, [model, row.destination_city, row.vehicle_type, row.transporter_name])

  function save() {
    startSaving(async () => {
      setErr(null)
      try {
        const effectiveCostModel =
          model === 'Retail' ? 'Retail' : model === 'Trucking' ? 'Trucking' : 'Internal'

        // Serialize BBM dan TKBM breakdown ke misc_cost_notes
        const notesPayload = JSON.stringify({
          bbm_items: bbmEntries.map((b) => ({
            label: b.label,
            odometer: b.odometer ? String(b.odometer).trim() : '',
            liter: Number(b.liter) || 0,
            amount: Number(b.amount) || 0,
          })),
          tkbm_items: tkbmEntries.map((t) => ({
            id: t.id,
            pss_no: t.pss_no,
            amount: Number(t.amount) || 0,
          })),
        })

        // Filter sibling updates jika ID numerik
        const siblingTkbm = tkbmEntries
          .filter((t) => typeof t.id === 'number')
          .map((t) => ({ id: Number(t.id), tkbm: Number(t.amount) || 0 }))

        // Cari tkbm untuk row ini
        const currentRowTkbm =
          tkbmEntries.find((t) => t.id === row.id)?.amount ?? totalTkbm

        await upsertShipmentCost({
          id: row.id,
          cost_model: effectiveCostModel,
          payment_voucher_no: s(form.payment_voucher_no),
          invoice_value: n(form.invoice_value),
          // Internal
          bbm_liter: totalBbmLiter,
          bbm_rupiah: totalBbmRupiah,
          bongkar_muat_cost: currentRowTkbm,
          hotel_cost: n(form.hotel_cost),
          uang_makan_driver: n(form.uang_makan_driver),
          uang_makan_helper: n(form.uang_makan_helper),
          toll_cost: n(form.toll_cost),
          parkir_cost: n(form.parkir_cost),
          kirim_paket_cost: n(form.kirim_paket_cost),
          misc_cost_notes: notesPayload,
          // Retail
          no_resi: s(form.no_resi),
          invoice_no_eksternal: s(form.invoice_no_eksternal),
          total_biaya_eksternal: n(form.total_biaya_eksternal),
          // Trucking
          biaya_trucking: n(form.biaya_trucking),
          biaya_tkbm: currentRowTkbm,
          // Sibling TKBM updates
          sibling_tkbm: siblingTkbm,
        })

        const nextRow: ShipmentCostRow = {
          ...row,
          payment_voucher_no: s(form.payment_voucher_no),
          invoice_value: n(form.invoice_value),
          bbm_liter: totalBbmLiter,
          bbm_rupiah: totalBbmRupiah,
          bongkar_muat_cost: currentRowTkbm,
          hotel_cost: n(form.hotel_cost),
          uang_makan_driver: n(form.uang_makan_driver),
          uang_makan_helper: n(form.uang_makan_helper),
          toll_cost: n(form.toll_cost),
          parkir_cost: n(form.parkir_cost),
          kirim_paket_cost: n(form.kirim_paket_cost),
          misc_cost_notes: notesPayload,
          no_resi: s(form.no_resi),
          invoice_no_eksternal: s(form.invoice_no_eksternal),
          total_biaya_eksternal: n(form.total_biaya_eksternal),
          biaya_trucking: n(form.biaya_trucking),
          biaya_tkbm: currentRowTkbm,
          cost_model: effectiveCostModel,
          total_biaya: previewTotal,
        }

        onClose()
        void showSuccess({ title: 'Biaya shipment tersimpan', details: [{ label: 'Total biaya', value: rp(previewTotal) }] }).then(() => onSaved(nextRow))
      } catch (e: any) {
        setErr(e.message || 'Gagal menyimpan biaya.')
      }
    })
  }

  const modelLabel =
    model === 'Retail'
      ? 'Indah Logistik (Retail)'
      : model === 'Trucking'
      ? `${displayVendorName(row.transporter_name) || 'Trucking'} (Trucking)`
      : 'Internal SRU'

  const modelBadgeClass =
    model === 'Retail'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : model === 'Trucking'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-indigo-50 text-indigo-700 border-indigo-200'

  return (
    <DialogShell onClose={onClose} size="4xl">
      <DialogHeader
        title="Input Biaya Shipment"
        icon={Wallet}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-600">{row.trip_id ?? '-'}</span>
            <span className="font-mono text-xs font-semibold text-slate-700">{row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')}</span>
            <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${modelBadgeClass}`}>{modelLabel}</span>
          </span>
        }
      />

        {/* ── Modal Body (Dense & Compact Spacing) ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* Info Ringkas + No. Payment Voucher (1 Baris Terintegrasi) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Customer:</span>
                <strong className="font-semibold text-slate-800">{row.customer_name ?? '-'}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Tujuan:</span>
                <strong className="font-semibold text-slate-800">{row.destination_city ?? '-'} ({row.dk_lk ?? '-'})</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Transporter:</span>
                <strong className="font-semibold text-slate-800">{displayVendorName(row.transporter_name) || '-'}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">No. Voucher:</span>
              <input
                type="text"
                value={form.payment_voucher_no}
                onChange={(e) => up('payment_voucher_no', e.target.value)}
                placeholder="K-MDN-B-2609-001"
                className="w-44 sm:w-52 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200"
              />
              {model !== 'Internal' && model && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Invoice:</span>
                  <CurrencyInput
                    value={form.invoice_value}
                    onChange={(v) => up('invoice_value', v)}
                    placeholder="0"
                    className="w-28 !py-1 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── INTERNAL: PENGISIAN BBM (BISA LEBIH DARI 1X) — 1 BARIS KOMPAK PER PENGISIAN ── */}
          {(model === 'Internal' || !model) && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Pengisian BBM (Bisa Lebih Dari 1x)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    · Otomatis: <strong>Liter × Rp 6.800</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addBbmEntry}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Tambah Pengisian
                </button>
              </div>

              {/* Header Kolom BBM */}
              <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 pt-0.5">
                <div className="col-span-3">Keterangan / SPBU</div>
                <div className="col-span-3">Odometer (KM)</div>
                <div className="col-span-2 text-right">Jumlah Liter</div>
                <div className="col-span-3 text-right">Jumlah Rupiah (@ 6.800)</div>
                <div className="col-span-1 text-center"></div>
              </div>

              {/* Daftar Pengisian BBM (1 baris per pengisian) */}
              <div className="space-y-1.5">
                {bbmEntries.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg border border-slate-100 bg-slate-50/50 p-1.5 transition-all"
                  >
                    {/* Keterangan */}
                    <div className="sm:col-span-3 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateBbmLabel(index, e.target.value)}
                        placeholder={`Pengisian ${index + 1}`}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Odometer (KM) */}
                    <div className="sm:col-span-3 relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.odometer}
                        onChange={(e) => handleBbmOdometerChange(index, e.target.value)}
                        placeholder="Odometer KM"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 pr-8 font-mono text-xs font-semibold text-slate-800 text-right focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        KM
                      </span>
                    </div>

                    {/* Jumlah Liter */}
                    <div className="sm:col-span-2 relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.liter}
                        onChange={(e) => handleBbmLiterChange(index, e.target.value)}
                        placeholder="Contoh: 61.18"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 pr-6 font-mono text-xs font-semibold text-slate-800 text-right focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        L
                      </span>
                    </div>

                    {/* Jumlah Rupiah */}
                    <div className="sm:col-span-3">
                      <CurrencyInput
                        value={item.amount}
                        onChange={(val) => handleBbmAmountChange(index, val)}
                        placeholder="0"
                        className="w-full !py-1 text-xs font-mono font-semibold"
                      />
                    </div>

                    {/* Aksi Hapus */}
                    <div className="sm:col-span-1 flex justify-center">
                      {bbmEntries.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeBbmEntry(index)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Hapus baris pengisian ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="w-6" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal BBM */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs">
                <div className="text-slate-500 text-[11px]">
                  Total BBM ({bbmEntries.length}x isi):{' '}
                  <strong className="text-slate-700 font-mono">
                    {totalBbmLiter > 0 ? `${totalBbmLiter.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Liter` : '0 Liter'}
                  </strong>
                </div>
                <div className="font-mono text-xs font-bold text-indigo-700">
                  Subtotal BBM: {rp(totalBbmRupiah)}
                </div>
              </div>
            </div>
          )}

          {/* ── BIAYA TKBM / SPSI PER PSS ATAU SURAT JALAN ── */}
          {(model === 'Internal' || model === 'Trucking' || !model) && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Biaya TKBM / SPSI per PSS / Surat Jalan
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addTkbmEntry}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Tambah Surat Jalan
                </button>
              </div>

              {loadingTripItems ? (
                <div className="py-2 text-center text-xs text-slate-400">Memuat data surat jalan dalam shipment...</div>
              ) : (
                <div className="space-y-1.5">
                  {tkbmEntries.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-1.5"
                    >
                      <div className="flex-1 min-w-0">
                        {item.is_sibling ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 shrink-0">{item.pss_no}</span>
                            <span className="text-[11px] text-slate-500 truncate">
                              {item.customer_name ?? ''} {item.destination_city ? `(${item.destination_city})` : ''}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={item.pss_no}
                            onChange={(e) => updateTkbmEntry(index, 'pss_no', e.target.value)}
                            placeholder="Nomor PSS / Surat Jalan"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                          />
                        )}
                      </div>
                      <div className="w-40 shrink-0">
                        <CurrencyInput
                          value={item.amount}
                          onChange={(val) => updateTkbmEntry(index, 'amount', Number(val) || 0)}
                          placeholder="0"
                          className="w-full !py-1 text-xs font-semibold"
                        />
                      </div>
                      {!item.is_sibling && (
                        <button
                          type="button"
                          onClick={() => removeTkbmEntry(index)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs">
                <span className="text-[11px] font-semibold text-slate-500">Total TKBM ({tkbmEntries.length} SJ):</span>
                <span className="font-mono text-xs font-bold text-slate-900">{rp(totalTkbm)}</span>
              </div>
            </div>
          )}

          {/* ── BIAYA OPERASIONAL LAINNYA (INTERNAL) — 3 KOLOM KOMPAK ── */}
          {(model === 'Internal' || !model) && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="border-b border-slate-100 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Biaya Operasional Lainnya
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Biaya Hotel (Rp)</label>
                  <CurrencyInput
                    value={form.hotel_cost}
                    onChange={(v) => up('hotel_cost', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Biaya Tol (Rp)</label>
                  <CurrencyInput
                    value={form.toll_cost}
                    onChange={(v) => up('toll_cost', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Makan Driver (Rp)</label>
                  <CurrencyInput
                    value={form.uang_makan_driver}
                    onChange={(v) => up('uang_makan_driver', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Makan Helper (Rp)</label>
                  <CurrencyInput
                    value={form.uang_makan_helper}
                    onChange={(v) => up('uang_makan_helper', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Biaya Parkir (Rp)</label>
                  <CurrencyInput
                    value={form.parkir_cost}
                    onChange={(v) => up('parkir_cost', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Kirim Paket (Rp)</label>
                  <CurrencyInput
                    value={form.kirim_paket_cost}
                    onChange={(v) => up('kirim_paket_cost', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TRUCKING (SEWA VENDOR) ── */}
          {model === 'Trucking' && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="border-b border-slate-100 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Biaya Sewa Trucking
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">No. Invoice Vendor</label>
                  <input
                    type="text"
                    value={form.invoice_no_eksternal}
                    onChange={(e) => up('invoice_no_eksternal', e.target.value)}
                    placeholder="INV/2026/..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Biaya Kirim Trucking (Rp)</label>
                  <CurrencyInput
                    value={form.biaya_trucking}
                    onChange={(v) => up('biaya_trucking', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                  {rateMessage && <p className="mt-1 text-[11px] text-slate-500">{rateMessage}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── RETAIL (INDAH LOGISTIK) ── */}
          {model === 'Retail' && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="border-b border-slate-100 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Indah Logistik — Pengiriman Retail
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">No. Resi</label>
                  <input
                    type="text"
                    value={form.no_resi}
                    onChange={(e) => up('no_resi', e.target.value)}
                    placeholder="ILP-2609-XXXXX"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">No. Invoice</label>
                  <input
                    type="text"
                    value={form.invoice_no_eksternal}
                    onChange={(e) => up('invoice_no_eksternal', e.target.value)}
                    placeholder="INV/ILP/2026/..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Total Biaya Kirim (Rp)</label>
                  <CurrencyInput
                    value={form.total_biaya_eksternal}
                    onChange={(v) => up('total_biaya_eksternal', v)}
                    className="w-full !py-1 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">{err}</div>}
        </div>

        {/* ── Modal Footer with Live Total (Always Visible) ── */}
        <div className={dialogFooterClass}>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Biaya:</span>
            <span className="text-base sm:text-lg font-bold font-mono text-indigo-700">{rp(previewTotal)}</span>
            <span className="hidden sm:inline text-[11px] text-slate-400">
              (BBM: {rp(totalBbmRupiah)} · TKBM: {rp(totalTkbm)})
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={dialogCancelClass}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={dialogPrimaryClass}
            >
              {saving ? 'Menyimpan…' : 'Simpan Biaya'}
            </button>
          </div>
        </div>
    </DialogShell>
  )
}
