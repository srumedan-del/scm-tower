'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ShipmentCostInputPanel from '@/components/shipment/ShipmentCostInputPanel'
import MonthFilter from '@/components/shared/MonthFilter'
import type { ShipmentCostRow } from './actions'
import { computeCostSummary } from './utils'
import { displayVendorName } from '@/lib/vendor-display'
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
}

export default function ShipmentCostTable({
  rows: initialRows,
  months,
  defaultMonth,
  selectedMonth,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ShipmentCostRow[]>(initialRows)
  const [subMenu, setSubMenu] = useState<'maintain' | 'analysis'>('maintain')
  const [activeRow, setActiveRow] = useState<ShipmentCostRow | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const handleSelectMonth = (m: string) => {
    router.push(m === 'all' ? '?month=all' : `?month=${m}`, { scroll: false })
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => {
      const trip = (r.trip_id ?? '').toLowerCase()
      const pss = (r.pss_no ?? (r.crossdocking_id ? `cd-${r.crossdocking_id}` : '')).toLowerCase()
      const cust = (r.customer_name ?? '').toLowerCase()
      const city = (r.destination_city ?? '').toLowerCase()
      const trans = (r.transporter_name ?? '').toLowerCase()
      return trip.includes(q) || pss.includes(q) || cust.includes(q) || city.includes(q) || trans.includes(q)
    })
  }, [rows, search])

  const summary = computeCostSummary(filteredRows)
  const unbudgetedCount = filteredRows.filter((r) => !(r.total_biaya ?? 0)).length

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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit" aria-label="Shipment Cost Submenu">
          <button
            type="button"
            onClick={() => setSubMenu('maintain')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              subMenu === 'maintain'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="h-3.5 w-3.5" /> Maintain Biaya
          </button>
          <button
            type="button"
            onClick={() => setSubMenu('analysis')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              subMenu === 'analysis'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Analisa & Laporan
          </button>
        </nav>

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
