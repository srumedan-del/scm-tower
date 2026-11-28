'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { getTkbmRates, type TkbmRateRow } from './actions'
import TkbmRateEditPanel, { formatTkbmRate } from '@/components/tkbm-rate/TkbmRateEditPanel'
import { SkeletonRows } from '@/components/ui/LoadingStates'

const th = 'px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap'
const td = 'px-4 py-3 text-sm font-medium text-slate-600'

export default function TkbmRatePage() {
  const [rows, setRows] = useState<TkbmRateRow[]>([])
  const [selected, setSelected] = useState<TkbmRateRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()

  function load() {
    startLoad(async () => {
      try { setRows(await getTkbmRates()); setError(null) }
      catch (e: any) { setError(e.message) }
    })
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return rows
    return rows.filter(r => r.customer_name.includes(q) || (r.customer_code ?? '').includes(q))
  }, [rows, query])

  const perKoli = rows.filter(r => r.is_active && r.rate_type === 'per_koli').length
  const perBulan = rows.filter(r => r.is_active && r.rate_type === 'per_bulan').length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tarif TKBM</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Biaya bongkar muat (TKBM/SPSI) di tujuan · {perKoli} per koli · {perBulan} flat per bulan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari customer atau kode"
            className="h-10 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Tambah Tarif
          </button>
        </div>
      </header>

      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={th}>Kode</th>
              <th className={th}>Customer</th>
              <th className={th}>Tarif</th>
              <th className={th}>Berlaku Sejak</th>
              <th className={th}>Catatan</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && <SkeletonRows cols={6} />}
            {error && (
              <tr><td colSpan={6} className="px-4 py-6 text-sm text-red-600">{error}</td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">Belum ada tarif TKBM.</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} onClick={() => setSelected(r)} className="hover:bg-blue-50 cursor-pointer">
                <td className={`${td} font-mono`}>{r.customer_code ?? <span className="text-amber-600">Belum ada</span>}</td>
                <td className={td}>{r.customer_name}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs ${r.rate_type === 'per_koli' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                    {r.rate_type === 'per_koli' ? 'Per koli' : 'Per bulan'}
                  </span>
                  {formatTkbmRate(r)}
                </td>
                <td className={`${td} whitespace-nowrap`}>{new Date(`${r.effective_from}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className={`${td} text-slate-500`}>{r.notes ?? '-'}</td>
                <td className={td}>
                  <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(selected || adding) && (
        <TkbmRateEditPanel
          rate={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
