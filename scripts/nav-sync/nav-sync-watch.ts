/**
 * Pemantau tombol "Update dari NAV" di SCM Tower.
 * Berjalan terus di komputer kantor (yang bisa menjangkau NAV), dimulai otomatis saat Windows login.
 * Tiap ±20 detik: perbarui tanda hidup (nav_sync_agent), ambil permintaan pending di nav_sync_run,
 * lalu jalankan nav-sync.ts --run-id=N. Proses yang macet > 30 menit ditandai gagal.
 *
 *   npx tsx scripts/nav-sync/nav-sync-watch.ts
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(__dirname, '..', '..')
const LOG_FILE = path.join(__dirname, 'nav-sync-watch.log')
const POLL_MS = 20_000

function readEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
}
const env = readEnv(path.join(ROOT, '.env.local'))
const db = createClient<any>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

function log(message: string) {
  const line = `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${message}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* log opsional */ }
}

/** Jalankan satu permintaan lewat nav-sync.ts dan tunggu selesai. */
function runSync(runId: number): Promise<number> {
  return new Promise((resolve) => {
    const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const child = spawn(process.execPath, [tsx, path.join(__dirname, 'nav-sync.ts'), `--run-id=${runId}`], {
      cwd: ROOT, stdio: 'ignore', windowsHide: true,
    })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

let busy = false
async function tick() {
  await db.from('nav_sync_agent').upsert({ id: 1, last_seen: new Date().toISOString(), hostname: os.hostname() })
  if (busy) return

  // Proses yang macet (mis. komputer sempat mati) dianggap gagal agar permintaan berikutnya bisa jalan.
  const stale = new Date(Date.now() - 30 * 60_000).toISOString()
  await db.from('nav_sync_run').update({ status: 'failed', finished_at: new Date().toISOString(), error: 'Proses terhenti (lebih dari 30 menit)' })
    .eq('status', 'running').lt('started_at', stale)

  const { data: running } = await db.from('nav_sync_run').select('id').eq('status', 'running').limit(1)
  if (running?.length) return // jadwal otomatis sedang jalan; tunggu
  const { data: pending } = await db.from('nav_sync_run').select('id, requested_by').eq('status', 'pending').order('requested_at').limit(1)
  const next = pending?.[0]
  if (!next) return

  busy = true
  const startedAt = new Date().toISOString()
  try {
    log(`Menjalankan permintaan #${next.id} dari ${next.requested_by ?? '-'}`)
    const code = await runSync(Number(next.id))
    // Bila nav-sync berhenti sebelum sempat mencatat (mis. error awal), tandai gagal.
    await db.from('nav_sync_run').update({ status: 'failed', finished_at: new Date().toISOString(), error: 'Sinkronisasi berhenti tanpa hasil' })
      .eq('id', next.id).in('status', ['pending', 'running'])
    // Permintaan lain yang masuk sebelum proses ini dimulai sudah terlayani olehnya.
    await db.from('nav_sync_run').update({ status: 'done', started_at: startedAt, finished_at: new Date().toISOString(), summary: `Digabung dengan permintaan #${next.id}` })
      .eq('status', 'pending').lt('requested_at', startedAt).neq('id', next.id)
    log(`Permintaan #${next.id} selesai (kode ${code})`)
  } finally {
    busy = false
  }
}

log(`Pemantau nav-sync aktif di ${os.hostname()}`)
const loop = async () => {
  try { await tick() } catch (error) { log(`Peringatan: ${(error as Error).message}`) }
  setTimeout(loop, POLL_MS)
}
void loop()
