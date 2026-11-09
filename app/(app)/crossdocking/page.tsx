'use client'

import { useEffect, useState, useTransition } from 'react'
import { getCrossdockings, getCrossdockingAvailableMonths, type CrossdockingHeader } from './actions'
import CrossdockingFilter from '@/components/crossdocking/CrossdockingFilter'
import CrossdockingPanel from '@/components/crossdocking/CrossdockingPanel'
import PtsPanel from '@/components/crossdocking/PtsPanel'
import { Plus } from 'lucide-react'

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    'Draft':      'bg-gray-100 text-gray-600',
    'Ready':      'bg-blue-100 text-blue-700',
    'Dispatched': 'bg-orange-100 text-orange-700',
    'Delivered':  'bg-green-100 text-green-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

function daysDiff(from: string, to: string) {
  const diff = Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
  )
  return diff
}

export default function CrossdockingPage() {
  const [rows, setRows]       = useState<CrossdockingHeader[]>([])
  const [editId, setEditId]   = useState<number | null | undefined>(undefined)
  // undefined = panel tutup, null = form tambah baru, number = form edit
  const [loading, startLoad]  = useTransition()
  const [tmsAvail, setAvail]  = useState<boolean | null>(null)
  const [activeView, setActiveView] = useState<'crossdocking' | 'pts'>('crossdocking')
  const [months, setMonths]   = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [defaultMonth, setDefaultMonth]   = useState<string>('')

  function load(monthToLoad?: string) {
    startLoad(async () => {
      try {
        const targetMonth = monthToLoad !== undefined ? monthToLoad : selectedMonth
        setRows(await getCrossdockings(targetMonth))
        setAvail(true)
      } catch (e: any) {
        if (e.message?.includes('schema cache')) setAvail(false)
      }
    })
  }

  useEffect(() => {
    async function init() {
      try {
        const avail = await getCrossdockingAvailableMonths()
        const cur = new Date().toISOString().slice(0, 7)
        const def = avail.includes(cur) ? cur : (avail[0] ?? cur)
        setMonths(avail)
        setDefaultMonth(def)
        setSelectedMonth(def)
        load(def)
      } catch {
        load()
      }
    }
    init()
  }, [])

  const handleSelectMonth = (m: string) => {
    setSelectedMonth(m)
    load(m)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">CROSSDOCKING</h1>
          <p className="text-[14px] text-muted mt-0.5">
            Shipment dari Kantor Pusat via Medan — input manual
          </p>
        </div>
        <div className="flex items-center gap-2">
          {months.length > 0 && (
            <CrossdockingFilter
              months={months}
              selectedMonth={selectedMonth}
              defaultMonth={defaultMonth}
              onSelectMonth={handleSelectMonth}
            />
          )}
          <button
            onClick={() => setEditId(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[14px] font-semibold text-white hover:bg-indigo-500 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" /> Tambah Crossdocking
          </button>
        </div>
      </header>

      <nav className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 text-[14px]" aria-label="Crossdocking submenu">
        <button
          type="button"
          onClick={() => setActiveView('crossdocking')}
          className={`rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
            activeView === 'crossdocking'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Crossdocking
        </button>
        <button
          type="button"
          onClick={() => setActiveView('pts')}
          className={`rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
            activeView === 'pts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          List PTS MDN-PAR to JKT-JP12
        </button>
      </nav>

      {activeView === 'pts' ? (
        <PtsPanel selectedMonth={selectedMonth} />
      ) : (
        <>
          {/* Schema belum ada */}
          {tmsAvail === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-800">
              <strong>Schema TMS belum dijalankan.</strong> Buka Supabase SQL Editor dan jalankan{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema_tms.sql</code>{' '}
              untuk membuat tabel <code className="font-mono bg-amber-100 px-1 rounded">crossdocking_header</code>.
            </div>
          )}

          {/* Tabel Crossdocking */}
          <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-12rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-[14px]">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">PSS No.</th>
                  <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800">Customer</th>
                  <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Kota Tujuan</th>
                  <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Terima dari HQ</th>
                  <th className="px-4 py-3 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Sisa Hari</th>
                  <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Ref. HQ</th>
                  <th className="px-4 py-3 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-[14px]">
                      Memuat data crossdocking...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && tmsAvail !== false && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-[14px]">
                      Belum ada data crossdocking untuk periode bulan ini. Klik <strong>+ Tambah Crossdocking</strong> untuk mulai.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const sisa = r.promised_delivery_date
                    ? daysDiff(today, r.promised_delivery_date)
                    : null
                  const isUrgent = sisa !== null && sisa <= 2 && r.status !== 'Delivered'
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setEditId(r.id)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                    >
                      {/* PSS No */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[14px] font-semibold text-indigo-700">{r.pss_no ?? '—'}</span>
                      </td>
                      {/* Customer */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="text-[14px] font-medium text-slate-800 truncate" title={r.customer_name ?? undefined}>
                          {r.customer_name ?? '—'}
                        </div>
                      </td>
                      {/* Kota */}
                      <td className="px-4 py-3 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                        {r.destination_city ?? '—'}
                      </td>
                      {/* Terima dari HQ */}
                      <td className="px-4 py-3 text-[14px] font-medium text-slate-600 whitespace-nowrap">
                        {r.received_from_hq_date?.slice(0, 10) ?? '—'}
                      </td>
                      {/* Sisa Hari */}
                      <td className="px-4 py-3 text-center">
                        {sisa !== null && r.status !== 'Delivered' ? (
                          <span
                            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                              isUrgent
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                : sisa <= 7
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sisa > 0 ? `${sisa}h` : sisa === 0 ? 'Hari ini' : `${Math.abs(sisa)}h lalu`}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      {/* Ref HQ */}
                      <td className="px-4 py-3 text-[14px] font-mono text-slate-600 whitespace-nowrap">
                        {r.hq_reference_no ?? '—'}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Side panel */}
      {editId !== undefined && (
        <CrossdockingPanel
          crossdockingId={editId}
          onClose={() => setEditId(undefined)}
          onSaved={() => {
            setEditId(undefined)
            load()
          }}
        />
      )}
    </div>
  )
}
