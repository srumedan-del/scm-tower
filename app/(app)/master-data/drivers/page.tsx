'use client'

import { useEffect, useState, useTransition } from 'react'
import { getDrivers, type DriverRow } from './actions'
import DriverEditPanel from '@/components/driver/DriverEditPanel'
import { Plus, UserCheck, UserX, Truck, Users, KeyRound, Smartphone } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/LoadingStates'

const roleBadge = (role: string) =>
  role === 'Driver'
    ? 'bg-indigo-100 text-indigo-700'
    : 'bg-purple-100 text-purple-700'

export default function DriversPage() {
  const [rows, setRows]         = useState<DriverRow[]>([])
  const [selected, setSelected] = useState<DriverRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [roleFilter, setRoleFilter] = useState<'all' | 'Driver' | 'Helper'>('all')
  const [loading, startLoading] = useTransition()

  function reload() {
    startLoading(async () => {
      try {
        const d = await getDrivers()
        setRows(d)
      } catch (e) {
        console.error(e)
      }
    })
  }

  useEffect(() => { reload() }, [])

  const filtered = rows.filter(r => roleFilter === 'all' || r.role === roleFilter)
  const driverCount = rows.filter(r => r.role === 'Driver').length
  const helperCount = rows.filter(r => r.role === 'Helper').length

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Driver & Helper</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kru internal SRU — {driverCount} Driver · {helperCount} Helper · Terhubung ke SCM Driver APK
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 shadow-xs transition-colors"
        >
          <Plus className="h-4 w-4" /> Tambah Kru
        </button>
      </header>

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

      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Kode</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Nama</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Role</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Akun Login APK</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">No. SIM</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">No. HP</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <SkeletonRows cols={8} />
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-3 text-sm font-medium text-slate-600">
                {rows.length === 0
                  ? 'Belum ada data driver.'
                  : 'Tidak ada kru dengan filter ini.'}
              </td></tr>
            )}
            {filtered.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm font-mono font-bold text-slate-800">{r.driver_code}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{r.driver_name}</td>
                <td className="px-4 py-3 text-sm text-center">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${roleBadge(r.role)}`}>
                    {r.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                      {r.username ?? r.driver_code.toLowerCase()}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span className="bg-amber-50 border border-amber-100 text-amber-800 px-2 py-0.5 rounded tracking-wider font-bold">
                      {r.pin_is_default ? 'PIN default' : '••••••'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-600">{r.sim_no ?? '-'}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-600">{r.phone ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {r.is_active
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5"><UserCheck className="h-3 w-3" /> Aktif</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"><UserX className="h-3 w-3" /> Nonaktif</span>
                  }
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-600">{r.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(selected || adding) && (
        <DriverEditPanel
          driver={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { reload(); setSelected(null); setAdding(false) }}
        />
      )}
    </div>
  )
}
