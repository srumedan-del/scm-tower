'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { notify, showSuccess } from '@/lib/feedback'
import { getNavSyncState, requestNavSync, type NavSyncRun, type NavSyncState } from '@/app/(app)/nav-sync/actions'

const POLL_MS = 4000
const time = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

/**
 * Tombol "Update Data": membuat permintaan sinkronisasi yang dijalankan program pemantau
 * di komputer kantor (scripts/nav-sync/nav-sync-watch.ts), lalu menampilkan hasilnya.
 */
export function NavSyncButton() {
  const router = useRouter()
  const [state, setState] = useState<NavSyncState | null>(null)
  const [waitingFor, setWaitingFor] = useState<number | null>(null)
  const timer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await getNavSyncState()
      setState(next)
      return next
    } catch {
      return null
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Selama menunggu permintaan sendiri: cek status berkala sampai selesai.
  useEffect(() => {
    if (waitingFor == null) return
    const poll = async () => {
      const next = await refresh()
      const run = next?.latest && next.latest.id >= waitingFor ? next.latest : null
      const finished = next?.lastFinished && next.lastFinished.id >= waitingFor ? next.lastFinished : null
      if (finished && (!run || run.id === finished.id || run.status === 'done' || run.status === 'failed')) {
        setWaitingFor(null)
        announce(finished)
        router.refresh()
        return
      }
      timer.current = window.setTimeout(poll, POLL_MS)
    }
    timer.current = window.setTimeout(poll, POLL_MS)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [waitingFor, refresh, router])

  function announce(run: NavSyncRun) {
    const lines = (run.summary ?? '').split('\n').filter(Boolean)
    if (run.status === 'done') {
      void showSuccess({
        title: 'Data NAV diperbarui',
        message: lines.length ? undefined : 'Tidak ada data baru.',
        details: lines.slice(0, 6).map((line) => {
          const [label, ...rest] = line.split(':')
          return { label: label.trim(), value: rest.join(':').trim() || '-' }
        }),
      })
    } else {
      notify.error('Update Data gagal', [run.error, ...lines.filter((l) => l.startsWith('GAGAL'))].filter(Boolean).join('\n') || 'Lihat log di komputer sinkronisasi.')
    }
  }

  async function start() {
    try {
      const run = await requestNavSync()
      setWaitingFor(run.id)
      const latest = await refresh()
      if (latest && !latest.agentOnline) {
        notify.info('Komputer sinkronisasi sedang offline', 'Permintaan tersimpan dan akan dijalankan begitu komputer kantor menyala.')
      }
    } catch (error: any) {
      notify.error('Tidak bisa meminta update', error?.message ?? 'Coba lagi')
    }
  }

  const active = state?.latest && (state.latest.status === 'pending' || state.latest.status === 'running') ? state.latest : null
  const busy = waitingFor != null || Boolean(active)
  const label = active?.status === 'running' ? 'Mengambil data…' : busy ? 'Menunggu komputer…' : 'Update Data'
  const last = state?.lastFinished
  const hint = state?.missingTable
    ? 'Migrasi v56 belum dijalankan'
    : [
        last ? `Terakhir: ${time(last.finished_at)} (${last.trigger === 'schedule' ? 'jadwal' : last.requested_by ?? 'manual'}${last.status === 'failed' ? ', gagal' : ''})` : 'Belum pernah sinkron',
        state && !state.agentOnline ? `Komputer sinkronisasi offline sejak ${time(state.agentLastSeen)}` : null,
      ].filter(Boolean).join(' · ')

  // Baris kecil di bawah label: kapan terakhir sinkron, atau status komputer kantor.
  const offline = Boolean(state && !state.agentOnline)
  const subline = busy
    ? 'Data NAV sedang diambil'
    : state?.missingTable
      ? 'Migrasi v56 belum dijalankan'
      : offline
        ? 'Komputer kantor offline'
        : last
          ? `Terakhir ${time(last.finished_at)}${last.status === 'failed' ? ' · gagal' : ''}`
          : 'Belum pernah sinkron'

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={busy}
      title={hint}
      className="group inline-flex h-11 items-center gap-2.5 rounded-xl bg-indigo-600 pl-2 pr-4 text-left text-white disabled:cursor-wait"
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-gold-300 ring-1 ring-white/10">
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : <RefreshCw className="h-4 w-4 transition-transform duration-500 ease-out group-hover:rotate-180 motion-reduce:transition-none" aria-hidden="true" />}
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#262523] ${offline ? 'bg-amber-400' : last?.status === 'failed' ? 'bg-red-400' : 'bg-emerald-400'}`}
          aria-label={offline ? 'Komputer sinkronisasi offline' : last?.status === 'failed' ? 'Sinkron terakhir gagal' : 'Komputer sinkronisasi online'}
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] font-medium text-white/60">{subline}</span>
      </span>
    </button>
  )
}
