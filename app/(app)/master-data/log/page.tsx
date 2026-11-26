import Link from 'next/link'
import { ArrowLeft, CalendarClock, Hand } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import type { NavSyncRun } from '../../nav-sync/actions'

export const dynamic = 'force-dynamic'

/**
 * Log aktivitas download dan update data dari NAV (tabel nav_sync_run, migrasi v56).
 * Baris dibuat oleh jadwal otomatis (scripts/nav-sync) dan oleh tombol "Update Data" (manual).
 */

const TRIGGERS = { all: 'Semua', schedule: 'Jadwal', manual: 'Manual' } as const
const STATUSES = { all: 'Semua status', done: 'Berhasil', failed: 'Gagal', running: 'Berjalan', pending: 'Menunggu' } as const
type TriggerFilter = keyof typeof TRIGGERS
type StatusFilter = keyof typeof STATUSES

const STATUS_STYLE: Record<NavSyncRun['status'], string> = {
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  failed: 'bg-rose-50 text-rose-700 border-rose-200/70',
  running: 'bg-sky-50 text-sky-700 border-sky-200/70',
  pending: 'bg-amber-50 text-amber-700 border-amber-200/70',
}

const wibFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})
const wib = (value: string | null) => (value ? wibFormat.format(new Date(value)).replace(/\./g, ':') : '—')

function duration(run: NavSyncRun) {
  if (!run.started_at || !run.finished_at) return '—'
  const seconds = Math.max(0, Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000))
  return seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`
}

/** Jumlah baris baru dari ringkasan, mis. "PSS Header: 1 baru, 39 dilewati dari 40". */
function newRows(summary: string | null) {
  if (!summary) return null
  const matches = [...summary.matchAll(/(\d+) baru/g)]
  return matches.length ? matches.reduce((sum, m) => sum + Number(m[1]), 0) : null
}

function filterHref(trigger: TriggerFilter, status: StatusFilter) {
  const params = new URLSearchParams()
  if (trigger !== 'all') params.set('jenis', trigger)
  if (status !== 'all') params.set('status', status)
  const query = params.toString()
  return query ? `/master-data/log?${query}` : '/master-data/log'
}

export default async function SyncLogPage({ searchParams }: { searchParams: Promise<{ jenis?: string; status?: string }> }) {
  await requireAuthenticatedUser()
  const params = await searchParams
  const trigger: TriggerFilter = params.jenis && params.jenis in TRIGGERS ? (params.jenis as TriggerFilter) : 'all'
  const status: StatusFilter = params.status && params.status in STATUSES ? (params.status as StatusFilter) : 'all'

  let query = supabaseAdmin.from('nav_sync_run').select('*').order('requested_at', { ascending: false }).limit(300)
  if (trigger !== 'all') query = query.eq('trigger', trigger)
  if (status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  const runs = (data ?? []) as NavSyncRun[]

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
      active ? 'border-gold-300 bg-gold-50 text-gold-800' : 'border-slate-200 bg-white text-slate-600 hover:border-gold-200'
    }`

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/master-data" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-gold-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Master Data
        </Link>
        <h1 className="text-3xl font-bold">Log</h1>
        <p className="text-sm text-slate-500">Riwayat download dan update data dari NAV, terjadwal maupun manual. Waktu dalam WIB.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TRIGGERS) as TriggerFilter[]).map(key => (
          <Link key={key} href={filterHref(key, status)} className={chip(trigger === key)}>{TRIGGERS[key]}</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
        {(Object.keys(STATUSES) as StatusFilter[]).map(key => (
          <Link key={key} href={filterHref(trigger, key)} className={chip(status === key)}>{STATUSES[key]}</Link>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Log belum bisa dibaca: {error.message}
        </div>
      )}

      <div className="data-list-scroll max-h-[calc(100vh-14rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              {['Waktu', 'Jenis', 'Oleh', 'Status', 'Durasi', 'Data baru', 'Keterangan'].map(h => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map(run => {
              const added = newRows(run.summary)
              const lines = (run.summary ?? '').split('\n').filter(Boolean)
              const Icon = run.trigger === 'schedule' ? CalendarClock : Hand
              return (
                <tr key={run.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-700">{wib(run.started_at ?? run.requested_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <Icon className="h-4 w-4 text-gold-700" aria-hidden="true" />
                      {run.trigger === 'schedule' ? 'Jadwal' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{run.requested_by ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[run.status]}`}>
                      {STATUSES[run.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{duration(run)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900">{added ?? '—'}</td>
                  <td className="min-w-[280px] px-4 py-3 text-slate-600">
                    {run.error && <div className="mb-1 font-medium text-rose-700">{run.error}</div>}
                    {lines.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer select-none text-slate-500 hover:text-gold-700">{lines.length} langkah</summary>
                        <ul className="mt-1.5 space-y-0.5 text-[13px]">
                          {lines.map((line, i) => (
                            <li key={i} className={line.startsWith('GAGAL') ? 'text-rose-700' : undefined}>{line}</li>
                          ))}
                        </ul>
                      </details>
                    ) : !run.error && <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              )
            })}
            {runs.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Belum ada log untuk filter ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
