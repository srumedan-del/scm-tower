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

          <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm max-h-[calc(100vh-250px)]">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-10" /><col className="w-28" /><col className="w-36" />
                <col className="w-44" /><col className="w-32" /><col className="w-32" />
                <col className="w-56" /><col className="w-52" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                    {untracked.length > 0 && (
                      <input type="checkbox" checked={allUtChecked} onChange={toggleUtAll}
                        className="rounded border-border text-text" title="Pilih semua" />
                    )}
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Doc Date</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">PSS No.</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Customer</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Kota Tujuan</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Promised Date</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Muatan</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Status Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0F4]">
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
                      <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.document_date ?? '-'}</td>
                      <td className="px-4 py-0.25 font-mono text-xs font-semibold text-indigo-600 whitespace-nowrap">{r.pss_no}</td>
                      <td className="px-4 py-0.25 text-xs max-w-[160px] truncate text-[#475569]">{r.customer_name ?? '-'}</td>
                      <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.destination_city ?? '-'}</td>
                      <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.promised_delivery_date ?? '-'}</td>
                      <td className="px-4 py-0.25 text-left text-[11px] whitespace-nowrap text-[#475569]">
                        {r.total_koli != null ? (
                          <span className={r.incomplete_load_count > 0 ? 'text-orange-600' : 'text-gray-700'}>
                            {Number(r.total_koli).toLocaleString('id-ID')} koli · {formatLoadTonnage(r.total_tonnage)} · {Number(r.total_volume_cbm ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} m3
                          </span>
                        ) : <span className="text-gray-400">Belum dihitung</span>}
                      </td>
                      <td className="px-4 py-0.25 text-left text-[#475569]">
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
          <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm max-h-[calc(100vh-250px)]">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-32" /><col className="w-36" /><col className="w-32" />
                <col className="w-44" /><col className="w-44" /><col className="w-40" />
                <col className="w-28" /><col className="w-24" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
                              <tr>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Trip ID</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">PSS / CD No.</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Document Date</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Customer</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Transporter</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Driver</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Status</th>
                                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">POD</th>
                              </tr>
                            </thead>
              <tbody className="divide-y divide-[#EEF0F4]">
                {loading && (
                  <tr><td className="px-4 py-0.25 text-xs font-medium text-[#475569]">Memuat...</td></tr>
                )}
                {!loading && rows.length === 0 && tmsAvail !== false && (
                  <tr>
                    <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">
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
									<td className="px-4 py-0.25 font-mono text-xs text-gray-500 whitespace-nowrap">{r.trip_id ?? '-'}</td>
                    <td className="px-4 py-0.25 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">
                      {r.pss_no ?? (r.crossdocking_id != null ? `CD-${r.crossdocking_id}` : '-')}
                    </td>
                    <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.document_date ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs max-w-[140px] truncate text-[#475569]">{r.customer_name ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs text-[#475569]">
                      <div>{r.transporter_name ?? (r.cost_model === 'Internal' || r.fleet_type === 'Internal' ? 'SRU MEDAN' : (r.notes?.match(/Vendor: ([^|]+)/)?.[1]?.trim()) ?? '-')}</div>
                      {r.transporter_service_model && <div className="text-gray-400">{r.transporter_service_model}</div>}
                      {!r.transporter_name && r.notes?.match(/Nopol: ([^|]+)/)?.[1] && (
                        <div className="text-gray-400 font-mono text-xs">{r.notes.match(/Nopol: ([^|]+)/)?.[1]?.trim()}</div>
                      )}
                    </td>
                    <td className="px-4 py-0.25 text-xs text-[#475569]">
                      <div>{r.driver_name ?? (r.notes?.match(/Driver: ([^|]+)/)?.[1]?.trim()) ?? '-'}</div>
                      {(r as any).helper_name && <div className="text-gray-400">{(r as any).helper_name}</div>}
                      {!r.driver_name && r.notes?.match(/Tipe: ([^|]+)/)?.[1] && (
                        <div className="text-gray-400">{r.notes.match(/Tipe: ([^|]+)/)?.[1]?.trim()}</div>
                      )}
                    </td>
                    <td className="px-4 py-0.25 text-center text-[#475569]">
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
          <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm max-h-[calc(100vh-250px)]">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-36" /><col className="w-36" /><col className="w-44" />
                <col className="w-36" /><col className="w-36" /><col className="w-36" /><col className="w-36" />
                <col className="w-28" /><col className="w-28" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]"><tr>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">PSS / CD No.</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Document Date Time</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Customer</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Kota Tujuan</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Nomor Resi</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Waktu Serah Terima</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Biaya Pengiriman</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Status</th>
                              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Penerimaan</th>
                            </tr></thead>
              <tbody className="divide-y divide-[#EEF0F4]">
                {loadingRetail && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>}
                {!loadingRetail && retailInTransit.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Tidak ada shipment Retail yang sedang dalam perjalanan.</td></tr>}
                {retailInTransit.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer transition-colors hover:bg-orange-50">
                    <td className="px-4 py-0.25 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">{r.pss_no ?? (r.crossdocking_id ? `CD-${r.crossdocking_id}` : '-')}</td>
                    <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.document_date ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs max-w-[180px] truncate text-[#475569]">{r.customer_name ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.destination_city ?? '-'}</td>
                    <td className="px-4 py-0.25 font-mono text-xs font-medium whitespace-nowrap text-[#475569]">{r.no_resi ?? '-'}</td>
                    <td className="px-4 py-0.25 text-xs whitespace-nowrap text-[#475569]">{r.dispatch_time ? new Date(r.dispatch_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-0.25 text-right text-xs font-medium whitespace-nowrap text-[#475569]">{formatRupiah(r.total_biaya_eksternal)}</td>
                    <td className="px-4 py-0.25 text-center text-[#475569]"><span className="text-xs rounded-full px-2 py-0.5 font-medium bg-orange-100 text-orange-700">In Transit</span></td>
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
            const activeTab = mainTab
            setSelected(null); setAdding(false); setPrefillPss(null)
            loadTracking(); loadUntracked(); loadRetailInTransit()
            setMainTab(activeTab === 'retail-in-transit' ? 'retail-in-transit' : 'tracking')
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
