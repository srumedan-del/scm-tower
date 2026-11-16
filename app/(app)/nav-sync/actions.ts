'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type NavSyncRun = {
  id: number
  trigger: 'manual' | 'schedule'
  status: 'pending' | 'running' | 'done' | 'failed'
  requested_by: string | null
  requested_at: string
  started_at: string | null
  finished_at: string | null
  summary: string | null
  error: string | null
}

export type NavSyncState = {
  /** Permintaan/proses terakhir (manual atau jadwal). */
  latest: NavSyncRun | null
  /** Sinkronisasi terakhir yang selesai. */
  lastFinished: NavSyncRun | null
  /** Program pemantau di komputer kantor aktif (tanda hidup < 90 detik). */
  agentOnline: boolean
  agentLastSeen: string | null
  /** Tabel belum dibuat (migrasi v56). */
  missingTable?: boolean
}

const MIGRATION_HINT = 'Jalankan dulu supabase/migration_v56_nav_sync_run.sql di Supabase.'

export async function getNavSyncState(): Promise<NavSyncState> {
  await requireAuthenticatedUser()
  const [{ data: latest, error }, { data: finished }, { data: agent }] = await Promise.all([
    supabaseAdmin.from('nav_sync_run').select('*').order('requested_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('nav_sync_run').select('*').in('status', ['done', 'failed']).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('nav_sync_agent').select('last_seen').eq('id', 1).maybeSingle(),
  ])
  if (error) return { latest: null, lastFinished: null, agentOnline: false, agentLastSeen: null, missingTable: true }
  const lastSeen = agent?.last_seen ?? null
  return {
    latest: (latest as NavSyncRun | null) ?? null,
    lastFinished: (finished as NavSyncRun | null) ?? null,
    agentOnline: Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 90_000),
    agentLastSeen: lastSeen,
  }
}

/** Tombol "Update dari NAV": buat permintaan; dijalankan program pemantau di komputer kantor. */
export async function requestNavSync(): Promise<NavSyncRun> {
  const user = await requireAuthenticatedUser()
  const requestedBy = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'unknown')
  // Satu permintaan aktif saja: kembalikan yang masih menunggu/berjalan.
  const { data: active, error: activeError } = await supabaseAdmin
    .from('nav_sync_run').select('*').in('status', ['pending', 'running']).order('requested_at', { ascending: false }).limit(1).maybeSingle()
  if (activeError) throw new Error(MIGRATION_HINT)
  if (active) return active as NavSyncRun
  const { data, error } = await supabaseAdmin.from('nav_sync_run').insert({ trigger: 'manual', status: 'pending', requested_by: requestedBy }).select('*').single()
  if (error) throw new Error(/nav_sync_run/.test(error.message) ? MIGRATION_HINT : error.message)
  return data as NavSyncRun
}
