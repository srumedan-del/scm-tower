'use client'

import { useEffect, useState, useTransition } from 'react'
import { getTransporters, type TransporterRow } from './actions'
import TransporterEditPanel from '@/components/transporter/TransporterEditPanel'
import { Plus } from 'lucide-react'

const typeColor = (type: string) =>
  type === 'Internal'
    ? 'bg-indigo-100 text-indigo-700'
    : 'bg-emerald-100 text-emerald-700'

const modelColor = (model: string | null) => {
  if (!model) return 'bg-gray-100 text-gray-500'
  if (model === 'Retail')   return 'bg-orange-100 text-orange-700'
  if (model === 'Trucking') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-500'
}

export default function TransportersPage() {
  const [rows, setRows]         = useState<TransporterRow[]>([])
  const [selected, setSelected] = useState<TransporterRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()

  function load() {
    startLoad(async () => {
      try { setRows(await getTransporters()) } catch { /* ignore */ }
    })
  }

  useEffect(() => { load() }, [])

  const internal  = rows.filter(r => r.type === 'Internal')
  const eksternal = rows.filter(r => r.type === 'Eksternal')

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Transporter</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {internal.length} Internal · {eksternal.length} Eksternal
            ({eksternal.filter(r => r.service_model === 'Retail').length} Retail,{' '}
            {eksternal.filter(r => r.service_model === 'Trucking').length} Trucking)
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Tambah Transporter
        </button>
      </header>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Kode</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Nama</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Tipe</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Model Layanan</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">PIC</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Phone</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                Belum ada data. Jalankan schema SQL di Supabase dulu.
              </td></tr>
            )}
            {rows.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="hover:bg-blue-50 cursor-pointer"
              >
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-600">{r.transporter_code}</td>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block text-xs rounded-full px-2 py-0.5 font-medium ${typeColor(r.type)}`}>
                    {r.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block text-xs rounded-full px-2 py-0.5 font-medium ${modelColor(r.service_model)}`}>
                    {r.service_model ?? 'Operasional Aktual'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">{r.pic_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs">{r.pic_phone ?? '-'}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${
                    r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(selected || adding) && (
        <TransporterEditPanel
          transporter={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
