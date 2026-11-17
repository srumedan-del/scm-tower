/**
 * Salin foto POD dan BBM dari Supabase Storage ke folder di komputer kantor (D:\srgjaya),
 * dengan nama yang mudah dicari:
 *
 *   <DRIVE>\POD\2026-11\PSS-2611-1840_POD1.jpg      foto Surat Jalan bertanda tangan
 *   <DRIVE>\POD\2026-11\PSS-2611-1840_POD2.jpg      tanda tangan (bila ada)
 *   <DRIVE>\BBM\2026-11\TRIP-2611-0022_BBM1_STRUK.jpg
 *   <DRIVE>\BBM\2026-11\TRIP-2611-0022_BBM1_ODOMETER.jpg
 *
 * File di server tidak diubah. Yang sudah disalin dicatat di state.json agar tidak diunduh ulang;
 * bila POD diganti (foto baru), salinannya ikut diperbarui.
 *
 *   npx tsx scripts/drive-backup/drive-backup.ts            salin yang baru
 *   npx tsx scripts/drive-backup/drive-backup.ts --dry-run  hanya tampilkan rencana
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(__dirname, '..', '..')
const STATE_FILE = path.join(__dirname, 'state.json')
const LOG_FILE = path.join(__dirname, 'drive-backup.log')
const BUCKET = 'pod-documents'
const DRY_RUN = process.argv.includes('--dry-run')

function readEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
}
const env = { ...readEnv(path.join(ROOT, '.env.local')), ...readEnv(path.join(__dirname, '.env')) }
// Folder tujuan: D:\srgjaya (disinkron Nextcloud) → D:\srgjaya\POD\<bulan>\ dan D:\srgjaya\BBM\<bulan>\.
const DRIVE_DIR = env.DRIVE_BACKUP_DIR || 'D:\\srgjaya'
const db = createClient<any>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

function log(message: string) {
  const line = `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${message}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* log opsional */ }
}

/** Bulan (WIB) untuk subfolder, mis. 2026-11. */
const monthOf = (iso: string | null | undefined) =>
  new Date(iso ?? Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim()
const extOf = (source: string) => (path.extname(source.split('?')[0]) || '.jpg').toLowerCase()

type Job = { source: string; target: string }

async function podJobs(): Promise<Job[]> {
  const { data: pods, error } = await db.from('delivery_pod').select('tracking_id, received_at, photo_url, signature_url')
  if (error) throw error
  const withPhotos = (pods ?? []).filter((pod: any) => pod.photo_url || pod.signature_url)
  if (!withPhotos.length) return []
  const ids = withPhotos.map((pod: any) => pod.tracking_id)
  const { data: shipments, error: shipmentError } = await db.from('shipment_tracking').select('id, pss_no, crossdocking_id').in('id', ids)
  if (shipmentError) throw shipmentError
  const cdIds = (shipments ?? []).filter((row: any) => !row.pss_no && row.crossdocking_id).map((row: any) => row.crossdocking_id)
  const { data: crossdocking } = cdIds.length
    ? await db.from('crossdocking_header').select('id, crossdocking_no').in('id', cdIds)
    : { data: [] as any[] }
  const cdNo = new Map((crossdocking ?? []).map((row: any) => [Number(row.id), row.crossdocking_no]))
  const reference = new Map((shipments ?? []).map((row: any) => [Number(row.id), row.pss_no ?? cdNo.get(Number(row.crossdocking_id)) ?? `SHIPMENT-${row.id}`]))

  return withPhotos.flatMap((pod: any) => {
    const ref = safe(String(reference.get(Number(pod.tracking_id)) ?? `SHIPMENT-${pod.tracking_id}`))
    const folder = path.join(DRIVE_DIR, 'POD', monthOf(pod.received_at))
    return [pod.photo_url, pod.signature_url]
      .map((source: string | null, index: number) => source ? { source, target: path.join(folder, `${ref}_POD${index + 1}${extOf(source)}`) } : null)
      .filter((job: Job | null): job is Job => job != null)
  })
}

async function fuelJobs(): Promise<Job[]> {
  const { data: logs, error } = await db
    .from('trip_fuel_logs')
    .select('id, trip_id, logged_at, photo_receipt_url, photo_odometer_after_url, photo_odometer_before_url')
    .order('logged_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  const counter = new Map<string, number>()
  return (logs ?? []).flatMap((row: any) => {
    const trip = safe(String(row.trip_id ?? 'TRIP'))
    const number = (counter.get(trip) ?? 0) + 1
    counter.set(trip, number)
    const folder = path.join(DRIVE_DIR, 'BBM', monthOf(row.logged_at))
    const photos: [string | null, string][] = [
      [row.photo_receipt_url, 'STRUK'],
      [row.photo_odometer_after_url, 'ODOMETER'],
      [row.photo_odometer_before_url, 'ODOMETER-AWAL'],
    ]
    return photos
      .filter(([source]) => Boolean(source))
      .map(([source, label]) => ({ source: source as string, target: path.join(folder, `${trip}_BBM${number}_${label}${extOf(source as string)}`) }))
  })
}

async function download(source: string): Promise<Buffer> {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  const { data, error } = await db.storage.from(BUCKET).download(source)
  if (error || !data) throw new Error(error?.message ?? 'File tidak ditemukan')
  return Buffer.from(await data.arrayBuffer())
}

async function main() {
  if (!fs.existsSync(DRIVE_DIR)) throw new Error(`Folder Google Drive tidak ditemukan: ${DRIVE_DIR}. Pastikan Google Drive for Desktop berjalan.`)
  const state: Record<string, string> = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}
  const jobs = [...await podJobs(), ...await fuelJobs()]
  const todo = jobs.filter((job) => state[job.target] !== job.source || !fs.existsSync(job.target))
  let copied = 0
  const failed: string[] = []
  for (const job of todo) {
    if (DRY_RUN) { log(`[uji] ${job.source} → ${job.target}`); continue }
    try {
      const bytes = await download(job.source)
      fs.mkdirSync(path.dirname(job.target), { recursive: true })
      fs.writeFileSync(job.target, bytes)
      state[job.target] = job.source
      copied++
    } catch (error) {
      failed.push(`${path.basename(job.target)}: ${(error as Error).message}`)
    }
  }
  if (!DRY_RUN) fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))
  if (todo.length || failed.length) {
    log(`${DRY_RUN ? 'Uji coba' : 'Selesai'}: ${DRY_RUN ? todo.length : copied} file ${DRY_RUN ? 'akan disalin' : 'disalin'} ke ${DRIVE_DIR} (total ${jobs.length} foto)${failed.length ? `, ${failed.length} gagal` : ''}`)
  }
  for (const line of failed) log(`GAGAL ${line}`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  log(`GAGAL: ${(error as Error).message}`)
  process.exitCode = 1
})
