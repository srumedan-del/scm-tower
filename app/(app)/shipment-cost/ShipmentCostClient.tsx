'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ShipmentCostInputPanel from '@/components/shipment/ShipmentCostInputPanel'
import MonthFilter from '@/components/shared/MonthFilter'
import type { PodReturnVendorSummary, ShipmentCostRow } from './actions'
import { computeCostSummary } from './utils'
import { displayVendorName } from '@/lib/vendor-display'
import { Tabs } from '@/components/ui/Tabs'
import { Search, X, CheckCircle2, DollarSign, Wallet, FileText, BarChart3 } from 'lucide-react'

function rp(value: number | null | undefined) {
  if (!value) return '-'
  return `Rp ${value.toLocaleString('id-ID')}`
}

type Props = {
  rows: ShipmentCostRow[]
  months: string[]
  defaultMonth: string
  selectedMonth: string
  podReturn: PodReturnVendorSummary[]
}

export default function ShipmentCostTable({
  rows: initialRows,
  months,
  defaultMonth,
  selectedMonth,
  podReturn,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ShipmentCostRow[]>(initialRows)
  // Setelah simpan, router.refresh() membawa data baru (biaya trip bisa pindah ke PSS lain di trip yang sama).
  useEffect(() => { setRows(initialRows) }, [initialRows])
  const [subMenu, setSubMenu] = useState<'maintain' | 'analysis'>('maintain')
  const [activeRow, setActiveRow] = useState<ShipmentCostRow | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const handleSelectMonth = (m: string) => {
    router.push(m === 'all' ? '?month=all' : `?month=${m}`, { scroll: false })
  }

  const filteredRows = useMemo(() => {
    // Urut Trip ID (terbaru di atas, tanpa trip di bawah), lalu PSS/CD naik dalam satu trip.
    const ref = (r: ShipmentCostRow) => r.pss_no ?? (r.crossdocking_id ? `CD-${r.crossdocking_id}` : '')
    const sorted = [...rows].sort((a, b) => {
      if (!a.trip_id !== !b.trip_id) return a.trip_id ? -1 : 1
      const byTrip = (b.trip_id ?? '').localeCompare(a.trip_id ?? '')
      return byTrip || ref(a).localeCompare(ref(b))
    })
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter((r) => {
      const trip = (r.trip_id ?? '').toLowerCase()
      const pss = (r.pss_no ?? (r.crossdocking_id ? `cd-${r.crossdocking_id}` : '')).toLowerCase()
      const cust = (r.customer_name ?? '').toLowerCase()
      const city = (r.destination_city ?? '').toLowerCase()
      const trans = (r.transporter_name ?? '').toLowerCase()
      return trip.includes(q) || pss.includes(q) || cust.includes(q) || city.includes(q) || trans.includes(q)
    })
  }, [rows, search])

  const summary = computeCostSummary(filteredRows)

  const vendorBills = selectedVendor
    ? rows.filter((row) => {
        const notesVendor = row.notes?.match(/(?:^|\|\s*)Vendor:\s*([^|]+)/i)?.[1]?.trim()
        const vendor = displayVendorName(row.transporter_name?.trim() || notesVendor || 'Vendor belum ditentukan')
        return vendor === selectedVendor
      })
    : []

  return (
    <>
      {activeRow && (
        <ShipmentCostInputPanel
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onSaved={(nextRow) => {
            setRows((current) =>
              nextRow ? current.map((row) => (row.id === nextRow.id ? nextRow : row)) : current
            )
            setActiveRow(null)
            router.refresh()
          }}
        />
      )}

      {/* ── Toolbar: Submenu Tabs & Month Filter ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
        <Tabs
          label="Shipment Cost Submenu"
          value={subMenu}
          onChange={setSubMenu}
          items={[
            { value: 'maintain', label: 'Maintain Biaya', icon: Wallet },
            { value: 'analysis', label: 'Analisa & Laporan', icon: BarChart3 },
          ]}
        />

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Trip, PSS, Customer..."
              className="w-48 sm:w-60 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-7 text-xs font-medium text-slate-800 shadow-2xs outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Month Filter */}
          {months.length > 0 && (
            <MonthFilter
              months={months}
              selectedMonth={selectedMonth}
              defaultMonth={defaultMonth}
              onSelectMonth={handleSelectMonth}
            />
          )}
        </div>
      </div>

      {/* ── Submenu 1: Maintain Biaya ── */}
      {/* Ringkasan satu baris: label · nilai · jumlah shipment */}
      <section aria-label="Ringkasan biaya" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total biaya', value: summary.totalBiaya, note: `${summary.totalShipment} shipment`, strong: true },
          ...(['Internal', 'Trucking', 'Retail'] as const).map(model => {
            const modelRows = filteredRows.filter(row => (row.cost_model ?? 'Internal') === model)
            return { label: model, value: modelRows.reduce((sum, row) => sum + (row.total_biaya ?? 0), 0), note: `${modelRows.length} shipment`, strong: false }
          }),
        ].map(card => (
          <div key={card.label} className={`flex items-baseline gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 ${card.strong ? 'border-indigo-900 bg-indigo-900 text-white' : 'border-slate-200 bg-white'}`}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${card.strong ? 'text-gold-300' : 'text-slate-500'}`}>{card.label}</span>
            <span className={`font-mono text-base font-bold ${card.strong ? 'text-white' : 'text-slate-900'}`}>{rp(card.value)}</span>
            <span className={`ml-auto text-xs ${card.strong ? 'text-slate-300' : 'text-slate-500'}`}>{card.note}</span>
          </div>
        ))}
      </section>

      {subMenu === 'maintain' && (
        <section className="space-y-3 font-sans">


          {/* Tabel Standardized */}
          <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-10rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-[14px] text-left min-w-[1000px] font-sans">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">
                    Trip ID
                  </th>
                  <th className="px-4 py-3.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">
                    PSS / CD
                  </th>
                  <th className="px-4 py-3.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800">
                    Customer
                  </th>
                  <th className="px-4 py-3.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">
                    Kota Tujuan
                  </th>
                  <th className="px-4 py-3.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-20">
                    DK/LK
                  </th>
                  <th className="px-4 py-3.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-20">
                    INT/EXT
                  </th>
                  <th className="px-4 py-3.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-44">
                    Transporter
                  </th>
                  <th className="px-4 py-3.5 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">
                    Total Biaya
                  </th>
                  <th className="px-4 py-3.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-28">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const pssLabel = row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')
                  const isInternal =
                    row.cost_model === 'Internal' ||
                    row.transporter_type === 'Internal' ||
                    /\bsru\b/i.test(row.transporter_name ?? '')
                  const transporterDisplay = displayVendorName(
                    row.transporter_name ?? row.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? '-'
                  )

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setActiveRow(row)}
                      className="group transition-colors hover:bg-slate-50/80 cursor-pointer"
                    >
                      {/* Trip ID */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[14px] font-bold text-indigo-600">
                        {row.trip_id ?? '-'}
                      </td>

                      {/* PSS / CD */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[14px] font-semibold text-slate-800">
                        {pssLabel}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5 max-w-[260px] truncate font-medium text-slate-800 text-[14px]" title={row.customer_name ?? ''}>
                        {row.customer_name ?? '-'}
                      </td>

                      {/* Kota Tujuan */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[14px] font-medium text-slate-700">
                        {row.destination_city ?? '-'}
                      </td>

                      {/* DK/LK */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="font-semibold text-[14px] text-slate-700">
                          {row.dk_lk ?? '-'}
                        </span>
                      </td>

                      {/* INT/EXT */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isInternal
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isInternal ? 'INT' : 'EXT'}
                        </span>
                      </td>

                      {/* Transporter */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[14px] font-medium text-slate-700 truncate max-w-[180px]">
                        {transporterDisplay}
                      </td>

                      {/* Total Biaya */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono text-[14px] font-bold text-slate-900">
                        {row.total_biaya ? (
                          <span className="text-emerald-700">{rp(row.total_biaya)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] font-bold text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      {search ? (
                        <div>Tidak ada shipment yang cocok dengan pencarian &quot;{search}&quot;.</div>
                      ) : (
                        <div>Tidak ada data shipment berstatus Delivered untuk periode ini.</div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Submenu 2: Analisa & Laporan ── */}
      {subMenu === 'analysis' && (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReportTable
              title="Analisa Model Vendor"
              rows={Object.entries(summary.byVendor).map(([label, value]) => ({ label, ...value }))}
              onRowClick={setSelectedVendor}
              selectedLabel={selectedVendor}
            />
            <ReportTable
              title="Analisa per DK / LK"
              rows={Object.entries(summary.byDkLk).map(([label, value]) => ({ label, ...value }))}
            />
          </div>

          <PodReturnCard rows={podReturn} />

          {selectedVendor && (
            <VendorBills
              vendor={selectedVendor}
              rows={vendorBills}
              onClose={() => setSelectedVendor(null)}
              onRowClick={setActiveRow}
            />
          )}
        </div>
      )}
    </>
  )
}

const fmtDays = (value: number | null) => (value == null ? '-' : `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`)

/** Lama dokumen POD kembali dari vendor ekspedisi, hari kerja, target 2 x leadtime + 0,5 hari. */
function PodReturnCard({ rows }: { rows: PodReturnVendorSummary[] }) {
  const th = 'px-4 py-3 text-[13px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap'
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-[14px] font-bold uppercase tracking-wider text-slate-800">POD Kembali per Vendor</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Hari kerja dari serah barang + dokumen ke vendor sampai dokumen POD diterima di SRU. Target ideal 2 × leadtime + ½ hari
          (leadtime rate card vendor, atau SLA DK 1 / LK 5 hari bila kosong).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50/60">
            <tr>
              <th className={`${th} text-left`}>Vendor</th>
              <th className={`${th} text-right`}>Shipment</th>
              <th className={`${th} text-right`}>POD Kembali</th>
              <th className={`${th} text-right`}>Rata-rata Aktual</th>
              <th className={`${th} text-right`}>Rata-rata Target</th>
              <th className={`${th} text-right`}>Tepat Waktu</th>
              <th className={`${th} text-right`}>Belum Kembali</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const pct = row.returned ? Math.round((row.onTime / row.returned) * 100) : null
              const late = row.avgActualDays != null && row.avgIdealDays != null && row.avgActualDays > row.avgIdealDays
              return (
                <tr key={row.vendor} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.vendor}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.shipments}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.returned}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${late ? 'text-rose-700' : 'text-slate-900'}`}>{fmtDays(row.avgActualDays)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmtDays(row.avgIdealDays)}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {pct == null ? <span className="text-slate-400">-</span> : (
                      <span className={pct >= 90 ? 'font-bold text-emerald-700' : pct >= 70 ? 'font-bold text-amber-700' : 'font-bold text-rose-700'}>
                        {pct}% <span className="font-normal text-slate-500">({row.onTime}/{row.returned})</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                    {row.pending}
                    {row.overdue > 0 && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">{row.overdue} lewat target</span>}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Belum ada shipment vendor ekspedisi pada periode ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReportTable({
  title,
  rows,
  onRowClick,
  selectedLabel,
}: {
  title: string
  rows: { label: string; count: number; total: number }[]
  onRowClick?: (label: string) => void
  selectedLabel?: string | null
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      <h2 className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border-b border-slate-200">
        {title}
      </h2>
      <table className="w-full text-[14px] text-left">
        <thead className="border-b border-slate-200 bg-slate-50/60">
          <tr>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
              Kategori
            </th>
            <th className="px-4 py-3 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
              Shipment
            </th>
            <th className="px-4 py-3 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
              Realisasi Biaya
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`transition-colors hover:bg-slate-50 ${
                selectedLabel === row.label ? 'bg-indigo-50/60 font-semibold' : ''
              }`}
            >
              <td className="px-4 py-3 text-[14px] font-medium text-slate-700">
                {onRowClick ? (
                  <button
                    type="button"
                    onClick={() => onRowClick(row.label)}
                    className="text-left font-semibold text-indigo-600 hover:underline"
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </td>
              <td className="px-4 py-3 text-[14px] font-medium text-right text-slate-700">{row.count}</td>
              <td className="px-4 py-3 text-[14px] font-mono font-bold text-right text-slate-900">{rp(row.total)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function VendorBills({
  vendor,
  rows,
  onClose,
  onRowClick,
}: {
  vendor: string
  rows: ShipmentCostRow[]
  onClose: () => void
  onRowClick: (row: ShipmentCostRow) => void
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div>
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-slate-800">Tagihan Vendor: {vendor}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Klik baris shipment untuk membuka modal rincian biaya.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Tutup
        </button>
      </div>
      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-14rem)] overflow-auto">
        <table className="w-full text-[14px] text-left">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                Shipment
              </th>
              <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                Tanggal
              </th>
              <th className="px-4 py-3 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                Tagihan
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-[14px] font-mono font-bold text-indigo-600">
                  {row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : row.trip_id ?? '-')}
                </td>
                <td className="px-4 py-3 text-[14px] font-medium text-slate-800">{row.customer_name ?? '-'}</td>
                <td className="px-4 py-3 text-[14px] font-medium text-slate-600">{row.document_date ?? '-'}</td>
                <td className="px-4 py-3 text-[14px] font-mono font-bold text-right text-slate-900">{rp(row.total_biaya)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Belum ada tagihan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
