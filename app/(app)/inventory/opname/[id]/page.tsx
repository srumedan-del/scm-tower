'use client'

import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Download, NotebookPen, Plus, Printer, Save } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { confirmAction, notify } from '@/lib/feedback'
import { lineDifference, opnameDateParts, periodHref, type OpnamePeriod } from '@/lib/stock-opname'
import { getOpnameSession, saveOpnameLines, updateOpnameSession, type OpnameLine, type OpnameSession } from '../actions'

type Draft = { qty_physical: string; penyebab: string; action_plan: string; line_status: string }

const toDraft = (line: OpnameLine): Draft => ({
  qty_physical: line.qty_physical == null ? '' : line.qty_physical.toLocaleString('id-ID'),
  penyebab: line.penyebab ?? '',
  action_plan: line.action_plan ?? '',
  line_status: line.line_status ?? '',
})

const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '-')
const num = (n: number) => n.toLocaleString('id-ID')
/** Qty Fisik yang diketik: titik = pemisah ribuan, koma = desimal. */
const parseInput = (text: string) => (text.trim() === '' ? null : Number(text.replace(/\./g, '').replace(',', '.')))
/** Saat mengetik: hanya angka, langsung diberi titik ribuan (4410 → 4.410). */
const formatQtyInput = (text: string) => { const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); return digits ? Number(digits).toLocaleString('id-ID') : '' }
/** Draft sama dengan yang tersimpan di server (spasi di ujung diabaikan, seperti saat disimpan). */
const isSaved = (line: OpnameLine, draft: Draft | undefined) => !draft || (
  parseInput(draft.qty_physical) === line.qty_physical &&
  (draft.penyebab.trim() || null) === (line.penyebab ?? null) &&
  (draft.action_plan.trim() || null) === (line.action_plan ?? null) &&
  (draft.line_status || null) === (line.line_status ?? null)
)
const backupKey = (sessionId: number) => `scm-opname-draft-${sessionId}`
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function OpnameSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sessionId = Number(id)
  const [session, setSession] = useState<OpnameSession | null>(null)
  const [lines, setLines] = useState<OpnameLine[]>([])
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [error, setError] = useState('')
  const [loading, startLoading] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const router = useRouter()

  const load = () => startLoading(async () => {
    try {
      const data = await getOpnameSession(sessionId)
      const fromServer: Record<number, Draft> = Object.fromEntries(data.lines.map(line => [line.id, toDraft(line)]))
      // Pulihkan isian yang belum sempat terkirim (mis. halaman ditutup saat offline).
      let restored = 0
      try {
        const backup = JSON.parse(localStorage.getItem(backupKey(sessionId)) ?? '{}') as Record<string, Draft>
        for (const [lineId, draft] of Object.entries(backup)) {
          const line = data.lines.find(l => l.id === Number(lineId))
          if (line && !isSaved(line, draft)) { fromServer[line.id] = draft; restored++ }
        }
      } catch { /* cadangan lokal opsional */ }
      setSession(data.session); setLines(data.lines); setDrafts(fromServer)
      if (restored) notify.success(`${restored} isian yang belum tersimpan dipulihkan`)
      setError('')
    } catch (e: any) { setError(e.message) }
  })
  useEffect(() => { load() }, [sessionId])

  const dirtyIds = useMemo(() => lines.filter(line => !isSaved(line, drafts[line.id])).map(line => line.id), [lines, drafts])

  const summary = useMemo(() => {
    let counted = 0, diffLines = 0, diffQty = 0, systemQty = 0
    for (const line of lines) {
      systemQty += line.qty_system
      const draft = drafts[line.id]
      if (!draft || parseInput(draft.qty_physical) == null) continue
      counted++
      const diff = (parseInput(draft.qty_physical) ?? 0) - line.qty_system
      if (diff !== 0) { diffLines++; diffQty += diff }
    }
    return { counted, diffLines, diffQty, systemQty }
  }, [lines, drafts])

  /** Baris dikelompokkan per item (No Item) dengan subtotal, agar terlihat item mana yang punya lot selisih. */
  const groups = useMemo(() => {
    const byItem = new Map<string, { key: string; no_item: string; nama_item: string; systemQty: number; physicalQty: number; counted: number; diffLots: number; diffQty: number; lines: { line: OpnameLine; index: number; draft: Draft; diff: number | null }[] }>()
    lines.forEach((line, index) => {
      const key = line.no_item ?? '-'
      const group = byItem.get(key) ?? { key, no_item: key, nama_item: line.nama_item ?? '', systemQty: 0, physicalQty: 0, counted: 0, diffLots: 0, diffQty: 0, lines: [] }
      const draft = drafts[line.id] ?? toDraft(line)
      const physical = parseInput(draft.qty_physical)
      const diff = lineDifference({ qty_system: line.qty_system, qty_physical: physical })
      group.systemQty += line.qty_system
      if (physical != null && !Number.isNaN(physical)) { group.counted++; group.physicalQty += physical }
      if (diff != null && diff !== 0) { group.diffLots++; group.diffQty += diff }
      group.lines.push({ line, index, draft, diff })
      byItem.set(key, group)
    })
    return [...byItem.values()]
  }, [lines, drafts])
  // Penyebab dan Action plan dibuka per baris lewat tombol + di kanan.
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set())
  const toggleNotes = (lineId: number) => setOpenNotes(current => { const next = new Set(current); if (next.has(lineId)) next.delete(lineId); else next.add(lineId); return next })

  const setDraft = (lineId: number, patch: Partial<Draft>) => setDrafts(current => ({ ...current, [lineId]: { ...current[lineId], ...patch } }))

  // ── Simpan otomatis ──────────────────────────────────────────────────────
  const latest = useRef({ lines, drafts })
  latest.current = { lines, drafts }
  const inFlight = useRef(false)

  /** Kirim semua baris yang berubah ke server. Dipanggil otomatis; tombol Simpan hanya mempercepat. */
  const flush = useCallback(async () => {
    if (inFlight.current) return
    const { lines: current, drafts: currentDrafts } = latest.current
    const updates = current.filter(line => !isSaved(line, currentDrafts[line.id])).map(line => {
      const draft = currentDrafts[line.id]
      return {
        id: line.id,
        qty_physical: parseInput(draft.qty_physical),
        penyebab: draft.penyebab.trim(), action_plan: draft.action_plan.trim(),
        line_status: (draft.line_status || null) as OpnameLine['line_status'],
      }
    }).filter(update => update.qty_physical == null || !Number.isNaN(update.qty_physical))
    if (!updates.length) return
    inFlight.current = true
    setSaveState('saving')
    try {
      await saveOpnameLines(sessionId, updates)
      const byId = new Map(updates.map(update => [update.id, update]))
      setLines(previous => previous.map(line => {
        const update = byId.get(line.id)
        return update ? { ...line, qty_physical: update.qty_physical, penyebab: update.penyebab || null, action_plan: update.action_plan || null, line_status: update.line_status } : line
      }))
      setSaveState('saved')
    } catch {
      setSaveState('error')
    } finally {
      inFlight.current = false
    }
  }, [sessionId])

  // Cadangkan isian yang belum terkirim di browser, lalu kirim 1 detik setelah berhenti mengetik.
  useEffect(() => {
    if (!lines.length) return
    try {
      const pending = Object.fromEntries(dirtyIds.map(lineId => [lineId, drafts[lineId]]))
      if (dirtyIds.length) localStorage.setItem(backupKey(sessionId), JSON.stringify(pending))
      else localStorage.removeItem(backupKey(sessionId))
    } catch { /* cadangan lokal opsional */ }
    if (!dirtyIds.length) return
    const timer = window.setTimeout(() => { void flush() }, saveState === 'error' ? 10_000 : 1000)
    return () => window.clearTimeout(timer)
  }, [drafts, lines, dirtyIds, sessionId, flush, saveState])

  // Kirim juga saat pindah tab/halaman, dan peringatkan bila browser ditutup sebelum terkirim.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const { lines: current, drafts: currentDrafts } = latest.current
      if (current.some(line => !isSaved(line, currentDrafts[line.id]))) { void flush(); event.preventDefault() }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush() // keluar lewat menu/sidebar
    }
  }, [flush])

  /** Semua isian tersimpan: tandai sesi selesai dihitung lalu kembali ke daftar sesi. */
  async function finish() {
    if (!session) return
    const uncounted = lines.length - summary.counted
    if (uncounted > 0 && !(await confirmAction({ title: 'Selesaikan opname?', message: `${uncounted} lot belum diisi Qty Fisik. Tetap tandai sesi ini selesai?` }))) return
    try {
      if (session.status === 'Draft') await updateOpnameSession(session.id, { status: 'Selesai dihitung' })
      notify.success('Stock opname selesai')
      router.push(periodHref(session.period))
    } catch (e: any) { notify.error('Gagal menyelesaikan', e.message) }
  }

  if (error) return <div className="space-y-4"><BackLink /><p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p></div>
  const date = session ? opnameDateParts(session.opname_date) : null

  return (
    <div className="space-y-4">
      <BackLink period={session?.period} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">Opname {session?.period ?? ''} {date ? `${date.day}, ${date.long}` : ''}</h1>
        </div>
        {session && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/print/opname/${session.id}?doc=lembar`} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Printer className="h-4 w-4" aria-hidden="true" /> Lembar Kerja
            </Link>
            <a href={`/api/stock-opname/${session.id}/excel?doc=berita`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" aria-hidden="true" /> Berita Acara (Excel)
            </a>
            <Link href={`/print/opname/${session.id}?doc=berita`} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Printer className="h-4 w-4" aria-hidden="true" /> Berita Acara (PDF)
            </Link>
            {/* Simpan otomatis tetap berjalan. Selama ada isian belum terkirim tombol ini menyimpan;
                setelah semua tersimpan tombol menjadi Selesai untuk menutup sesi. */}
            <button
              type="button"
              onClick={() => (dirtyIds.length ? void flush() : void finish())}
              disabled={saveState === 'saving'}
              data-busy={saveState === 'saving'}
              title={saveState === 'error' && dirtyIds.length ? 'Belum terkirim (koneksi?). Isian tersimpan di perangkat ini dan dicoba lagi otomatis.' : dirtyIds.length ? 'Isian disimpan otomatis' : 'Semua isian tersimpan. Tandai opname selesai.'}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ${saveState === 'error' && dirtyIds.length ? 'bg-red-600' : dirtyIds.length ? 'bg-indigo-600' : 'bg-green-700'}`}
            >
              {dirtyIds.length || saveState === 'saving' ? <Save className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              <span role="status" aria-live="polite">
                {saveState === 'saving' ? 'Menyimpan…' : saveState === 'error' && dirtyIds.length ? 'Gagal, simpan lagi' : dirtyIds.length ? 'Simpan' : 'Selesai'}
              </span>
            </button>
          </div>
        )}
      </header>

      <div className="max-h-[calc(100vh-8rem)] overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="opname-entry w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th className="px-3 py-3 font-semibold">No</th>
              <th className="px-3 py-3 font-semibold">No Item</th>
              <th className="px-3 py-3 font-semibold">Item Description</th>
              <th className="px-3 py-3 font-semibold">Lot</th>
              <th className="px-3 py-3 font-semibold">ED</th>
              <th className="px-3 py-3 text-right font-semibold">Qty sistem</th>
              <th className="px-3 py-3 font-semibold">Qty fisik</th>
              <th className="px-3 py-3 text-right font-semibold">Selisih</th>
              <th className="w-12 px-2 py-3"><span className="sr-only">Penyebab dan action plan</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !lines.length && <SkeletonRows cols={9} />}
            {groups.map(group => (
              <Fragment key={group.key}>
                {group.lines.map(({ line, index, draft, diff }) => {
                  const hasDiff = diff != null && diff !== 0
                  const hasNotes = Boolean(draft.penyebab.trim() || draft.action_plan.trim())
                  const notesOpen = openNotes.has(line.id)
                  return (
                    <Fragment key={line.id}>
                    <tr className={hasDiff ? 'bg-red-50/40' : undefined}>
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{line.no_item}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{line.nama_item}</td>
                      <td className="px-3 py-2 font-mono text-xs">{line.lot_no ?? '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDate(line.expiration_date)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(line.qty_system)}</td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" aria-label={`Qty fisik ${line.no_item} lot ${line.lot_no}`} value={draft.qty_physical} onChange={e => setDraft(line.id, { qty_physical: formatQtyInput(e.target.value) })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono" placeholder="—" />
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${diff == null ? 'text-slate-300' : diff === 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-amber-700'}`}>
                        {diff == null ? '—' : diff === 0 ? 'Sesuai' : (diff > 0 ? '+' : '') + num(diff)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleNotes(line.id)}
                          aria-expanded={notesOpen}
                          aria-label={`Penyebab dan action plan ${line.no_item} lot ${line.lot_no}`}
                          title={hasNotes ? `Penyebab: ${draft.penyebab || '-'}
Action plan: ${draft.action_plan || '-'}` : 'Isi penyebab dan action plan'}
                          className={`grid h-8 w-8 place-items-center rounded-lg border ${hasNotes ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          {hasNotes ? <NotebookPen className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </td>
                    </tr>
                    {notesOpen && (
                      <tr className="bg-slate-50/60">
                        <td />
                        <td colSpan={8} className="px-3 pb-3 pt-1">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-slate-600">Penyebab
                              <input value={draft.penyebab} onChange={e => setDraft(line.id, { penyebab: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-900" placeholder="Penyebab selisih" />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">Action plan
                              <input value={draft.action_plan} onChange={e => setDraft(line.id, { action_plan: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-900" />
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
                <TotalRow label={`Total ${group.no_item}`} systemQty={group.systemQty} physicalQty={group.physicalQty} counted={group.counted} lineCount={group.lines.length} diffQty={group.diffQty} />
              </Fragment>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="border-t-2 border-slate-300">
              <TotalRow label="Total semua item" systemQty={summary.systemQty} physicalQty={groups.reduce((s, g) => s + g.physicalQty, 0)} counted={summary.counted} lineCount={lines.length} diffQty={summary.diffQty} strong />
            </tfoot>
          )}
        </table>
      </div>

    </div>
  )
}

/** Baris total di bawah lot satu item, dan total akhir semua item. */
function TotalRow({ label, systemQty, physicalQty, counted, lineCount, diffQty, strong }: {
  label: string; systemQty: number; physicalQty: number; counted: number; lineCount: number; diffQty: number; strong?: boolean
}) {
  const complete = counted === lineCount
  return (
    <tr className={strong ? 'bg-slate-100 font-bold' : 'bg-slate-50 font-semibold'}>
      <td />
      <td colSpan={4} className="px-3 py-2 text-slate-800">{label}{!complete && <span className="ml-2 text-xs font-normal text-slate-500">{counted}/{lineCount} lot dihitung</span>}</td>
      <td className="px-3 py-2 text-right font-mono">{num(systemQty)}</td>
      <td className="px-3 py-2 text-right font-mono">{counted ? num(physicalQty) : '—'}</td>
      <td className={`px-3 py-2 text-right font-mono ${!counted ? 'text-slate-300' : diffQty === 0 ? 'text-green-700' : diffQty < 0 ? 'text-red-700' : 'text-amber-700'}`}>
        {!counted ? '—' : diffQty === 0 ? (complete ? 'Sesuai' : '0') : (diffQty > 0 ? '+' : '') + num(diffQty)}
      </td>
      <td />
    </tr>
  )
}

function BackLink({ period }: { period?: OpnamePeriod }) {
  return (
    <Link href={periodHref(period)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Semua sesi opname {(period ?? 'Mingguan').toLowerCase()}
    </Link>
  )
}
