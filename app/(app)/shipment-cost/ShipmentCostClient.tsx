'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/LoadingStates'
import ShipmentCostInputPanel from '@/components/shipment/ShipmentCostInputPanel'
import type { ShipmentCostRow } from './actions'
import { computeCostSummary } from './utils'
import { displayVendorName } from '@/lib/vendor-display'

function rp(value: number | null | undefined) {
  return value ? `Rp ${value.toLocaleString('id-ID')}` : '-'
}

export default function ShipmentCostTable({ rows }: { rows: ShipmentCostRow[] }) {
  const router = useRouter()
  const [subMenu, setSubMenu] = useState<'maintain' | 'analysis'>('maintain')
  const [activeRow, setActiveRow] = useState<ShipmentCostRow | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null)
  const summary = computeCostSummary(rows)
  const emptyRows = rows.filter(row => !(row.total_biaya ?? 0))
  const vendorBills = selectedVendor
    ? rows.filter(row => {
        const notesVendor = row.notes?.match(/(?:^|\|\s*)Vendor:\s*([^|]+)/i)?.[1]?.trim()
        const vendor = displayVendorName(row.transporter_name?.trim() || notesVendor || 'Vendor belum ditentukan')
        return vendor === selectedVendor
      })
    : []

  const columns: DataTableColumn<ShipmentCostRow>[] = [
    { key: 'trip_id', label: 'Trip ID', width: '120px', render: value => <span className="font-mono text-xs font-bold text-blue">{value ?? '-'}</span> },
    { key: 'pss_no', label: 'PSS / CD', width: '130px', render: (value, row) => <span className="font-mono text-xs">{value ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')}</span> },
    { key: 'customer_name', label: 'Customer', render: value => <span className="text-sm">{value ?? '-'}</span> },
    { key: 'destination_city', label: 'Kota Tujuan', render: value => <span className="text-sm">{value ?? '-'}</span> },
    { key: 'dk_lk', label: 'DK/LK', width: '70px', render: value => <span className="text-xs font-bold">{value ?? '-'}</span> },
    { key: 'transporter_type', label: 'INT/EXT', width: '64px', render: (value, row) => <span className="text-xs font-semibold">{value === 'Internal' || /\bsru\b/i.test(row.transporter_name ?? '') ? 'INT' : row.transporter_name ? 'EXT' : '-'}</span> },
    { key: 'transporter_name', label: 'Transporter', render: (value, row) => <span className="text-sm">{displayVendorName(value ?? row.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? '-')}</span> },
    { key: 'total_biaya', label: 'Total Biaya', width: '140px', render: value => <span className="font-mono text-xs font-bold">{rp(value)}</span> },
    { key: 'status', label: 'Status', width: '95px', render: value => <span className="text-xs">{value}</span> },
  ]

  return (
    <>
      {activeRow && <ShipmentCostInputPanel row={activeRow} onClose={() => setActiveRow(null)} onSaved={() => { setActiveRow(null); router.refresh() }} />}

      <nav className="flex gap-1 border-b border-border">
        <button onClick={() => setSubMenu('maintain')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${subMenu === 'maintain' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Maintain Biaya</button>
        <button onClick={() => setSubMenu('analysis')} className={`px-4 py-2 text-sm font-semibold border-b-2 ${subMenu === 'analysis' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Analisa & Laporan</button>
      </nav>

      {subMenu === 'maintain' && (
        <section className="space-y-3">
          {rows.length ? <DataTable data={rows} columns={columns} rowKey="id" onRowClick={setActiveRow} noWrap /> : <EmptyState icon="box" title="Belum ada shipment" description="Belum ada shipment untuk di-maintain biayanya." />}
          {emptyRows.length > 0 && <p className="text-xs text-orange">{emptyRows.length} shipment belum diisi biaya.</p>}
        </section>
      )}

      {subMenu === 'analysis' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReportTable
              title="Analisa Model Vendor"
              rows={Object.entries(summary.byVendor).map(([label, value]) => ({ label, ...value }))}
              onRowClick={setSelectedVendor}
              selectedLabel={selectedVendor}
            />
            <ReportTable title="Analisa per DK / LK" rows={Object.entries(summary.byDkLk).map(([label, value]) => ({ label, ...value }))} />
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
  return <section className="bg-white border border-border rounded-xl overflow-hidden">
    <h2 className="px-4 py-3 text-sm font-bold border-b">{title}</h2>
    <table className="w-full text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="text-left px-4 py-2">Kategori</th><th className="text-right px-4 py-2">Shipment</th><th className="text-right px-4 py-2">Realisasi Biaya</th></tr></thead>
      <tbody className="divide-y divide-border">{rows.map(row => <tr key={row.label} className={selectedLabel === row.label ? 'bg-indigo-50' : ''}>
        <td className="px-4 py-2.5">
          {onRowClick ? <button type="button" onClick={() => onRowClick(row.label)} className="text-left font-medium text-indigo-600 hover:underline">{row.label}</button> : row.label}
        </td>
        <td className="px-4 py-2.5 text-right">{row.count}</td>
        <td className="px-4 py-2.5 text-right font-mono font-medium">{rp(row.total)}</td>
      </tr>)}{!rows.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada data.</td></tr>}</tbody>
    </table>
  </section>
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
  return <section className="bg-white border border-border rounded-xl overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div>
        <h2 className="text-sm font-bold">Tagihan Vendor: {vendor}</h2>
        <p className="text-xs text-gray-500 mt-0.5">Klik shipment untuk membuka detail biaya.</p>
      </div>
      <button type="button" onClick={onClose} className="text-xs text-indigo-600 hover:underline">Tutup</button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="text-left px-4 py-2">Shipment</th><th className="text-left px-4 py-2">Customer</th><th className="text-left px-4 py-2">Tanggal</th><th className="text-right px-4 py-2">Tagihan</th></tr></thead>
        <tbody className="divide-y divide-border">{rows.map(row => <tr key={row.id}>
          <td className="px-4 py-2.5"><button type="button" onClick={() => onRowClick(row)} className="font-mono text-xs text-indigo-600 hover:underline">{row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : row.trip_id ?? '-')}</button></td>
          <td className="px-4 py-2.5">{row.customer_name ?? '-'}</td>
          <td className="px-4 py-2.5 text-xs">{row.document_date ?? '-'}</td>
          <td className="px-4 py-2.5 text-right font-mono font-medium">{rp(row.total_biaya)}</td>
        </tr>)}{!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada tagihan.</td></tr>}</tbody>
      </table>
    </div>
  </section>
}
