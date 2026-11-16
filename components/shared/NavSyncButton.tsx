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
 * Tombol "Update dari NAV": membuat permintaan sinkronisasi yang dijalankan program pemantau
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
      notify.error('Update dari NAV gagal', [run.error, ...lines.filter((l) => l.startsWith('GAGAL'))].filter(Boolean).join('\n') || 'Lihat log di komputer sinkronisasi.')
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
  const label = active?.status === 'running' ? 'Mengambil data NAV…' : busy ? 'Menunggu komputer…' : 'Update dari NAV'
  const last = state?.lastFinished
  const hint = state?.missingTable
    ? 'Migrasi v56 belum dijalankan'
    : [
        last ? `Terakhir: ${time(last.finished_at)} (${last.trigger === 'schedule' ? 'jadwal' : last.requested_by ?? 'manual'}${last.status === 'failed' ? ', gagal' : ''})` : 'Belum pernah sinkron',
        state && !state.agentOnline ? `Komputer sinkronisasi offline sejak ${time(state.agentLastSeen)}` : null,
      ].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={busy}
      title={hint}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
      <span>{label}</span>
      {state && !state.agentOnline && !busy && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Komputer sinkronisasi offline" />}
    </button>
  )
}
