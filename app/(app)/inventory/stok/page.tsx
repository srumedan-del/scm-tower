'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Boxes, Download, Layers, Search, Warehouse } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { getStockByDate, getStockDates, type StockRow } from './actions'

type View = 'lot' | 'item' | 'bin'

// Bin utama gudang Medan; bin lain dipilih lewat dropdown.
const DEFAULT_BIN = 'MDN-PAR-CON'
// Pilihan batas expired (bulan) untuk tombol "Expired < N bulan".
const EXPIRY_MONTH_OPTIONS = [1, 3, 6, 12] as const

/** Expired sebelum tanggal snapshot + N bulan. */
function addMonthsIso(date: string, months: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

const fmtQty = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 })
const fmtDate = (d: string | null, long = false) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: long ? 'long' : 'short', year: 'numeric', ...(long ? { weekday: 'long' } : {}) }) : '-'

function Delta({ qty, prev }: { qty: number; prev: number | null }) {
  if (prev == null) return <span className="text-slate-400">-</span>
  const diff = qty - prev
  if (diff === 0) return <span className="text-slate-400">0</span>
  return <span className={diff > 0 ? 'text-green-700' : 'text-red-700'}>{diff > 0 ? '+' : '−'}{fmtQty(Math.abs(diff))}</span>
}

async function downloadExcel(filename: string, sheetName: string, header: string[], lines: (string | number | null)[][]) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([header, ...lines])
  sheet['!cols'] = header.map((h, i) => ({ wch: Math.min(60, Math.max(h.length, ...lines.map(l => String(l[i] ?? '').length)) + 2) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31))
  XLSX.writeFile(book, filename)
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
  const [bin, setBin] = useState(DEFAULT_BIN)
  const [kategori, setKategori] = useState('all')
  const [query, setQuery] = useState('')
  const [expiryOn, setExpiryOn] = useState(false)
  const [expiryMonths, setExpiryMonths] = useState<number>(6)
  const expiryLimit = date ? addMonthsIso(date, expiryMonths) : ''

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
      if (expiryOn && (!r.expiration_date || r.expiration_date >= expiryLimit)) return false
      if (!q) return true
      return [r.no_item, r.nama_item, r.lot_no, r.serial_no].some(v => v?.toLowerCase().includes(q))
    })
  }, [rows, bin, kategori, query, expiryOn, expiryLimit])

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

  function exportExcel() {
    const name = `stok-medan-${date}${bin !== 'all' ? `-${bin}` : ''}-${view}.xlsx`
    const sheet = view === 'lot' ? 'Per LOT' : view === 'item' ? 'Per Material' : 'Per Store Bin'
    if (view === 'lot') downloadExcel(name, sheet,['Tanggal', 'Bin', 'No Item', 'Nama Item', 'Kategori', 'LOT', 'Serial', 'Expired', 'Qty', 'Qty Sebelumnya'],
      lotRows.map(r => [date, r.bincode, r.no_item, r.nama_item, r.kategori, r.lot_no, r.serial_no, r.expiration_date, r.qty, r.prev_qty]))
    else if (view === 'item') downloadExcel(name, sheet,['Tanggal', 'No Item', 'Nama Item', 'Kategori', 'Bin', 'Jumlah LOT', 'Expired Terdekat', 'Qty', 'Qty Sebelumnya'],
      itemRows.map(r => [date, r.no_item, r.nama_item, r.kategori, [...r.bins].join(' / '), r.lots, r.nearestExpiry, r.qty, r.prev]))
    else downloadExcel(name, sheet,['Tanggal', 'Bin', 'Jumlah Item', 'Jumlah LOT', 'Qty', 'Qty Sebelumnya'],
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
            onClick={exportExcel}
            disabled={!filtered.length}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export Excel
          </button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="stok-bin">Store bin</label>
        <select
          id="stok-bin"
          value={bin}
          onChange={e => setBin(e.target.value)}
          className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
        >
          {[...new Set([DEFAULT_BIN, ...bins])].map(b => <option key={b} value={b}>Bin {b}</option>)}
          <option value="all">Semua bin</option>
        </select>
        <select
          value={kategori}
          onChange={e => setKategori(e.target.value)}
          aria-label="Filter kategori"
          className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">Semua kategori</option>
          {categories.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <div className={`inline-flex min-h-9 items-center overflow-hidden rounded-xl border text-sm font-semibold ${expiryOn ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700'}`}>
          <button
            type="button"
            aria-pressed={expiryOn}
            onClick={() => setExpiryOn(on => !on)}
            className="min-h-9 px-3 hover:bg-black/5"
          >
            Expired &lt;
          </button>
          <select
            value={expiryMonths}
            onChange={e => { setExpiryMonths(Number(e.target.value)); setExpiryOn(true) }}
            aria-label="Batas bulan expired"
            className="min-h-9 border-l border-inherit bg-transparent px-2 font-semibold"
          >
            {EXPIRY_MONTH_OPTIONS.map(m => <option key={m} value={m}>{m} bulan</option>)}
          </select>
        </div>
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

      <div className="data-list-scroll max-h-[calc(100vh-250px)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
              // Tandai batch yang expired sebelum batas tombol "Expired <" (FEFO).
              const near = !!r.expiration_date && !!expiryLimit && r.expiration_date < expiryLimit
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
    </div>
  )
}
