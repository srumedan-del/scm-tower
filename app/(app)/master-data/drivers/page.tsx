'use client'

import { useEffect, useState, useTransition } from 'react'
import { getDrivers, type DriverRow } from './actions'
import DriverEditPanel from '@/components/driver/DriverEditPanel'
import { Plus, UserCheck, UserX } from 'lucide-react'

export default function DriversPage() {
  const [rows, setRows]         = useState<DriverRow[]>([])
  const [selected, setSelected] = useState<DriverRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()

  function load() {
    startLoad(async () => {
      try { setRows(await getDrivers()) } catch { /* ignore */ }
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Driver</h1>
          <p className="text-sm text-gray-500 mt-0.5">Driver internal SRU — armada 2 unit truck</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Tambah Driver
        </button>
      </header>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Kode</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Nama Driver</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">No. SIM</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">No. HP</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                Belum ada data driver. Jalankan schema SQL di Supabase dulu.
              </td></tr>
            )}
            {rows.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="hover:bg-blue-50 cursor-pointer"
              >
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600">{r.driver_code}</td>
                <td className="px-4 py-2.5 font-medium">{r.driver_name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.sim_no ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs">{r.phone ?? '-'}</td>
                <td className="px-4 py-2.5 text-center">
                  {r.is_active
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5"><UserCheck className="h-3 w-3" /> Aktif</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"><UserX className="h-3 w-3" /> Nonaktif</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{r.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(selected || adding) && (
        <DriverEditPanel
          driver={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
