'use client'

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, Search } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { getStockByDate, getStockDates, type StockRow } from './actions'

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
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
/** YYYY-MM-DD -> DD/MM/YYYY; long menambahkan nama hari ("Rabu, 25/11/2026"). */
const fmtDate = (d: string | null, long = false) => {
  if (!d) return '-'
  const [y, m, day] = d.slice(0, 10).split('-')
  const text = `${day}/${m}/${y}`
  return long ? `${DAYS[new Date(`${d.slice(0, 10)}T00:00:00Z`).getUTCDay()]}, ${text}` : text
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
  const [rows, setRows] = useState<StockRow[]>([])
  const [error, setError] = useState('')
  const [datesLoaded, setDatesLoaded] = useState(false)
  const [pending, startLoad] = useTransition()
  const loading = pending || !datesLoaded

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

  // dates terurut terbaru dulu.
  const dateIndex = dates.indexOf(date)
  const older = dateIndex >= 0 ? dates[dateIndex + 1] : undefined
  const newer = dateIndex > 0 ? dates[dateIndex - 1] : undefined
  const dateInput = useRef<HTMLInputElement>(null)
  const [dateNote, setDateNote] = useState('')

  /** Tanggal tanpa snapshot (libur/belum ada) memakai snapshot terakhir sebelum tanggal itu. */
  function pickDate(target: string) {
    if (!target) return
    if (dates.includes(target)) { setDateNote(''); load(target); return }
    const fallback = dates.find(d => d < target)
    if (!fallback) { setDateNote(`Tidak ada data stok untuk ${fmtDate(target)}.`); return }
    setDateNote(`Tidak ada snapshot tanggal ${fmtDate(target)}; ditampilkan stok ${fmtDate(fallback, true)}.`)
    load(fallback)
  }

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

  // Satu baris total per item; LOT-nya dibuka lewat tombol expand.
  const itemGroups = useMemo(() => {
    const map = new Map<string, { no_item: string; nama_item: string | null; bins: Set<string>; lots: StockRow[]; qty: number; nearestExpiry: string | null }>()
    for (const r of filtered) {
      const g = map.get(r.no_item) ?? { no_item: r.no_item, nama_item: r.nama_item, bins: new Set<string>(), lots: [], qty: 0, nearestExpiry: null }
      g.bins.add(r.bincode ?? '-')
      g.lots.push(r)
      g.qty += r.qty
      if (r.expiration_date && (!g.nearestExpiry || r.expiration_date < g.nearestExpiry)) g.nearestExpiry = r.expiration_date
      map.set(r.no_item, g)
    }
    for (const g of map.values()) g.lots.sort((a, b) =>
      (a.expiration_date ?? '9999').localeCompare(b.expiration_date ?? '9999') ||
      (a.lot_no ?? '').localeCompare(b.lot_no ?? '') ||
      (a.bincode ?? '').localeCompare(b.bincode ?? ''))
    return [...map.values()].sort((a, b) => a.no_item.localeCompare(b.no_item))
  }, [filtered])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Saat mencari (mis. nomor LOT), detail LOT langsung terlihat.
  const searching = query.trim().length > 0
  const isOpen = (item: string) => searching || expanded.has(item)
  const allOpen = itemGroups.length > 0 && itemGroups.every(g => expanded.has(g.no_item))
  const toggle = (item: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(item)) next.delete(item)
    else next.add(item)
    return next
  })

  function exportExcel() {
    const name = `stok-medan-${date}${bin !== 'all' ? `-${bin}` : ''}.xlsx`
    const lines: (string | number | null)[][] = []
    for (const g of itemGroups) {
      lines.push([fmtDate(date), g.no_item, g.nama_item, `${g.lots.length} LOT`, null, g.nearestExpiry ? fmtDate(g.nearestExpiry) : null, g.qty, [...g.bins].join(' / ')])
      for (const r of g.lots) lines.push([fmtDate(date), r.no_item, r.nama_item, r.lot_no, r.serial_no, r.expiration_date ? fmtDate(r.expiration_date) : null, r.qty, r.bincode])
    }
    downloadExcel(name, 'Stok Medan', ['Tanggal', 'No Item', 'Nama Item', 'LOT', 'Serial', 'Expired', 'Qty', 'Store Bin'], lines)
  }

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
          <span className="text-sm font-semibold text-slate-600">Tanggal</span>
          <div className="inline-flex min-h-10 items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => { if (older) { setDateNote(''); load(older) } }}
              disabled={!older || loading}
              aria-label="Tanggal sebelumnya"
              title={older ? fmtDate(older) : undefined}
              className="grid h-10 w-9 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => { try { dateInput.current?.showPicker() } catch { dateInput.current?.focus() } }}
                className="inline-flex h-10 items-center gap-2 border-x border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {date ? fmtDate(date, true) : 'Pilih tanggal'}
              </button>
              <input
                ref={dateInput}
                type="date"
                aria-label="Pilih tanggal stok"
                value={date}
                min={dates[dates.length - 1]}
                max={dates[0]}
                onChange={e => pickDate(e.target.value)}
                className="pointer-events-none absolute inset-0 opacity-0"
                tabIndex={-1}
              />
            </div>
            <button
              type="button"
              onClick={() => { if (newer) { setDateNote(''); load(newer) } }}
              disabled={!newer || loading}
              aria-label="Tanggal berikutnya"
              title={newer ? fmtDate(newer) : undefined}
              className="grid h-10 w-9 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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

      {dateNote && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{dateNote}</div>}
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


      <div className="data-list-scroll max-h-[calc(100vh-200px)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-[14px]">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={`${th} w-10 !px-2`}>
                <button
                  type="button"
                  onClick={() => setExpanded(allOpen ? new Set() : new Set(itemGroups.map(g => g.no_item)))}
                  disabled={searching || !itemGroups.length}
                  title={allOpen ? 'Tutup semua LOT' : 'Buka semua LOT'}
                  aria-label={allOpen ? 'Tutup semua LOT' : 'Buka semua LOT'}
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/60 disabled:opacity-40"
                >
                  {allOpen || searching ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                </button>
              </th>
              <th className={th}>No Item</th><th className={th}>Nama Item</th>
              <th className={th}>LOT</th><th className={th}>Expired</th>
              <th className={`${th} text-right`}>Qty</th><th className={th}>Store Bin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <SkeletonRows cols={7} />}
            {!loading && !filtered.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{dates.length ? 'Tidak ada stok yang cocok dengan filter.' : 'Belum ada data stok.'}</td></tr>
            )}
            {!loading && itemGroups.map(g => {
              const open = isOpen(g.no_item)
              const nearItem = !!g.nearestExpiry && !!expiryLimit && g.nearestExpiry < expiryLimit
              return (
                <Fragment key={g.no_item}>
                  <tr className={`cursor-pointer hover:bg-slate-50 ${open ? 'bg-slate-50/60' : ''}`} onClick={() => { if (!searching) toggle(g.no_item) }}>
                    <td className="px-2 py-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg text-slate-500" aria-hidden="true">
                        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap font-semibold text-slate-900`}>
                      <button type="button" aria-expanded={open} className="text-left" onClick={e => { e.stopPropagation(); if (!searching) toggle(g.no_item) }}>
                        {g.no_item}
                      </button>
                    </td>
                    <td className={td}>{g.nama_item ?? '-'}</td>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>{g.lots.length} LOT</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {g.nearestExpiry
                        ? <span className={nearItem ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800' : ''}>{fmtDate(g.nearestExpiry)}</span>
                        : '-'}
                    </td>
                    <td className={`${td} text-right font-bold tabular-nums text-slate-900`}>{fmtQty(g.qty)}</td>
                    <td className={`${td} whitespace-nowrap`}>{[...g.bins].join(' / ')}</td>
                  </tr>
                  {open && g.lots.map(r => {
                    // Tandai batch yang expired sebelum batas tombol "Expired <" (FEFO).
                    const near = !!r.expiration_date && !!expiryLimit && r.expiration_date < expiryLimit
                    return (
                      <tr key={`${r.bincode}|${r.lot_no}|${r.serial_no}`} className="bg-slate-50/40 text-slate-600">
                        <td />
                        <td />
                        <td />
                        <td className={`${td} whitespace-nowrap font-mono text-[13px]`}>{r.lot_no ?? '-'}{r.serial_no ? <span className="ml-2 text-xs text-slate-400">SN {r.serial_no}</span> : null}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          {r.expiration_date
                            ? <span className={near ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800' : ''}>{fmtDate(r.expiration_date)}</span>
                            : '-'}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{fmtQty(r.qty)}</td>
                        <td className={`${td} whitespace-nowrap`}>{r.bincode ?? '-'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
