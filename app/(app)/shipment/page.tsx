'use client'

import { useEffect, useState, useTransition } from 'react'
import { getShipmentTrackings, type ShipmentTrackingRow } from './actions'
import ShipmentTMSPanel from '@/components/shipment/ShipmentTMSPanel'
import { Plus, Clock, Truck, CheckCircle2, PackageCheck } from 'lucide-react'

const STATUS_TABS = [
  { key: 'all',         label: 'Semua',      icon: null },
  { key: 'Draft',       label: 'Draft',      icon: Clock },
  { key: 'Dispatched',  label: 'Dispatched', icon: Truck },
  { key: 'In Transit',  label: 'In Transit', icon: Truck },
  { key: 'Delivered',   label: 'Delivered',  icon: CheckCircle2 },
] as const

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    'Draft':      'bg-gray-100 text-gray-600',
    'Dispatched': 'bg-blue-100 text-blue-700',
    'In Transit': 'bg-orange-100 text-orange-700',
    'Delivered':  'bg-green-100 text-green-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

const otdBadge = (isOnTime: boolean | null) => {
  if (isOnTime === null) return null
  return isOnTime
    ? <span className="text-xs rounded-full px-2 py-0.5 bg-green-100 text-green-700 font-medium">On Time</span>
    : <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700 font-medium">Late</span>
}

export default function ShipmentPage() {
  const [rows, setRows]         = useState<ShipmentTrackingRow[]>([])
  const [tab, setTab]           = useState<string>('all')
  const [selected, setSelected] = useState<ShipmentTrackingRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()
  const [tmsAvail, setTmsAvail] = useState<boolean | null>(null)

  function load(status = tab) {
    startLoad(async () => {
      try {
        const data = await getShipmentTrackings({ status: status === 'all' ? undefined : status })
        setRows(data)
        setTmsAvail(true)
      } catch (e: any) {
        // tabel belum ada → fallback notice
        if (e.message?.includes('schema cache')) setTmsAvail(false)
      }
    })
  }

  useEffect(() => { load() }, [])

  function handleTabChange(key: string) {
    setTab(key)
    load(key)
  }

  // Stats
  const counts = STATUS_TABS.slice(1).reduce((acc, t) => {
    acc[t.key] = rows.filter(r => r.status === t.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">SHIPMENT TRACKING</h1>
          <p className="text-sm text-gray-500 mt-0.5">TMS — PSS & Crossdocking</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Tambah Shipment
        </button>
      </header>

      {/* Belum ada schema */}
      {tmsAvail === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Schema TMS belum dijalankan.</strong> Buka Supabase SQL Editor dan jalankan file{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema_tms.sql</code>{' '}
          untuk membuat tabel <code className="font-mono bg-amber-100 px-1 rounded">shipment_tracking</code>.
        </div>
      )}

      {/* Stats strip */}
      {tmsAvail === true && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Draft',      count: counts['Draft']      ?? 0, color: 'text-gray-700',   bg: 'bg-gray-50' },
            { label: 'Dispatched', count: counts['Dispatched'] ?? 0, color: 'text-blue-700',   bg: 'bg-blue-50' },
            { label: 'In Transit', count: counts['In Transit'] ?? 0, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Delivered',  count: counts['Delivered']  ?? 0, color: 'text-green-700',  bg: 'bg-green-50' },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => handleTabChange(s.label)}
              className={`rounded-xl border p-3 text-left transition-all ${
                tab === s.label ? `${s.bg} border-current ${s.color}` : 'border-border bg-white'
              }`}
            >
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {tmsAvail === true && (
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400 self-center">{rows.length} shipment</span>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Sumber</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">PSS / CD No.</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Promised Date</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Transporter</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Driver</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Kendaraan</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">OTD</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Biaya (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && tmsAvail !== false && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Belum ada shipment. Klik <strong>+ Tambah Shipment</strong> untuk mulai.
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="hover:bg-blue-50 cursor-pointer"
              >
                <td className="px-4 py-2.5">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    r.source_type === 'PSS' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {r.source_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">
                  {r.pss_no ?? (r.crossdocking_id != null ? `CD-${r.crossdocking_id}` : '-')}
                </td>
                <td className="px-4 py-2.5 text-xs max-w-[160px] truncate">{r.customer_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.promised_delivery_date?.slice(0, 10) ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs">
                  <div>{r.transporter_name ?? '-'}</div>
                  {r.transporter_service_model && (
                    <div className="text-gray-400">{r.transporter_service_model}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs">{r.driver_name ?? '-'}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.vehicle_no ?? '-'}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusBadge(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">{otdBadge(r.is_on_time)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {r.trip_cost != null ? r.trip_cost.toLocaleString('id-ID') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel */}
      {(selected || adding) && (
        <ShipmentTMSPanel
          shipment={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
