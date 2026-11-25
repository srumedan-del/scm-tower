'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Boxes, Download, Layers, Search, Warehouse } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { getStockByDate, getStockDates, type StockRow } from './actions'

type View = 'lot' | 'item' | 'bin'

// Batch yang kedaluwarsa dalam 180 hari ditandai agar bisa didahulukan (FEFO).
const NEAR_EXPIRY_DAYS = 180

const fmtQty = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 })
const fmtDate = (d: string | null, long = false) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: long ? 'long' : 'short', year: 'numeric', ...(long ? { weekday: 'long' } : {}) }) : '-'

function daysUntil(date: string | null, from: string) {
  if (!date) return null
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

function Delta({ qty, prev }: { qty: number; prev: number | null }) {
  if (prev == null) return <span className="text-slate-400">-</span>
  const diff = qty - prev
  if (diff === 0) return <span className="text-slate-400">0</span>
  return <span className={diff > 0 ? 'text-green-700' : 'text-red-700'}>{diff > 0 ? '+' : '−'}{fmtQty(Math.abs(diff))}</span>
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

function downloadCsv(filename: string, header: string[], lines: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header, ...lines].map(row => row.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const th = 'px-4 py-3 text-left text-[13px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap'
const td = 'px-4 py-2.5 text-sm text-slate-700'

export default function StokCabangMedanPage() {
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [prevDate, setPrevDate] = useState<string | null>(null)
  const [rows, setRows] = useState<StockRow[]>([])
  const [error, setError] = useState('')
  const [datesLoaded, setDatesLoaded] = useState(false)
  const [pending, startLoad] = useTransition()
  const loading = pending || !datesLoaded

  const [view, setView] = useState<View>('lot')
  const [bin, setBin] = useState('all')
  const [kategori, setKategori] = useState('all')
  const [query, setQuery] = useState('')
  const [nearOnly, setNearOnly] = useState(false)

  function load(target: string) {
    setDate(target)
    startLoad(async () => {
      try {
        const res = await getStockByDate(target)
        setRows(res.rows)
        setPrevDate(res.prevDate)
        setError('')
      } catch (e: any) {
        setError(e?.message ?? 'Gagal memuat stok')
      }
    })
  }

  useEffect(() => {
    getStockDates()
      .then(list => {
        setDates(list)
        if (list[0]) load(list[0])
      })
      .catch(e => setError(e?.message ?? 'Gagal memuat tanggal'))
      .finally(() => setDatesLoaded(true))
  }, [])

  const bins = useMemo(() => [...new Set(rows.map(r => r.bincode ?? '-'))].sort(), [rows])
  const categories = useMemo(() => [...new Set(rows.map(r => r.kategori ?? '-'))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (bin !== 'all' && (r.bincode ?? '-') !== bin) return false
      if (kategori !== 'all' && (r.kategori ?? '-') !== kategori) return false
      if (nearOnly) {
        const left = daysUntil(r.expiration_date, date)
        if (left == null || left > NEAR_EXPIRY_DAYS) return false
      }
      if (!q) return true
      return [r.no_item, r.nama_item, r.lot_no, r.serial_no].some(v => v?.toLowerCase().includes(q))
    })
  }, [rows, bin, kategori, query, nearOnly, date])

  const lotRows = useMemo(() => [...filtered].sort((a, b) =>
    (a.bincode ?? '').localeCompare(b.bincode ?? '') ||
    a.no_item.localeCompare(b.no_item) ||
    (a.expiration_date ?? '9999').localeCompare(b.expiration_date ?? '9999') ||
    (a.lot_no ?? '').localeCompare(b.lot_no ?? '')), [filtered])

  const itemRows = useMemo(() => {
    const map = new Map<string, { no_item: string; nama_item: string | null; kategori: string | null; bins: Set<string>; lots: number; qty: number; prev: number | null; nearestExpiry: string | null }>()
    for (const r of filtered) {
      const g = map.get(r.no_item) ?? { no_item: r.no_item, nama_item: r.nama_item, kategori: r.kategori, bins: new Set<string>(), lots: 0, qty: 0, prev: r.prev_qty == null ? null : 0, nearestExpiry: null }
      g.bins.add(r.bincode ?? '-')
      g.lots += 1
      g.qty += r.qty
      if (g.prev != null && r.prev_qty != null) g.prev += r.prev_qty
      if (r.expiration_date && (!g.nearestExpiry || r.expiration_date < g.nearestExpiry)) g.nearestExpiry = r.expiration_date
      map.set(r.no_item, g)
    }
    return [...map.values()].sort((a, b) => a.no_item.localeCompare(b.no_item))
  }, [filtered])

  const binRows = useMemo(() => {
    const map = new Map<string, { bin: string; items: Set<string>; lots: number; qty: number; prev: number | null }>()
    for (const r of filtered) {
      const key = r.bincode ?? '-'
      const g = map.get(key) ?? { bin: key, items: new Set<string>(), lots: 0, qty: 0, prev: r.prev_qty == null ? null : 0 }
      g.items.add(r.no_item)
      g.lots += 1
      g.qty += r.qty
      if (g.prev != null && r.prev_qty != null) g.prev += r.prev_qty
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty)
  }, [filtered])

  const totalQty = filtered.reduce((s, r) => s + r.qty, 0)
  const nearCount = filtered.filter(r => { const d = daysUntil(r.expiration_date, date); return d != null && d <= NEAR_EXPIRY_DAYS }).length

  function exportCsv() {
    const name = `stok-medan-${date}${bin !== 'all' ? `-${bin}` : ''}-${view}.csv`
    if (view === 'lot') downloadCsv(name, ['Tanggal', 'Bin', 'No Item', 'Nama Item', 'Kategori', 'LOT', 'Serial', 'Expired', 'Qty', 'Qty Sebelumnya'],
      lotRows.map(r => [date, r.bincode, r.no_item, r.nama_item, r.kategori, r.lot_no, r.serial_no, r.expiration_date, r.qty, r.prev_qty]))
    else if (view === 'item') downloadCsv(name, ['Tanggal', 'No Item', 'Nama Item', 'Kategori', 'Bin', 'Jumlah LOT', 'Expired Terdekat', 'Qty', 'Qty Sebelumnya'],
      itemRows.map(r => [date, r.no_item, r.nama_item, r.kategori, [...r.bins].join(' / '), r.lots, r.nearestExpiry, r.qty, r.prev]))
    else downloadCsv(name, ['Tanggal', 'Bin', 'Jumlah Item', 'Jumlah LOT', 'Qty', 'Qty Sebelumnya'],
      binRows.map(r => [date, r.bin, r.items.size, r.lots, r.qty, r.prev]))
  }

  const prevLabel = prevDate ? `vs ${fmtDate(prevDate)}` : 'Perubahan'

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Stok Cabang Medan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gudang Paragon Medan (MDN-PAR) · posisi stok jam 07.00 {date ? `· ${fmtDate(date, true)}` : ''} · satuan qty sesuai item
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-600" htmlFor="stok-date">Tanggal</label>
          <select
            id="stok-date"
            value={date}
            onChange={e => load(e.target.value)}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            {dates.map(d => <option key={d} value={d}>{fmtDate(d, true)}</option>)}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
          </button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total qty" value={fmtQty(totalQty)} hint={bin === 'all' ? 'semua bin' : bin} />
        <Kpi label="Item" value={fmtQty(itemRows.length)} />
        <Kpi label="LOT" value={fmtQty(filtered.length)} hint={`${binRows.length} bin`} />
        <Kpi label="Expired ≤ 6 bulan" value={fmtQty(nearCount)} hint="baris LOT" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter store bin">
          {['all', ...bins].map(b => (
            <button
              key={b}
              type="button"
              aria-pressed={bin === b}
              onClick={() => setBin(b)}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${bin === b ? 'border-indigo-900 bg-indigo-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
            >
              {b === 'all' ? 'Semua bin' : b}
            </button>
          ))}
        </div>
        <select
          value={kategori}
          onChange={e => setKategori(e.target.value)}
          aria-label="Filter kategori"
          className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">Semua kategori</option>
          {categories.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={nearOnly} onChange={e => setNearOnly(e.target.checked)} className="rounded border-slate-300" />
          Hanya expired ≤ 6 bulan
        </label>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari item, nama, LOT, serial"
            aria-label="Cari item, nama, LOT atau serial"
            className="min-h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <Tabs
        label="Tampilan stok"
        value={view}
        onChange={setView}
        items={[
          { value: 'lot', label: 'Per LOT', icon: Layers, count: lotRows.length },
          { value: 'item', label: 'Per Material', icon: Boxes, count: itemRows.length },
          { value: 'bin', label: 'Per Store Bin', icon: Warehouse, count: binRows.length },
        ]}
      />

      <div className="data-list-scroll max-h-[calc(100vh-340px)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-[14px]">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            {view === 'lot' && (
              <tr>
                <th className={th}>Store Bin</th><th className={th}>No Item</th><th className={th}>Nama Item</th>
                <th className={th}>LOT</th><th className={th}>Expired</th>
                <th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>{prevLabel}</th>
              </tr>
            )}
            {view === 'item' && (
              <tr>
                <th className={th}>No Item</th><th className={th}>Nama Item</th><th className={th}>Kategori</th>
                <th className={th}>Store Bin</th><th className={`${th} text-right`}>LOT</th><th className={th}>Expired terdekat</th>
                <th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>{prevLabel}</th>
              </tr>
            )}
            {view === 'bin' && (
              <tr>
                <th className={th}>Store Bin</th><th className={`${th} text-right`}>Item</th><th className={`${th} text-right`}>LOT</th>
                <th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>{prevLabel}</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <SkeletonRows cols={view === 'bin' ? 5 : view === 'lot' ? 7 : 8} />}
            {!loading && !filtered.length && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{dates.length ? 'Tidak ada stok yang cocok dengan filter.' : 'Belum ada data stok.'}</td></tr>
            )}
            {!loading && view === 'lot' && lotRows.map(r => {
              const left = daysUntil(r.expiration_date, date)
              const near = left != null && left <= NEAR_EXPIRY_DAYS
              return (
                <tr key={`${r.bincode}|${r.no_item}|${r.lot_no}|${r.serial_no}`} className="hover:bg-slate-50">
                  <td className={`${td} whitespace-nowrap`}>{r.bincode ?? '-'}</td>
                  <td className={`${td} whitespace-nowrap font-semibold text-slate-900`}>{r.no_item}</td>
                  <td className={td}>{r.nama_item ?? '-'}<div className="text-xs text-slate-400">{r.kategori}</div></td>
                  <td className={`${td} whitespace-nowrap font-mono text-[13px]`}>{r.lot_no ?? '-'}{r.serial_no ? <div className="text-xs text-slate-400">SN {r.serial_no}</div> : null}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {r.expiration_date
                      ? <span className={near ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800' : ''}>{fmtDate(r.expiration_date)}</span>
                      : '-'}
                  </td>
                  <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{fmtQty(r.qty)}</td>
                  <td className={`${td} text-right tabular-nums`}><Delta qty={r.qty} prev={r.prev_qty} /></td>
                </tr>
              )
            })}
            {!loading && view === 'item' && itemRows.map(r => (
              <tr key={r.no_item} className="hover:bg-slate-50">
                <td className={`${td} whitespace-nowrap font-semibold text-slate-900`}>{r.no_item}</td>
                <td className={td}>{r.nama_item ?? '-'}</td>
                <td className={`${td} whitespace-nowrap`}>{r.kategori ?? '-'}</td>
                <td className={`${td} whitespace-nowrap`}>{[...r.bins].join(' / ')}</td>
                <td className={`${td} text-right tabular-nums`}>{r.lots}</td>
                <td className={`${td} whitespace-nowrap`}>{fmtDate(r.nearestExpiry)}</td>
                <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{fmtQty(r.qty)}</td>
                <td className={`${td} text-right tabular-nums`}><Delta qty={r.qty} prev={r.prev} /></td>
              </tr>
            ))}
            {!loading && view === 'bin' && binRows.map(r => (
              <tr key={r.bin} className="cursor-pointer hover:bg-slate-50" onClick={() => { setBin(r.bin); setView('lot') }} title="Lihat LOT di bin ini">
                <td className={`${td} whitespace-nowrap font-semibold text-slate-900`}>{r.bin}</td>
                <td className={`${td} text-right tabular-nums`}>{r.items.size}</td>
                <td className={`${td} text-right tabular-nums`}>{r.lots}</td>
                <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{fmtQty(r.qty)}</td>
                <td className={`${td} text-right tabular-nums`}><Delta qty={r.qty} prev={r.prev} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Sumber: snapshot stok SIRUP jam 07.00 hari kerja. Detail per hari tersimpan 30 hari di SCM Tower; tanggal yang lebih lama ada di arsip CSV D:/sirup.
        Kolom perubahan membandingkan qty item, bin dan LOT yang sama dengan snapshot sebelumnya.
      </p>
    </div>
  )
}
