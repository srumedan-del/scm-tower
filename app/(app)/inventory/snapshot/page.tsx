'use client'

import { useEffect, useState, useTransition } from 'react'
import { getCurrentInventory, type InventorySnapshotRow } from './actions'
import SnapshotPanel from '@/components/inventory/SnapshotPanel'
import { Plus, RefreshCw, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react'

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  STOCKOUT: { label: 'Stockout',  bg: 'bg-red-100',    text: 'text-red-700' },
  CRITICAL: { label: 'Critical',  bg: 'bg-orange-100', text: 'text-orange-700' },
  LOW:      { label: 'Low',       bg: 'bg-yellow-100', text: 'text-yellow-700' },
  OK:       { label: 'OK',        bg: 'bg-green-100',  text: 'text-green-700' },
}

function AlertBadge({ status }: { status: string | null }) {
  const cfg = STATUS_CFG[status ?? 'OK'] ?? STATUS_CFG.OK
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function fmtQty(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('id-ID')
}

export default function InventorySnapshotPage() {
  const [rows, setRows]         = useState<InventorySnapshotRow[]>([])
  const [selected, setSelected] = useState<InventorySnapshotRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()
  const [avail, setAvail]       = useState<boolean | null>(null)
  const [filter, setFilter]     = useState<'all' | 'STOCKOUT' | 'CRITICAL' | 'LOW' | 'OK'>('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  function load() {
    startLoad(async () => {
      try {
        setRows(await getCurrentInventory())
        setAvail(true)
      } catch (e: any) {
        if (e.message?.includes('relation') || e.message?.includes('schema')) setAvail(false)
        else setAvail(true)
      }
    })
  }

  useEffect(() => { load() }, [])

  // Stats
  const counts = {
    STOCKOUT: rows.filter(r => r.alert_status === 'STOCKOUT').length,
    CRITICAL: rows.filter(r => r.alert_status === 'CRITICAL').length,
    LOW:      rows.filter(r => r.alert_status === 'LOW').length,
    OK:       rows.filter(r => r.alert_status === 'OK').length,
  }

  const warehouses = [...new Set(rows.map(r => r.warehouse_code))].sort()

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.alert_status !== filter) return false
    if (warehouseFilter !== 'all' && r.warehouse_code !== warehouseFilter) return false
    return true
  })

  // Sort: alert priority dulu
  const alertOrder: Record<string, number> = { STOCKOUT: 0, CRITICAL: 1, LOW: 2, OK: 3 }
  const sorted = [...filtered].sort((a, b) => {
    const sa = alertOrder[a.alert_status ?? 'OK'] ?? 3
    const sb = alertOrder[b.alert_status ?? 'OK'] ?? 3
    return sa !== sb ? sa - sb : (a.sku_code ?? '').localeCompare(b.sku_code ?? '')
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">INVENTORY SNAPSHOT</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Stok terkini per SKU per gudang — update manual atau bulk upload
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
            <Plus className="h-4 w-4" /> Input Stok
          </button>
        </div>
      </header>

      {/* Schema belum ada */}
      {avail === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Tabel inventory_snapshot belum dibuat.</strong> Jalankan{' '}
          <code className="bg-amber-100 px-1 rounded font-mono">supabase/schema_new_tables.sql</code>{' '}
          di Supabase SQL Editor terlebih dahulu.
        </div>
      )}

      {/* Stats strip */}
      {avail === true && (
        <div className="grid grid-cols-4 gap-3">
          {(['STOCKOUT', 'CRITICAL', 'LOW', 'OK'] as const).map(s => {
            const cfg = STATUS_CFG[s]
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? 'all' : s)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  filter === s ? `${cfg.bg} border-current ${cfg.text}` : 'border-border bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`text-2xl font-bold ${cfg.text}`}>{counts[s]}</div>
                <div className="text-xs text-gray-500 mt-0.5">{cfg.label}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Filter warehouse + alert */}
      {avail === true && (
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              Semua Status
            </button>
            {(['STOCKOUT', 'CRITICAL', 'LOW', 'OK'] as const).map(s => (
              <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {STATUS_CFG[s].label}
              </button>
            ))}
          </div>
          {warehouses.length > 1 && (
            <div className="flex gap-1 ml-2 border-l pl-2">
              <button onClick={() => setWarehouseFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${warehouseFilter === 'all' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                Semua Gudang
              </button>
              {warehouses.map(w => (
                <button key={w} onClick={() => setWarehouseFilter(warehouseFilter === w ? 'all' : w)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${warehouseFilter === w ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {w}
                </button>
              ))}
            </div>
          )}
          <span className="ml-auto text-xs text-gray-400">{sorted.length} SKU</span>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Nama Item</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Gudang</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">On Hand</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Reserved</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Available</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Safety Stock</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Avg/Hari</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">DOS</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Tgl Snapshot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && sorted.length === 0 && avail !== false && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Belum ada data snapshot. Klik <strong>+ Input Stok</strong> untuk mulai.
                </td>
              </tr>
            )}
            {sorted.map(r => {
              const rowBg = r.alert_status === 'STOCKOUT' ? 'bg-red-50'
                : r.alert_status === 'CRITICAL' ? 'bg-orange-50'
                : r.alert_status === 'LOW' ? 'bg-yellow-50'
                : ''
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${rowBg}`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-700">{r.sku_code}</td>
                  <td className="px-4 py-2.5 text-xs max-w-[200px] truncate">{r.item_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{r.warehouse_code}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtQty(r.qty_on_hand)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-500">{fmtQty(r.qty_reserved)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">{fmtQty(r.qty_available)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-500">{fmtQty(r.safety_stock)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{r.avg_daily_usage != null ? r.avg_daily_usage.toFixed(1) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.days_of_supply != null ? (
                      <span className={`font-mono text-xs font-bold ${
                        r.days_of_supply < 3 ? 'text-red-600'
                        : r.days_of_supply < 7 ? 'text-orange-600'
                        : 'text-gray-700'
                      }`}>
                        {Math.round(r.days_of_supply)}h
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center"><AlertBadge status={r.alert_status} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.snapshot_date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Panel */}
      {(selected || adding) && (
        <SnapshotPanel
          row={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
