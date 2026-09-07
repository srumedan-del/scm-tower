'use client'

import { useEffect, useState, useTransition } from 'react'
import { getDrivers, type DriverRow } from './actions'
import DriverEditPanel from '@/components/driver/DriverEditPanel'
import { Plus, UserCheck, UserX, Truck, Users } from 'lucide-react'

const roleBadge = (role: string) =>
  role === 'Driver'
    ? 'bg-indigo-100 text-indigo-700'
    : 'bg-purple-100 text-purple-700'

export default function DriversPage() {
  const [rows, setRows]         = useState<DriverRow[]>([])
  const [selected, setSelected] = useState<DriverRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()
  const [roleFilter, setRoleFilter] = useState<string>('all')

  function load() {
    startLoad(async () => {
      try { setRows(await getDrivers()) } catch { /* ignore */ }
    })
  }

  useEffect(() => { load() }, [])

  const filtered = roleFilter === 'all' ? rows : rows.filter(r => r.role === roleFilter)
  const driverCount = rows.filter(r => r.role === 'Driver').length
  const helperCount = rows.filter(r => r.role === 'Helper').length

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Driver & Helper</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kru internal SRU — {driverCount} Driver · {helperCount} Helper
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Tambah Kru
        </button>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Kru</div>
        </div>
        <div className="rounded-xl border bg-indigo-50 p-3">
          <div className="text-2xl font-bold text-indigo-700">{driverCount}</div>
          <div className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1"><Truck className="h-3 w-3" /> Driver</div>
        </div>
        <div className="rounded-xl border bg-purple-50 p-3">
          <div className="text-2xl font-bold text-purple-700">{helperCount}</div>
          <div className="text-xs text-purple-600 mt-0.5 flex items-center gap-1"><Users className="h-3 w-3" /> Helper</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'Driver', 'Helper'] as const).map(f => (
          <button
            key={f}
            onClick={() => setRoleFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              roleFilter === f ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'Semua' : f}
          </button>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Kode</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Nama</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Role</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">No. SIM</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">No. HP</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                {rows.length === 0
                  ? 'Belum ada data. Jalankan schema SQL di Supabase dulu.'
                  : 'Tidak ada kru dengan filter ini.'}
              </td></tr>
            )}
            {filtered.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="hover:bg-blue-50 cursor-pointer"
              >
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600">{r.driver_code}</td>
                <td className="px-4 py-2.5 font-medium">{r.driver_name}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${roleBadge(r.role)}`}>
                    {r.role}
                  </span>
                </td>
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
