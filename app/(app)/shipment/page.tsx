'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getShipmentTrackings, getUntrackedPss, getRetailInTransitShipments,
  type ShipmentTrackingRow, type UntrackedPssRow,
} from './actions'
import ShipmentTMSPanel from '@/components/shipment/ShipmentTMSPanel'
import BulkShipmentPanel from '@/components/shipment/BulkShipmentPanel'
import PodPanel from '@/components/shipment/PodPanel'
import { ShipmentExportButton } from '@/components/shipment/ShipmentExportButton'
import { Plus, Truck, CheckCircle2, PackageCheck, AlertCircle, MapPinned } from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────

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

const formatRupiah = (amount: number | null) => {
  if (amount === null || amount === undefined) return '-'
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ShipmentPage() {
  // Tab utama: planning, daftar outbound, atau retail yang sedang dalam perjalanan.
  const [mainTab, setMainTab]           = useState<'untracked' | 'tracking' | 'retail-in-transit'>('untracked')

  // ── untracked state ──
  const [untracked, setUntracked]       = useState<UntrackedPssRow[]>([])
  const [loadingUT, startLoadUT]        = useTransition()

  // ── tracking state ──
  const [rows, setRows]                 = useState<ShipmentTrackingRow[]>([])
  const [loading, startLoad]            = useTransition()
  const [tmsAvail, setTmsAvail]         = useState<boolean | null>(null)
  const [showAllStatuses, setShowAllStatuses] = useState(false)
  const [retailInTransit, setRetailInTransit] = useState<ShipmentTrackingRow[]>([])
  const [loadingRetail, startLoadRetail]      = useTransition()

  // Panels
  const [selected, setSelected]         = useState<ShipmentTrackingRow | null>(null)
  const [podShipment, setPodShipment]   = useState<ShipmentTrackingRow | null>(null)
  const [adding, setAdding]             = useState(false)
  // Pre-fill dari baris untracked (single)
  const [prefillPss, setPrefillPss]     = useState<UntrackedPssRow | null>(null)
  // Bulk create
  const [bulkOpen, setBulkOpen]         = useState(false)
  const [checkedUt, setCheckedUt]       = useState<Set<string>>(new Set())

  // ── loaders ──────────────────────────────────────────────────────────────

  function loadUntracked() {
    startLoadUT(async () => {
      try { setUntracked(await getUntrackedPss()) } catch {}
    })
    setCheckedUt(new Set())
  }

  function loadTracking(includeAllStatuses = showAllStatuses) {
    startLoad(async () => {
      try {
        const data = await getShipmentTrackings({ status: includeAllStatuses ? 'all' : 'In Transit' })
        setRows(data)
        setTmsAvail(true)
      } catch (e: any) {
        if (e.message?.includes('schema cache')) setTmsAvail(false)
      }
    })
  }

  function loadRetailInTransit() {
    startLoadRetail(async () => {
      try { setRetailInTransit(await getRetailInTransitShipments()) } catch {}
    })
  }

  useEffect(() => {
    loadUntracked()
  }, [])

  useEffect(() => {
    if (mainTab === 'tracking') loadTracking()
    if (mainTab === 'retail-in-transit') loadRetailInTransit()
  }, [mainTab])

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
  const selectedTripRows = selected?.trip_id
    ? rows.filter(row => row.trip_id === selected.trip_id)
    : selected ? [selected] : []

  function formatLoadTonnage(value: number | null | undefined) {
    if (value == null) return '-'
    const tonnage = Math.abs(Number(value))
    if (tonnage < 1) return `${(tonnage * 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`
    return `${tonnage.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ton`
  }

  // ── assign trip helpers dihapus — 1 PSS = 1 Trip ID ──────────────────────

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      <div>
        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4 flex-wrap pb-3">
          <div>
            <h1 className="text-3xl font-bold">SHIPMENT TRACKING</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          </div>
        </header>

        {/* ── Main tabs ── */}
        <nav className="grid grid-cols-1 border-b border-border sm:grid-cols-3" aria-label="Shipment Tracking">
        <button
          onClick={() => setMainTab('untracked')}
          className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            mainTab === 'untracked'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          For Transport Planning
          {untracked.length > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold leading-none text-orange-700">
              {untracked.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab('tracking')}
          className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            mainTab === 'tracking'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck className="h-4 w-4" />
          List Outbound Deliveries
          {rows.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold leading-none text-indigo-700">
              {rows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab('retail-in-transit')}
          className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            mainTab === 'retail-in-transit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPinned className="h-4 w-4" />
          Pengiriman Retail Indah Logistik
          {retailInTransit.length > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold leading-none text-orange-700">
              {retailInTransit.length}
            </span>
          )}
        </button>
        </nav>
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

          <div className="max-h-[calc(100vh-250px)] overflow-auto bg-white border border-border rounded-xl">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-10" /><col className="w-28" /><col className="w-36" />
                <col className="w-44" /><col className="w-32" /><col className="w-32" />
                <col className="w-56" /><col className="w-52" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-orange-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-8">
                    {untracked.length > 0 && (
                      <input type="checkbox" checked={allUtChecked} onChange={toggleUtAll}
                        className="rounded border-gray-300" title="Pilih semua" />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Doc Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">PSS No.</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Kota Tujuan</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 whitespace-nowrap">Promised Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Muatan</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Status Dokumen</th>
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
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.document_date ?? '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-indigo-600 whitespace-nowrap">{r.pss_no}</td>
                      <td className="px-4 py-2.5 text-xs max-w-[160px] truncate">{r.customer_name ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.destination_city ?? '-'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.promised_delivery_date ?? '-'}</td>
                      <td className="px-4 py-2.5 text-left text-[11px] whitespace-nowrap">
                        {r.total_koli != null ? (
                          <span className={r.incomplete_load_count > 0 ? 'text-orange-600' : 'text-gray-700'}>
                            {Number(r.total_koli).toLocaleString('id-ID')} koli · {formatLoadTonnage(r.total_tonnage)} · {Number(r.total_volume_cbm ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} m3
                          </span>
                        ) : <span className="text-gray-400">Belum dihitung</span>}
                      </td>
                      <td className="px-4 py-2.5 text-left">
                        <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">BELUM DIBUAT SHIPMENT</span>
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500">
              Daftar <strong>Shipment</strong> Pengiriman.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllStatuses}
                onChange={e => {
                  const checked = e.target.checked
                  setShowAllStatuses(checked)
                  loadTracking(checked)
                }}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Tampilkan semua status
            </label>
          </div>

          {tmsAvail === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong>Schema TMS belum dijalankan.</strong> Buka Supabase SQL Editor dan jalankan{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema_tms.sql</code>.
            </div>
          )}

          {/* Tabel tracking */}
          <div className="max-h-[calc(100vh-250px)] overflow-auto bg-white border border-border rounded-xl">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-32" /><col className="w-36" /><col className="w-32" />
                <col className="w-44" /><col className="w-44" /><col className="w-40" />
                <col className="w-28" /><col className="w-24" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-gray-50 border-b">
                <tr>
								<th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Trip ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">PSS / CD No.</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Document Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Transporter</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Driver</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">POD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
                )}
                {!loading && rows.length === 0 && tmsAvail !== false && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                      Belum ada shipment. Buat dari tab <strong>Belum Dibuat</strong>.
                    </td>
                  </tr>
                )}
                {rows.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer transition-colors hover:bg-blue-50"
                  >
									<td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{r.trip_id ?? '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">
                      {r.pss_no ?? (r.crossdocking_id != null ? `CD-${r.crossdocking_id}` : '-')}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.document_date ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs max-w-[140px] truncate">{r.customer_name ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <div>{r.transporter_name ?? (r.cost_model === 'Internal' || r.fleet_type === 'Internal' ? 'SRU MEDAN' : (r.notes?.match(/Vendor: ([^|]+)/)?.[1]?.trim()) ?? '-')}</div>
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Panels ── */}
      {mainTab === 'retail-in-transit' && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500">Pengiriman Retail yang sudah diserahterimakan ke vendor dan memiliki <strong>nomor resi</strong>. Status tetap <strong>In Transit</strong> sampai barang diterima pelanggan.</p>
            <button onClick={loadRetailInTransit} className="text-xs text-indigo-600 hover:underline">Refresh</button>
          </div>
          <div className="max-h-[calc(100vh-250px)] overflow-auto bg-white border border-border rounded-xl">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-36" /><col className="w-36" /><col className="w-44" />
                <col className="w-36" /><col className="w-36" /><col className="w-36" /><col className="w-36" />
                <col className="w-28" /><col className="w-28" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-orange-50 border-b"><tr>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">PSS / CD No.</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Document Date Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Kota Tujuan</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Nomor Resi</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Waktu Serah Terima</th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Biaya Pengiriman</th>
                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Status</th>
                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">Penerimaan</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {loadingRetail && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>}
                {!loadingRetail && retailInTransit.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Tidak ada shipment Retail yang sedang dalam perjalanan.</td></tr>}
                {retailInTransit.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer transition-colors hover:bg-orange-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">{r.pss_no ?? (r.crossdocking_id ? `CD-${r.crossdocking_id}` : '-')}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.document_date ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs max-w-[180px] truncate">{r.customer_name ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.destination_city ?? '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-medium whitespace-nowrap">{r.no_resi ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">{r.dispatch_time ? new Date(r.dispatch_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium whitespace-nowrap">{formatRupiah(r.total_biaya ?? r.total_biaya_eksternal)}</td>
                    <td className="px-4 py-2.5 text-center"><span className="text-xs rounded-full px-2 py-0.5 font-medium bg-orange-100 text-orange-700">In Transit</span></td>
                    <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}><button onClick={() => setPodShipment(r)} className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-200"><PackageCheck className="h-3.5 w-3.5" /> Terima</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(selected || adding) && (
        <ShipmentTMSPanel
          shipment={selected}
          relatedShipments={selected ? selectedTripRows : undefined}
          prefillPss={prefillPss}
          onClose={() => { setSelected(null); setAdding(false); setPrefillPss(null) }}
          onSaved={() => {
            setSelected(null); setAdding(false); setPrefillPss(null)
            loadTracking(); loadUntracked(); loadRetailInTransit()
            setMainTab('tracking')
          }}
        />
      )}
      {podShipment && (
        <PodPanel
          shipment={podShipment}
          onClose={() => setPodShipment(null)}
          onSaved={() => { setPodShipment(null); loadTracking(); loadRetailInTransit() }}
        />
      )}
      {bulkOpen && selectedUtRows.length > 0 && (
        <BulkShipmentPanel
          selectedPss={selectedUtRows}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); loadUntracked(); loadTracking(); loadRetailInTransit(); setMainTab('tracking') }}
        />
      )}
    </div>
  )
}
