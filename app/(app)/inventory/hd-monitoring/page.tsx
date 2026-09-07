'use client'

import { useEffect, useState, useTransition } from 'react'
import { getHdMonitoring, type HdMonitoringRow } from './actions'
import HdMonitoringPanel from '@/components/hd-monitoring/HdMonitoringPanel'
import { Plus, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'

// ── Badge status ────────────────────────────────────────────────────────────
function getStatus(row: HdMonitoringRow): 'aman' | 'mendekati' | 'kritis' {
  if (!row.fu_po_date || !row.last_shipment_date || row.estimated_stock == null) return 'kritis'
  const today = new Date()
  const fuDate = new Date(row.fu_po_date)
  const stockoutDate = row.estimated_stockout_date ? new Date(row.estimated_stockout_date) : null

  if (stockoutDate && stockoutDate < today) return 'kritis'
  if ((row.estimated_stock ?? 0) < 0) return 'kritis'
  const daysToFU = Math.floor((fuDate.getTime() - today.getTime()) / 86_400_000)
  if (daysToFU < 0) return 'kritis'
  if (daysToFU <= 3) return 'mendekati'
  return 'aman'
}

const STATUS_CONFIG = {
  aman:      { label: 'Aman',          bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2, border: 'border-green-200' },
  mendekati: { label: 'Mendekati FU-PO', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock,        border: 'border-yellow-200' },
  kritis:    { label: 'Kritis / Lewat', bg: 'bg-red-100',   text: 'text-red-700',   icon: AlertTriangle, border: 'border-red-200' },
}

function StatusBadge({ status }: { status: ReturnType<typeof getStatus> }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DaysBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-gray-400">—</span>
  const days = Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return <span className="text-xs font-bold text-red-600">{Math.abs(days)}h lalu</span>
  if (days === 0) return <span className="text-xs font-bold text-orange-600">Hari ini</span>
  return <span className={`text-xs font-bold ${days <= 3 ? 'text-yellow-600' : 'text-gray-600'}`}>{days}h lagi</span>
}

export default function HdMonitoringPage() {
  const [rows, setRows]         = useState<HdMonitoringRow[]>([])
  const [selected, setSelected] = useState<HdMonitoringRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()
  const [tmsAvail, setAvail]    = useState<boolean | null>(null)
  const [cityFilter, setCityFilter] = useState('all')

  function load() {
    startLoad(async () => {
      try {
        setRows(await getHdMonitoring())
        setAvail(true)
      } catch (e: any) {
        if (e.message?.includes('schema cache') || e.message?.includes('relation')) setAvail(false)
        else setAvail(true)
      }
    })
  }

  useEffect(() => { load() }, [])

  // Ambil snapshot terbaru per customer
  const latestByCustomer = Object.values(
    rows.reduce<Record<number, HdMonitoringRow>>((acc, r) => {
      if (!acc[r.customer_id] || r.snapshot_date > acc[r.customer_id].snapshot_date) {
        acc[r.customer_id] = r
      }
      return acc
    }, {})
  )

  // Stats
  const counts = { aman: 0, mendekati: 0, kritis: 0 }
  latestByCustomer.forEach(r => counts[getStatus(r)]++)

  // Filter kota
  const cities = [...new Set(latestByCustomer.map(r => r.city).filter(Boolean))].sort() as string[]
  const filtered = cityFilter === 'all' ? latestByCustomer : latestByCustomer.filter(r => r.city === cityFilter)

  // Sort: kritis dulu, lalu mendekati, lalu aman; per kota
  const sorted = [...filtered].sort((a, b) => {
    const order = { kritis: 0, mendekati: 1, aman: 2 }
    const sa = getStatus(a), sb = getStatus(b)
    if (order[sa] !== order[sb]) return order[sa] - order[sb]
    return (a.city ?? '').localeCompare(b.city ?? '')
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">HD STOCK MONITORING</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Estimasi stok consumable HD Set per customer — basis FU-PO ke customer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Input Snapshot
          </button>
        </div>
      </header>

      {/* Schema belum ada */}
      {tmsAvail === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Tabel HD Monitoring belum dibuat.</strong> Jalankan{' '}
          <code className="bg-amber-100 px-1 rounded font-mono">supabase/schema_v15.sql</code>{' '}
          di Supabase SQL Editor terlebih dahulu.
        </div>
      )}

      {/* Stats strip */}
      {tmsAvail === true && (
        <div className="grid grid-cols-3 gap-3">
          {(['aman', 'mendekati', 'kritis'] as const).map(s => {
            const cfg = STATUS_CONFIG[s]
            const Icon = cfg.icon
            return (
              <div key={s} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
                <div className={`flex items-center gap-2 text-xs font-medium ${cfg.text} mb-1`}>
                  <Icon className="h-3.5 w-3.5" /> {cfg.label}
                </div>
                <div className={`text-3xl font-bold ${cfg.text}`}>{counts[s]}</div>
                <div className={`text-xs mt-0.5 ${cfg.text} opacity-70`}>customer</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter kota */}
      {tmsAvail === true && cities.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setCityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cityFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Semua Kota ({latestByCustomer.length})
          </button>
          {cities.map(c => (
            <button
              key={c}
              onClick={() => setCityFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cityFilter === c ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {c} ({latestByCustomer.filter(r => r.city === c).length})
            </button>
          ))}
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Kota</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Mesin HD</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Pemakaian/Hari</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Stok Estimasi</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">DOI</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Est. Habis</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Tanggal FU-PO</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Sisa FU-PO</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Pengiriman Terakhir</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && sorted.length === 0 && tmsAvail !== false && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Belum ada data monitoring. Klik <strong>+ Input Snapshot</strong> untuk mulai.
                </td>
              </tr>
            )}
            {sorted.map(r => {
              const status = getStatus(r)
              const rowBg = status === 'kritis' ? 'bg-red-50' : status === 'mendekati' ? 'bg-yellow-50' : ''
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${rowBg}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-xs">{r.customer_name ?? r.customer_code}</div>
                    <div className="text-gray-400 text-xs font-mono">{r.customer_code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.city ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-sm">
                    {r.hd_machine_count ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {r.daily_usage != null ? r.daily_usage.toLocaleString('id-ID') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-bold ${(r.estimated_stock ?? 0) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {r.estimated_stock != null ? r.estimated_stock.toLocaleString('id-ID') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-bold ${(r.doi_days ?? 0) < (r.rop_days ?? 8) ? 'text-red-600' : 'text-gray-700'}`}>
                      {r.doi_days != null ? Math.round(r.doi_days) : '—'}
                    </span>
                    {r.doi_days != null && <span className="text-xs text-gray-400 ml-0.5">h</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs">{fmtDate(r.estimated_stockout_date)}</td>
                  <td className="px-4 py-2.5 text-center text-xs font-medium">{fmtDate(r.fu_po_date)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <DaysBadge date={r.fu_po_date} />
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.last_shipment_date ? (
                      <div>
                        <span className="font-medium">{fmtDate(r.last_shipment_date)}</span>
                        {r.last_shipment_qty != null && (
                          <span className="text-gray-400 ml-1">+{r.last_shipment_qty.toLocaleString('id-ID')}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-red-400 font-medium">— belum ada data</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Catatan metodologi */}
      {tmsAvail === true && sorted.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 space-y-1">
          <div className="font-semibold text-gray-700 mb-1">Metodologi Estimasi</div>
          <div>• <strong>Stok Estimasi</strong> = Stok Akhir + Qty Pengiriman Terakhir (tidak ada visibilitas stok fisik gudang customer)</div>
          <div>• <strong>DOI</strong> = Stok Estimasi ÷ Pemakaian Harian (mesin × 2 tindakan/hari, default)</div>
          <div>• <strong>FU-PO</strong> = Estimasi Habis − Lead Time Reorder — tanggal mulai follow-up PO ke customer</div>
          <div>• Status <span className="text-red-600 font-medium">Kritis</span>: stok negatif, sudah lewat tanggal FU-PO, atau belum ada data pengiriman</div>
          <div>• Snapshot dibuat manual per periode — akurasi meningkat jika marketing melaporkan stok on-hand customer secara berkala</div>
        </div>
      )}

      {/* Panel */}
      {(selected || adding) && (
        <HdMonitoringPanel
          row={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
