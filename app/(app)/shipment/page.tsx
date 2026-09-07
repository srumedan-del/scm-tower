'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getShipmentTrackings, getUntrackedPss,
  type ShipmentTrackingRow, type UntrackedPssRow,
} from './actions'
import ShipmentTMSPanel from '@/components/shipment/ShipmentTMSPanel'
import BulkShipmentPanel from '@/components/shipment/BulkShipmentPanel'
import PodPanel from '@/components/shipment/PodPanel'
import AssignTripPanel from '@/components/shipment/AssignTripPanel'
import { ShipmentExportButton } from '@/components/shipment/ShipmentExportButton'
import { Plus, Clock, Truck, CheckCircle2, PackageCheck, Route, AlertCircle } from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'all',        label: 'Semua'      },
  { key: 'Draft',      label: 'Draft'      },
  { key: 'Dispatched', label: 'Dispatched' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'Delivered',  label: 'Delivered'  },
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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ShipmentPage() {
  // Tab utama: 'untracked' | 'tracking'
  const [mainTab, setMainTab]           = useState<'untracked' | 'tracking'>('untracked')

  // ── untracked state ──
  const [untracked, setUntracked]       = useState<UntrackedPssRow[]>([])
  const [loadingUT, startLoadUT]        = useTransition()

  // ── tracking state ──
  const [rows, setRows]                 = useState<ShipmentTrackingRow[]>([])
  const [statusTab, setStatusTab]       = useState<string>('all')
  const [loading, startLoad]            = useTransition()
  const [tmsAvail, setTmsAvail]         = useState<boolean | null>(null)

  // Panels
  const [selected, setSelected]         = useState<ShipmentTrackingRow | null>(null)
  const [podShipment, setPodShipment]   = useState<ShipmentTrackingRow | null>(null)
  const [adding, setAdding]             = useState(false)
  // Pre-fill dari baris untracked (single)
  const [prefillPss, setPrefillPss]     = useState<UntrackedPssRow | null>(null)
  // Bulk create
  const [bulkOpen, setBulkOpen]         = useState(false)
  const [checkedUt, setCheckedUt]       = useState<Set<string>>(new Set()) // Set of pss_no

  // Multi-select assign trip
  const [checkedIds, setCheckedIds]     = useState<Set<number>>(new Set())
  const [assignOpen, setAssignOpen]     = useState(false)

  // ── loaders ──────────────────────────────────────────────────────────────

  function loadUntracked() {
    startLoadUT(async () => {
      try { setUntracked(await getUntrackedPss()) } catch {}
    })
    setCheckedUt(new Set())
  }

  function loadTracking(status = statusTab) {
    startLoad(async () => {
      try {
        const data = await getShipmentTrackings({ status: status === 'all' ? undefined : status })
        setRows(data)
        setTmsAvail(true)
      } catch (e: any) {
        if (e.message?.includes('schema cache')) setTmsAvail(false)
      }
    })
    setCheckedIds(new Set())
  }

  useEffect(() => {
    loadUntracked()
    loadTracking()
  }, [])

  function handleStatusTab(key: string) {
    setStatusTab(key)
    loadTracking(key)
  }

  // Klik baris PSS untracked → buka form shipment pre-filled (single)
  function openFromUntracked(pss: UntrackedPssRow) {
    setPrefillPss(pss)
    setAdding(true)
    setMainTab('tracking')
  }

  // Checkbox helpers untuk untracked
  const allUtChecked = untracked.length > 0 && checkedUt.size === untracked.length
  function toggleUtCheck(pssNo: string) {
    setCheckedUt(prev => { const n = new Set(prev); n.has(pssNo) ? n.delete(pssNo) : n.add(pssNo); return n })
  }
  function toggleUtAll() {
    setCheckedUt(allUtChecked ? new Set() : new Set(untracked.map(r => r.pss_no)))
  }
  const selectedUtRows = untracked.filter(r => checkedUt.has(r.pss_no))

  // ── assign trip helpers ───────────────────────────────────────────────────

  const canAssign     = (r: ShipmentTrackingRow) => r.status === 'Draft' || r.status === 'Dispatched'
  const assignableRows = rows.filter(canAssign)
  const allChecked     = assignableRows.length > 0 && checkedIds.size === assignableRows.length
  const checkedShipments = rows.filter(r => checkedIds.has(r.id))

  function toggleCheck(id: number) {
    setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(assignableRows.map(r => r.id)))
  }

  // Stats
  const counts = STATUS_TABS.slice(1).reduce((acc, t) => {
    acc[t.key] = rows.filter(r => r.status === t.key).length
    return acc
  }, {} as Record<string, number>)

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">SHIPMENT TRACKING</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            TMS — PSS &amp; Crossdocking &nbsp;·&nbsp;
            <span className="text-indigo-600 font-medium">Data mulai 01 Sep 2026</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/shipment/budget-request"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            💰 Pengajuan Dana
          </a>
          <ShipmentExportButton status={statusTab === 'all' ? undefined : statusTab} />
        </div>
      </header>

      {/* ── Main tabs ── */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setMainTab('untracked')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            mainTab === 'untracked'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Belum Dibuat
          {untracked.length > 0 && (
            <span className="ml-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5">
              {untracked.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab('tracking')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            mainTab === 'tracking'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck className="h-4 w-4" />
          Tracking
          {rows.length > 0 && (
            <span className="ml-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5">
              {rows.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — PSS BELUM DIBUAT SHIPMENT
      ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'untracked' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">
              PSS dari Outbound yang <strong>belum dibuatkan Shipment Tracking</strong>.
              Pilih satu atau beberapa PSS lalu klik <strong>Buat Shipment</strong>.
            </p>
            <button onClick={loadUntracked} className="text-xs text-indigo-600 hover:underline">
              Refresh
            </button>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-orange-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-8">
                    {untracked.length > 0 && (
                      <input type="checkbox" checked={allUtChecked} onChange={toggleUtAll}
                        className="rounded border-gray-300" title="Pilih semua" />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">PSS No.</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Tipe</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Kota Tujuan</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Doc Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Promised Date</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Delay</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingUT && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                )}
                {!loadingUT && untracked.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-green-400 mb-2" />
                      Semua PSS sudah dibuatkan Shipment Tracking.
                    </td>
                  </tr>
                )}
                {untracked.map(r => {
                  const isChecked = checkedUt.has(r.pss_no)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggleUtCheck(r.pss_no)}
                      className={`cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-orange-50'}`}
                    >
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleUtCheck(r.pss_no)}
                          className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-indigo-600 whitespace-nowrap">{r.pss_no}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          r.source_type === 'PSS'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>{r.source_type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-[160px] truncate">{r.customer_name ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.destination_city ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.document_date ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.promised_delivery_date ?? '-'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.is_late
                          ? <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700 font-bold">
                              Terlambat {r.delivery_delay_days ?? ''}h
                            </span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Floating bar saat ada yang dipilih */}
          {checkedUt.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-indigo-700 text-white rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4">
              <span className="text-sm font-medium">{checkedUt.size} PSS dipilih</span>
              <button
                onClick={() => setBulkOpen(true)}
                className="bg-white text-indigo-700 font-bold text-sm px-4 py-1.5 rounded-xl hover:bg-indigo-50"
              >
                Buat Shipment →
              </button>
              <button onClick={() => setCheckedUt(new Set())} className="text-indigo-300 hover:text-white text-xs">
                Batal pilih
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — TRACKING
      ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'tracking' && (
        <>
          {tmsAvail === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong>Schema TMS belum dijalankan.</strong> Buka Supabase SQL Editor dan jalankan{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema_tms.sql</code>.
            </div>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Draft',      count: counts['Draft']      ?? 0, color: 'text-gray-700',   bg: 'bg-gray-50' },
              { label: 'Dispatched', count: counts['Dispatched'] ?? 0, color: 'text-blue-700',   bg: 'bg-blue-50' },
              { label: 'In Transit', count: counts['In Transit'] ?? 0, color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'Delivered',  count: counts['Delivered']  ?? 0, color: 'text-green-700',  bg: 'bg-green-50' },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => handleStatusTab(s.label)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  statusTab === s.label ? `${s.bg} border-current ${s.color}` : 'border-border bg-white'
                }`}
              >
                <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          {/* Filter tabs + Assign Trip */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {STATUS_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => handleStatusTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusTab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {checkedIds.size > 0 ? (
              <button
                onClick={() => setAssignOpen(true)}
                className="ml-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 animate-pulse"
              >
                <Route className="h-4 w-4" />
                Assign Trip ({checkedIds.size} dipilih)
              </button>
            ) : (
              assignableRows.length > 0 && (
                <span className="ml-2 text-xs text-gray-400 italic">
                  Centang baris Draft/Dispatched untuk assign trip multi-drop
                </span>
              )
            )}
            <span className="ml-auto text-xs text-gray-400 self-center">{rows.length} shipment</span>
          </div>

          {/* Tabel tracking */}
          <div className="bg-white border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-8">
                    {assignableRows.length > 0 && (
                      <input type="checkbox" checked={allChecked} onChange={toggleAll}
                        className="rounded border-gray-300" title="Pilih semua Draft/Dispatched" />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Sumber</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">PSS / CD No.</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Promised Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Transporter</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Driver</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Trip ID</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">POD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
                )}
                {!loading && rows.length === 0 && tmsAvail !== false && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">
                      Belum ada shipment. Klik <strong>+ Tambah Shipment</strong> atau buat dari tab <strong>Belum Dibuat</strong>.
                    </td>
                  </tr>
                )}
                {rows.map(r => {
                  const isChecked    = checkedIds.has(r.id)
                  const isAssignable = canAssign(r)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-blue-50'
                      }`}
                    >
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        {isAssignable
                          ? <input type="checkbox" checked={isChecked}
                              onClick={e => e.stopPropagation()}
                              onChange={() => toggleCheck(r.id)}
                              className="rounded border-gray-300" />
                          : <span className="block w-4 h-4" />
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          r.source_type === 'PSS' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                        }`}>{r.source_type}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">
                        {r.pss_no ?? (r.crossdocking_id != null ? `CD-${r.crossdocking_id}` : '-')}
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-[140px] truncate">{r.customer_name ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.promised_delivery_date?.slice(0, 10) ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <div>{r.transporter_name ?? (r.notes?.match(/Vendor: ([^|]+)/)?.[1]?.trim()) ?? '-'}</div>
                        {r.transporter_service_model && <div className="text-gray-400">{r.transporter_service_model}</div>}
                        {!r.transporter_name && r.notes?.match(/Nopol: ([^|]+)/)?.[1] && (
                          <div className="text-gray-400 font-mono text-xs">{r.notes.match(/Nopol: ([^|]+)/)?.[1]?.trim()}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <div>{r.driver_name ?? (r.notes?.match(/Driver: ([^|]+)/)?.[1]?.trim()) ?? '-'}</div>
                        {(r as any).helper_name && <div className="text-gray-400">{(r as any).helper_name}</div>}
                        {!r.driver_name && r.notes?.match(/Tipe: ([^|]+)/)?.[1] && (
                          <div className="text-gray-400">{r.notes.match(/Tipe: ([^|]+)/)?.[1]?.trim()}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 max-w-[120px] truncate" title={r.trip_id ?? ''}>
                        {r.trip_id ?? '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setPodShipment(r)}
                          title={r.status === 'Delivered' ? 'Lihat / Edit POD' : 'Input POD & Konfirmasi Delivered'}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            r.status === 'Delivered'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700'
                          }`}
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          {r.status === 'Delivered' ? 'POD' : 'Terima'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Panels ── */}
      {(selected || adding) && (
        <ShipmentTMSPanel
          shipment={selected}
          prefillPss={prefillPss}
          onClose={() => { setSelected(null); setAdding(false); setPrefillPss(null) }}
          onSaved={() => {
            setSelected(null); setAdding(false); setPrefillPss(null)
            loadTracking(); loadUntracked()
            setMainTab('tracking')
          }}
        />
      )}
      {podShipment && (
        <PodPanel
          shipment={podShipment}
          onClose={() => setPodShipment(null)}
          onSaved={() => { setPodShipment(null); loadTracking() }}
        />
      )}
      {assignOpen && checkedShipments.length > 0 && (
        <AssignTripPanel
          shipments={checkedShipments}
          onClose={() => setAssignOpen(false)}
          onSaved={() => { setAssignOpen(false); loadTracking() }}
        />
      )}
      {bulkOpen && selectedUtRows.length > 0 && (
        <BulkShipmentPanel
          selectedPss={selectedUtRows}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); loadUntracked(); loadTracking(); setMainTab('tracking') }}
        />
      )}
    </div>
  )
}
