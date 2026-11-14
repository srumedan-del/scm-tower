'use client'

import { use, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { notify } from '@/lib/feedback'
import { LINE_STATUSES, SESSION_STATUSES, lineDifference, opnameDateParts } from '@/lib/stock-opname'
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
      if (!draft || draft.qty_physical === '') continue
      counted++
      const diff = Number(draft.qty_physical) - line.qty_system
      if (diff !== 0) { diffLines++; diffQty += diff }
    }
    return { counted, diffLines, diffQty, systemQty }
  }, [lines, drafts])

  const setDraft = (lineId: number, patch: Partial<Draft>) => setDrafts(current => ({ ...current, [lineId]: { ...current[lineId], ...patch } }))

  function save() {
    const updates = lines.filter(line => dirtyIds.includes(line.id)).map(line => {
      const draft = drafts[line.id]
      return {
        id: line.id,
        qty_physical: draft.qty_physical === '' ? null : Number(draft.qty_physical.replace(/\./g, '').replace(',', '.')),
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
      <BackLink />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Opname {date ? `${date.day}, ${date.long}` : ''}</h1>
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
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-3 font-semibold">No</th>
              <th className="px-3 py-3 font-semibold">Kategori</th>
              <th className="px-3 py-3 font-semibold">Item</th>
              <th className="px-3 py-3 font-semibold">Lot</th>
              <th className="px-3 py-3 font-semibold">ED</th>
              <th className="px-3 py-3 text-right font-semibold">Qty sistem</th>
              <th className="px-3 py-3 font-semibold">Qty fisik</th>
              <th className="px-3 py-3 text-right font-semibold">Selisih</th>
              <th className="px-3 py-3 font-semibold">Penyebab</th>
              <th className="px-3 py-3 font-semibold">Action plan</th>
              <th className="px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !lines.length && <SkeletonRows cols={11} />}
            {lines.map((line, index) => {
              const draft = drafts[line.id] ?? toDraft(line)
              const diff = lineDifference({ qty_system: line.qty_system, qty_physical: draft.qty_physical === '' ? null : Number(draft.qty_physical) })
              const hasDiff = diff != null && diff !== 0
              return (
                <tr key={line.id} className={hasDiff ? 'bg-red-50/40' : undefined}>
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{line.kategori === 'HOLOW FIBER / DIALYZER' ? 'Dialyzer' : 'Blood Tubing Set'}</td>
                  <td className="px-3 py-2"><div className="font-semibold text-slate-900">{line.no_item}</div><div className="max-w-[260px] truncate text-xs text-slate-500" title={line.nama_item ?? ''}>{line.nama_item}</div></td>
                  <td className="px-3 py-2 font-mono text-xs">{line.lot_no ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDate(line.expiration_date)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(line.qty_system)}</td>
                  <td className="px-3 py-2">
                    <input inputMode="numeric" aria-label={`Qty fisik ${line.no_item} lot ${line.lot_no}`} value={draft.qty_physical} onChange={e => setDraft(line.id, { qty_physical: e.target.value })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono" placeholder="—" />
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${diff == null ? 'text-slate-300' : diff === 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-amber-700'}`}>
                    {diff == null ? '—' : diff === 0 ? 'Sesuai' : (diff > 0 ? '+' : '') + num(diff)}
                  </td>
                  <td className="px-3 py-2"><input aria-label="Penyebab" value={draft.penyebab} onChange={e => setDraft(line.id, { penyebab: e.target.value })} className="w-44 rounded-lg border border-slate-200 px-2 py-1.5" placeholder={hasDiff ? 'Wajib bila selisih' : ''} /></td>
                  <td className="px-3 py-2"><input aria-label="Action plan" value={draft.action_plan} onChange={e => setDraft(line.id, { action_plan: e.target.value })} className="w-44 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  <td className="px-3 py-2">
                    <select aria-label="Status baris" value={draft.line_status} onChange={e => setDraft(line.id, { line_status: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5">
                      <option value="">—</option>
                      {LINE_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
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

function BackLink() {
  return (
    <Link href="/inventory/opname" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Semua sesi opname
    </Link>
  )
}
