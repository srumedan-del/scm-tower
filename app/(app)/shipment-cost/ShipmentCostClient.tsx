'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/LoadingStates'
import ShipmentCostInputPanel from '@/components/shipment/ShipmentCostInputPanel'
import type { ShipmentCostRow } from './actions'

function rp(v: number | null | undefined) {
  if (v == null || v === 0) return '-'
  return 'Rp ' + v.toLocaleString('id-ID')
}

function OtdBadge({ v }: { v: boolean | null }) {
  if (v === null) return <span className="text-xs text-muted">—</span>
  return v
    ? <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-green/10 text-green">On Time</span>
    : <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-red/10 text-red">Late</span>
}

function CostRatioBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs text-muted">—</span>
  const cls = v > 20 ? 'red' : v > 10 ? 'orange' : 'green'
  return <span className={`text-xs font-bold rounded-full px-2.5 py-1 bg-${cls}/10 text-${cls}`}>{v.toFixed(1)}%</span>
}

function CostDetail({ r }: { r: ShipmentCostRow }) {
  if (r.cost_model === 'Retail') {
    const items = [
      r.no_resi && `Resi: ${r.no_resi}`,
      r.total_biaya_eksternal && `Biaya Kirim: ${rp(r.total_biaya_eksternal)}`,
    ].filter(Boolean)
    return items.length ? <div className="text-xs text-muted space-y-0.5">{items.map((t, i) => <div key={i}>{t}</div>)}</div> : <span className="text-muted">Belum diisi</span>
  }

  if (r.cost_model === 'Trucking') {
    const items = [
      r.biaya_trucking && `Trucking: ${rp(r.biaya_trucking)}`,
      r.biaya_tkbm && `TKBM: ${rp(r.biaya_tkbm)}`,
    ].filter(Boolean)
    return items.length ? <div className="text-xs text-muted space-y-0.5">{items.map((t, i) => <div key={i}>{t}</div>)}</div> : <span className="text-muted">Belum diisi</span>
  }

  const items = [
    r.bbm_rupiah && `BBM: ${rp(r.bbm_rupiah)}`,
    r.bongkar_muat_cost && `Bongkar: ${rp(r.bongkar_muat_cost)}`,
    r.hotel_cost && `Hotel: ${rp(r.hotel_cost)}`,
    r.uang_makan_driver && `Makan: ${rp(r.uang_makan_driver)}`,
    r.toll_cost && `Tol: ${rp(r.toll_cost)}`,
    r.parkir_cost && `Parkir: ${rp(r.parkir_cost)}`,
    r.kirim_paket_cost && `Paket: ${rp(r.kirim_paket_cost)}`,
    r.misc_cost && `Lain: ${rp(r.misc_cost)}`,
  ].filter(Boolean)
  return items.length ? <div className="text-xs text-muted space-y-0.5">{items.map((t, i) => <div key={i}>{t}</div>)}</div> : <span className="text-muted">Belum diisi</span>
}

export default function ShipmentCostTable({ rows }: { rows: ShipmentCostRow[] }) {
  const router = useRouter()
  const [activeRow, setActiveRow] = useState<ShipmentCostRow | null>(null)

  function handleSaved() {
    setActiveRow(null)
    router.refresh()
  }

  const emptyRows = rows.filter(r => !(r.total_biaya ?? 0))

  const columns: DataTableColumn<ShipmentCostRow>[] = [
    {
      key: 'trip_id',
      label: 'Trip ID',
      width: '120px',
      render: (val) => <span className="font-mono text-xs font-bold text-blue">{val ?? '-'}</span>,
    },
    {
      key: 'pss_no',
      label: 'PSS / CD',
      width: '120px',
      render: (val, row) => <span className="font-mono text-xs">{val ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')}</span>,
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (val) => <span className="text-sm">{val ?? '-'}</span>,
    },
    {
      key: 'dk_lk',
      label: 'DK/LK',
      width: '80px',
      render: (val) => val ? (
        <span className={`text-xs font-bold rounded px-2 py-0.5 ${val === 'DK' ? 'bg-blue/10 text-blue' : 'bg-orange/10 text-orange'}`}>
          {val}
        </span>
      ) : <span className="text-xs text-muted">—</span>,
    },
    {
      key: 'transporter_name',
      label: 'Transporter',
      render: (val) => <span className="text-sm">{val ?? '-'}</span>,
    },
    {
      key: 'cost_model',
      label: 'Model',
      render: (val) => {
        if (val === 'Internal' || !val) return <span className="text-xs font-medium px-2 py-0.5 bg-blue/10 text-blue rounded">Internal</span>
        if (val === 'Retail') return <span className="text-xs font-medium px-2 py-0.5 bg-purple/10 text-purple rounded">Indah</span>
        if (val === 'Trucking') return <span className="text-xs font-medium px-2 py-0.5 bg-orange/10 text-orange rounded">ASSA</span>
        return <span className="text-xs text-muted">-</span>
      },
    },
    {
      key: 'total_biaya',
      label: 'Total Biaya',
      width: '140px',
      render: (val) => <span className="font-mono text-xs font-bold">{rp(val)}</span>,
    },
    {
      key: 'cost_ratio',
      label: 'Ratio',
      width: '80px',
      render: (val) => <div className="text-center">{CostRatioBadge({ v: val })}</div>,
    },
    {
      key: 'is_on_time',
      label: 'OTD',
      width: '70px',
      render: (val) => <div className="text-center">{OtdBadge({ v: val })}</div>,
    },
  ]

  return (
    <>
      {activeRow && (
        <ShipmentCostInputPanel
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onSaved={handleSaved}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="box"
          title="Belum ada data shipment"
          description="Input data shipment dari halaman Shipment Tracking"
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey="id"
          onRowClick={row => setActiveRow(row)}
          expandable={{
            render: row => (
              <div className="pl-4 py-2 border-t border-border">
                <div className="text-xs font-bold text-muted uppercase mb-2">Komponen Biaya</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <CostDetail r={row} />
                </div>
              </div>
            ),
          }}
        />
      )}

      {emptyRows.length > 0 && (
        <div className="mt-4 text-xs text-orange bg-orange/5 border border-orange/10 rounded-lg px-3 py-2">
          <span className="font-bold">⚠</span> {emptyRows.length} shipment belum diisi biaya
        </div>
      )}
    </>
  )
}
