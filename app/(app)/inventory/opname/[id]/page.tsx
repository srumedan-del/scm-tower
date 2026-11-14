'use client'

import { Fragment, use, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, NotebookPen, Plus, Printer } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { notify } from '@/lib/feedback'
import { SESSION_STATUSES, lineDifference, opnameDateParts, periodHref, type OpnamePeriod } from '@/lib/stock-opname'
import { getOpnameSession, saveOpnameLines, updateOpnameSession, type OpnameLine, type OpnameSession } from '../actions'

type Draft = { qty_physical: string; penyebab: string; action_plan: string; line_status: string }

const toDraft = (line: OpnameLine): Draft => ({
  qty_physical: line.qty_physical == null ? '' : String(line.qty_physical),
  penyebab: line.penyebab ?? '',
  action_plan: line.action_plan ?? '',
  line_status: line.line_status ?? '',
})

const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '-')
const num = (n: number) => n.toLocaleString('id-ID')
/** Qty Fisik yang diketik: titik = pemisah ribuan, koma = desimal. */
const parseInput = (text: string) => (text.trim() === '' ? null : Number(text.replace(/\./g, '').replace(',', '.')))

export default function OpnameSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sessionId = Number(id)
  const [session, setSession] = useState<OpnameSession | null>(null)
  const [lines, setLines] = useState<OpnameLine[]>([])
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [error, setError] = useState('')
  const [loading, startLoading] = useTransition()
  const [saving, startSaving] = useTransition()

  const load = () => startLoading(async () => {
    try {
      const data = await getOpnameSession(sessionId)
      setSession(data.session); setLines(data.lines)
      setDrafts(Object.fromEntries(data.lines.map(line => [line.id, toDraft(line)])))
      setError('')
    } catch (e: any) { setError(e.message) }
  })
  useEffect(() => { load() }, [sessionId])

  const dirtyIds = useMemo(() => lines.filter(line => JSON.stringify(toDraft(line)) !== JSON.stringify(drafts[line.id])).map(line => line.id), [lines, drafts])

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

  function save() {
    const updates = lines.filter(line => dirtyIds.includes(line.id)).map(line => {
      const draft = drafts[line.id]
      return {
        id: line.id,
        qty_physical: parseInput(draft.qty_physical),
        penyebab: draft.penyebab, action_plan: draft.action_plan,
        line_status: (draft.line_status || null) as OpnameLine['line_status'],
      }
    })
    if (updates.some(u => u.qty_physical != null && Number.isNaN(u.qty_physical))) { notify.error('Qty Fisik tidak valid', 'Isi dengan angka.'); return }
    startSaving(async () => {
      try { await saveOpnameLines(sessionId, updates); notify.success(`${updates.length} baris tersimpan`); load() } catch (e: any) { notify.error('Gagal menyimpan', e.message) }
    })
  }

  async function changeStatus(status: OpnameSession['status']) {
    if (!session) return
    try { await updateOpnameSession(session.id, { status }); setSession({ ...session, status }); notify.success('Status sesi: ' + status) } catch (e: any) { notify.error('Gagal mengubah status', e.message) }
  }

  if (error) return <div className="space-y-4"><BackLink /><p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p></div>
  const date = session ? opnameDateParts(session.opname_date) : null

  return (
    <div className="space-y-4">
      <BackLink period={session?.period} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Opname {session?.period ?? ''} {date ? `${date.day}, ${date.long}` : ''}</h1>
        </div>
        {session && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/stock-opname/${session.id}/excel?doc=lembar`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" aria-hidden="true" /> Lembar hitung (Excel)
            </a>
            <Link href={`/print/opname/${session.id}?doc=lembar`} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Printer className="h-4 w-4" aria-hidden="true" /> Cetak lembar hitung
            </Link>
            <a href={`/api/stock-opname/${session.id}/excel?doc=berita`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" aria-hidden="true" /> Berita acara (Excel)
            </a>
            <Link href={`/print/opname/${session.id}?doc=berita`} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3.5 text-sm font-semibold text-white">
              <Printer className="h-4 w-4" aria-hidden="true" /> Cetak berita acara (PDF)
            </Link>
          </div>
        )}
      </header>

      {session && (
        <section aria-label="Ringkasan opname" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['Lot opname', num(lines.length)],
            ['Sudah dihitung', `${num(summary.counted)} / ${num(lines.length)}`],
            ['Baris selisih', num(summary.diffLines)],
            ['Total selisih', (summary.diffQty > 0 ? '+' : '') + num(summary.diffQty)],
            ['Qty sistem', num(summary.systemQty)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <p className={`mt-1 font-mono text-xl font-bold ${label.includes('elisih') && summary.diffLines ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
            </div>
          ))}
        </section>
      )}

      {session && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="text-slate-500">PIC</span><b>{session.pic ?? '-'}</b>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Sumber</span><b>{session.source === 'sirup' ? 'Otomatis dari SIRUP' : session.source_note ?? 'Upload Excel'}</b>
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-slate-500" htmlFor="session-status">Status sesi
            <select id="session-status" value={session.status} onChange={e => changeStatus(e.target.value as OpnameSession['status'])} className="rounded-lg border border-slate-200 px-2 py-1.5 font-semibold text-slate-800">
              {SESSION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left">
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
                        <input inputMode="numeric" aria-label={`Qty fisik ${line.no_item} lot ${line.lot_no}`} value={draft.qty_physical} onChange={e => setDraft(line.id, { qty_physical: e.target.value })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono" placeholder="—" />
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

      {session && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <span className="text-sm text-slate-500">{dirtyIds.length ? `${dirtyIds.length} baris belum disimpan` : 'Semua perubahan tersimpan'}</span>
          <button type="button" onClick={save} disabled={saving || !dirtyIds.length} data-busy={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Menyimpan…' : 'Simpan Hasil Hitung'}
          </button>
        </div>
      )}
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
