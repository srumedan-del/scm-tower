'use client'

import { useEffect, useState, useTransition } from 'react'
import { getCrossdockings, type CrossdockingHeader } from './actions'
import CrossdockingPanel from '@/components/crossdocking/CrossdockingPanel'
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

  function load() {
    startLoad(async () => {
      try {
        setRows(await getCrossdockings())
        setAvail(true)
      } catch (e: any) {
        if (e.message?.includes('schema cache')) setAvail(false)
      }
    })
  }

  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">CROSSDOCKING</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Shipment dari Kantor Pusat via Medan — input manual
          </p>
        </div>
        <button
          onClick={() => setEditId(null)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Tambah Crossdocking
        </button>
      </header>

      {/* Schema belum ada */}
      {tmsAvail === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Schema TMS belum dijalankan.</strong> Buka Supabase SQL Editor dan jalankan{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema_tms.sql</code>{' '}
          untuk membuat tabel <code className="font-mono bg-amber-100 px-1 rounded">crossdocking_header</code>.
        </div>
      )}

      {/* Stats */}
      {tmsAvail === true && (
        <div className="grid grid-cols-4 gap-3">
          {(['Draft', 'Ready', 'Dispatched', 'Delivered'] as const).map(s => {
            const count = rows.filter(r => r.status === s).length
            const colors: Record<string, string> = {
              Draft: 'text-gray-700 bg-gray-50',
              Ready: 'text-blue-700 bg-blue-50',
              Dispatched: 'text-orange-700 bg-orange-50',
              Delivered: 'text-green-700 bg-green-50',
            }
            return (
              <div key={s} className={`rounded-xl border p-3 ${colors[s]}`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs mt-0.5 opacity-80">{s}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">CD No.</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Customer / Tujuan</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Terima dari HQ</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Promised Date</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Sisa Hari</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Ref. HQ</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && tmsAvail !== false && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Belum ada crossdocking. Klik <strong>+ Tambah Crossdocking</strong> untuk mulai.
                </td>
              </tr>
            )}
            {rows.map(r => {
              const sisa = r.promised_delivery_date
                ? daysDiff(today, r.promised_delivery_date)
                : null
              const isUrgent = sisa !== null && sisa <= 2 && r.status !== 'Delivered'
              return (
                <tr
                  key={r.id}
                  onClick={() => setEditId(r.id)}
                  className="hover:bg-blue-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">
                    {r.crossdocking_no}
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[180px]">
                    <div className="font-medium truncate">{r.customer_name ?? '-'}</div>
                    {r.destination_address && (
                      <div className="text-gray-400 text-xs truncate">{r.destination_address}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {r.received_from_hq_date?.slice(0, 10) ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {r.promised_delivery_date?.slice(0, 10) ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {sisa !== null && r.status !== 'Delivered' ? (
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                        isUrgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {sisa > 0 ? `${sisa}h` : sisa === 0 ? 'Hari ini' : `${Math.abs(sisa)}h lalu`}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                    {r.hq_reference_no ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">
                    {r.notes ?? '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Panel form */}
      {editId !== undefined && (
        <CrossdockingPanel
          crossdockingId={editId}
          onClose={() => setEditId(undefined)}
          onSaved={() => { setEditId(undefined); load() }}
        />
      )}
    </div>
  )
}
