/**
 * Ambil data NAV (PSS, PTR, ILE) lewat web client NAV dan masukkan ke SCM Tower,
 * sama seperti upload manual di menu Outbound dan Receiving.
 *
 *   npx tsx scripts/nav-sync/nav-sync.ts               ambil 7 hari terakhir dan simpan ke SCM Tower
 *   npx tsx scripts/nav-sync/nav-sync.ts --dry-run     ambil dan hitung baris baru, tidak menyimpan
 *   npx tsx scripts/nav-sync/nav-sync.ts --probe       buka tiap halaman, catat judul/kolom + screenshot, tanpa unduh
 *   npx tsx scripts/nav-sync/nav-sync.ts --setup       buka jendela NAV (profil script) untuk mengatur kolom satu kali
 *   opsi: --days=14  --only=pss,ptr,ile  --headed (tampilkan jendela Chrome)  --windows-auth
 *         --run-id=N  jalankan permintaan "Update dari NAV" nomor N (dipakai nav-sync-watch.ts)
 * Setiap sinkronisasi sungguhan dicatat di tabel nav_sync_run (migrasi v56) agar terlihat di SCM Tower.
 * Bila sinkronisasi lain sedang berjalan, proses ini dilewati (profil Chrome tidak bisa dipakai berdua).
 *
 * Akun NAV diisi sendiri oleh pemiliknya di scripts/nav-sync/.env (lihat .env.example).
 * Tampilan kolom NAV (Personalize) tersimpan di browser, jadi script memakai profil Chrome tetap
 * di scripts/nav-sync/.chrome-profile; atur kolomnya sekali lewat --setup.
 * Koneksi Supabase dibaca dari .env.local di root proyek.
 * Urutan wajib: PSS Header dan PTR Header dulu, lalu ILE (detail butuh header).
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { chromium, type Frame, type Page } from 'playwright-core'
import { findNavHeaderRowIndex, formatError, normalizeKey } from '../../lib/nav-import/parse'
import { ingestIle, ingestPssHeader, ingestPtrHeader, type StepResult } from '../../lib/nav-import/pipeline'

const ROOT = path.resolve(__dirname, '..', '..')
const LOG_FILE = path.join(__dirname, 'nav-sync.log')
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

function readEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
}
const env = { ...readEnv(path.join(ROOT, '.env.local')), ...readEnv(path.join(__dirname, '.env')) }

const DRY_RUN = flag('dry-run')
const PROBE = flag('probe')
const SETUP = flag('setup')
const PROFILE_DIR = path.join(__dirname, '.chrome-profile')
const DAYS = Number(option('days') ?? env.NAV_DAYS ?? 7)
const BASE = (env.NAV_BASE_URL || 'http://10.10.20.166:8080/dynamicsnav110/WebClient/').replace(/\/?$/, '/')
const COMPANY = env.NAV_COMPANY || 'PT. SINAR RODA UTAMA'
const ARCHIVE = env.NAV_ARCHIVE_DIR || 'D:/nav'
const ONLY = new Set((option('only') ?? 'pss,ptr,ile').split(',').map((s) => s.trim().toLowerCase()))

// Halaman NAV dan field tanggal untuk filter. Bisa diganti lewat .env bila nomor halaman berbeda.
// Hanya gudang Medan (SCM Tower berisi lokasi MDN-PAR saja): PSS & ILE per Location Code, PTR per Transfer-to Code.
const LOCATION = env.NAV_LOCATION || 'MDN-PAR'
const SOURCES = [
  // PSS dibuka lewat menu "Posted Documents Sales": hanya di konteks menu itu kolom Document Date dan PROJECT tampil
  // (dibuka langsung lewat alamat, kolom itu tidak ada). Filter dipasang lewat dialog filter kolom NAV.
  { key: 'pss', label: 'PSS Header (Posted Sales Shipments)', page: env.NAV_PAGE_PSS || '142', dateField: 'Document Date', locationField: 'Location Code', menu: 'Posted Documents Sales' },
  { key: 'ptr', label: 'PTR Header (Posted Transfer Receipts)', page: env.NAV_PAGE_PTR || '5753', dateField: 'Posting Date', locationField: 'Transfer-to Code', menu: null },
  { key: 'ile', label: 'ILE (Item Ledger Entries)', page: env.NAV_PAGE_ILE || '38', dateField: 'Posting Date', locationField: 'Location Code', menu: null },
] as const
type Source = (typeof SOURCES)[number]

function log(message: string) {
  const line = `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${message}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* log opsional */ }
}

const jakartaDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() + offsetDays * 86400000))
/** Format tanggal filter NAV sesuai tampilan web client (bulan/tanggal/tahun). */
const navDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}` }

function pageUrl(page: string, dateField: string, locationField: string, from: string, to: string) {
  const filter = `'${dateField}' IS '${navDate(from)}..${navDate(to)}' AND '${locationField}' IS '${LOCATION}'`
  return `${BASE}?company=${encodeURIComponent(COMPANY)}&page=${page}&filter=${encodeURIComponent(filter)}`
}

/**
 * Tunggu daftar NAV selesai dimuat. Isi web client NAV 2018 berada di iframe (?runinframe=1);
 * kembalikan frame itu karena semua tombol dan kolom ada di dalamnya.
 */
async function waitForList(page: Page): Promise<Frame> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => /- Microsoft Dynamics NAV$/.test(document.title) && !/^Microsoft Dynamics NAV$/.test(document.title), null, { timeout: 90_000 })
  let frame: Frame | undefined
  for (let i = 0; i < 60 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes('runinframe=1'))
    if (!frame) await page.waitForTimeout(500)
  }
  if (!frame) throw new Error('Frame isi NAV (runinframe) tidak ditemukan')
  await frame.locator('.ribbon-container.loaded:not([aria-hidden="true"])').first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForTimeout(1500)
  return frame
}

/** Tombol "Open in Excel" ada di grup Page pada tab ribbon HOME; buka tab HOME bila belum terlihat. */
async function openInExcelButton(frame: Frame) {
  const button = frame.locator('a.ms-cui-ctl-large', { hasText: /Open in\s*Excel/i }).first()
  if (await button.isVisible().catch(() => false)) return button
  await frame.locator('li.ms-cui-tt[title="Home"] a.ms-cui-tt-a').first().click()
  await button.waitFor({ state: 'visible', timeout: 20_000 })
  return button
}

/** Buka halaman lewat menu navigasi role center (mis. "Posted Documents Sales"). */
async function openViaMenu(page: Page, menuTitle: string, expectedTitle: RegExp): Promise<Frame> {
  await page.goto(`${BASE}?company=${encodeURIComponent(COMPANY)}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  const home = await waitForList(page)
  const found = await home.evaluate((title) => {
    const el = [...document.querySelectorAll('a')].find((a) => (a as HTMLElement).title === title) as HTMLElement | undefined
    el?.click()
    return Boolean(el)
  }, menuTitle)
  if (!found) throw new Error(`Menu "${menuTitle}" tidak ditemukan di NAV`)
  await page.waitForFunction((source) => new RegExp(source).test(document.title), expectedTitle.source, { timeout: 90_000 })
  return waitForList(page)
}

/** Filter kolom lewat NAV: klik kanan judul kolom → Filter... → isi nilai → OK. */
async function filterColumn(page: Page, frame: Frame, column: string, value: string) {
  const header = frame.locator(`th[abbr="${column}"]`).first()
  await header.waitFor({ state: 'visible', timeout: 30_000 })
  await header.click({ button: 'right' })
  await frame.locator('[role="menuitem"]', { hasText: /^Filter/ }).first().click()
  const dialog = frame.locator('[role="dialog"]').last()
  const input = dialog.locator('input').first()
  await input.waitFor({ state: 'visible', timeout: 15_000 })
  await input.fill(value)
  await dialog.getByRole('button', { name: 'OK' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(2500)
}

/** Buka halaman sumber dengan filter tanggal + lokasi; kembalikan frame isinya. */
async function openSource(page: Page, source: Source, from: string, to: string): Promise<Frame> {
  if (!source.menu) {
    await page.goto(pageUrl(source.page, source.dateField, source.locationField, from, to), { waitUntil: 'domcontentloaded', timeout: 90_000 })
    return waitForList(page)
  }
  const frame = await openViaMenu(page, source.menu, /Posted Sales Shipments/)
  await filterColumn(page, frame, source.dateField, `${navDate(from)}..${navDate(to)}`)
  await filterColumn(page, frame, source.locationField, LOCATION)
  return frame
}

async function probe(page: Page, frame: Frame, source: (typeof SOURCES)[number], dir: string) {
  const title = await page.title()
  const headers = await frame.locator('th').allInnerTexts().catch(() => [])
  const excel = await openInExcelButton(frame).then(() => 'ada').catch(() => 'TIDAK ditemukan')
  const shot = path.join(dir, `probe-${source.key}.png`)
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
  log(`[probe] ${source.label}: judul "${title}" | tombol Open in Excel ${excel} | kolom: ${headers.map((h) => h.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30).join(' | ')}`)
  log(`[probe] screenshot: ${shot}`)
}

async function download(page: Page, frame: Frame, source: (typeof SOURCES)[number], dir: string) {
  const button = await openInExcelButton(frame)
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), button.click()])
  const target = path.join(dir, `${source.key}-${jakartaDate()}.xlsx`)
  await file.saveAs(target)
  return target
}

function readRows(file: string): Record<string, any>[] {
  const workbook = XLSX.read(fs.readFileSync(file), { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const asArrays = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 }) as unknown[][]
  return XLSX.utils.sheet_to_json(sheet, { defval: null, range: findNavHeaderRowIndex(asArrays) }) as Record<string, any>[]
}

// ── Riwayat sinkronisasi (nav_sync_run) ─────────────────────────────────────
type Db = ReturnType<typeof createClient<any>>
let run: { db: Db; id: number } | null = null
const report: string[] = []
/** Catat ke log dan ke ringkasan yang tampil di SCM Tower. */
function note(message: string) { log(message); report.push(message.trim()) }

async function finishRun(status: 'done' | 'failed', error?: string) {
  if (!run) return
  await run.db.from('nav_sync_run').update({
    status, finished_at: new Date().toISOString(), summary: report.join('\n') || null, error: error ?? null,
  }).eq('id', run.id)
  run = null
}

const summary = (r?: StepResult) => (r ? `${r.inserted} baru${DRY_RUN ? ' (uji coba)' : ''}, ${r.skipped} dilewati dari ${r.total}${r.note ? ` · ${r.note}` : ''}` : '-')

async function main() {
  if (!env.NAV_USERNAME || !env.NAV_PASSWORD) {
    if (!flag('windows-auth')) throw new Error('NAV_USERNAME dan NAV_PASSWORD belum diisi di scripts/nav-sync/.env (atau pakai --windows-auth)')
  }
  if (!PROBE && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Koneksi Supabase (.env.local) tidak ditemukan')

  const db = PROBE ? null : createClient<any>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  // Sinkronisasi sungguhan dicatat di nav_sync_run; satu proses saja dalam satu waktu.
  if (db && !DRY_RUN && !SETUP) {
    const runId = Number(option('run-id') ?? 0) || null
    const since = new Date(Date.now() - 30 * 60_000).toISOString()
    const { data: busy, error: busyError } = await db.from('nav_sync_run').select('id').eq('status', 'running').gte('started_at', since).limit(1)
    if (busyError) log(`Peringatan: riwayat sinkronisasi tidak bisa dibaca (${busyError.message}). Jalankan migrasi v56.`)
    else if (busy?.length && busy[0].id !== runId) {
      log(`Sinkronisasi lain (#${busy[0].id}) sedang berjalan. Proses ini dilewati.`)
      return
    } else if (runId) {
      await db.from('nav_sync_run').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', runId)
      run = { db, id: runId }
    } else {
      const { data: created } = await db.from('nav_sync_run')
        .insert({ trigger: 'schedule', status: 'running', requested_by: 'Jadwal otomatis', started_at: new Date().toISOString() })
        .select('id').single()
      if (created) run = { db, id: Number(created.id) }
    }
  }

  const to = jakartaDate()
  const from = jakartaDate(-(DAYS - 1))
  const dir = path.join(ARCHIVE, to)
  fs.mkdirSync(dir, { recursive: true })
  log(`Mulai ${PROBE ? 'probe' : DRY_RUN ? 'uji coba' : 'sinkronisasi'} NAV: ${from} s/d ${to} (${[...ONLY].join(', ')})`)

  // Profil Chrome tetap: pengaturan kolom NAV (Personalize) disimpan di browser dan dipakai lagi tiap jalan.
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: !(flag('headed') || SETUP),
    acceptDownloads: true,
    viewport: SETUP ? null : { width: 1600, height: 900 },
    // --windows-auth: pakai login Windows yang sedang aktif (tanpa username/password di .env).
    args: flag('windows-auth') ? [`--auth-server-allowlist=${new URL(BASE).hostname}`] : [],
    ...(flag('windows-auth') ? {} : { httpCredentials: { username: env.NAV_USERNAME!, password: env.NAV_PASSWORD! } }),
  })
  const browser = { close: () => context.close() }
  const page = context.pages()[0] ?? await context.newPage()

  if (SETUP) {
    // Buka halaman yang dipakai script; pemilik akun menambah kolom lewat Personalize lalu menutup jendela.
    for (const source of SOURCES.filter((s) => ONLY.has(s.key))) {
      const tab = source.key === SOURCES.find((s) => ONLY.has(s.key))!.key ? page : await context.newPage()
      await tab.goto(`${BASE}?company=${encodeURIComponent(COMPANY)}&page=${source.page}`, { waitUntil: 'domcontentloaded' })
    }
    log('Mode setup: atur kolom di jendela Chrome yang terbuka (Personalize), lalu tutup jendelanya.')
    await new Promise<void>((resolve) => context.on('close', () => resolve()))
    log('Mode setup selesai.')
    return
  }

  let failed = false
  // Header yang gagal diambil: bagian ILE yang bergantung padanya dilewati (PSS → Outbound, PTR → Receiving).
  const skipIle = new Set<'outbound' | 'receiving'>()
  try {
    for (const source of SOURCES) {
      if (!ONLY.has(source.key)) continue
      try {
        // NAV kadang lambat/menu belum siap: coba ulang sekali dengan membuka halaman dari awal.
        let frame: Frame
        try {
          frame = await openSource(page, source, from, to)
        } catch (error) {
          log(`${source.label}: percobaan pertama gagal (${formatError(error).split('\n')[0]}), mencoba lagi`)
          await page.waitForTimeout(5000)
          frame = await openSource(page, source, from, to)
        }
        if (PROBE) { await probe(page, frame, source, dir); continue }

        const file = await download(page, frame, source, dir)
        const downloaded = readRows(file)
        // Pengaman bila filter lokasi di alamat NAV tidak diterapkan: buang baris lokasi lain.
        const locationKey = normalizeKey(source.locationField)
        const rows = downloaded.filter((row) => {
          const entry = Object.entries(row).find(([k]) => normalizeKey(k) === locationKey)
          return !entry || String(entry[1] ?? '').trim().toUpperCase() === LOCATION
        })
        log(`${source.label}: ${downloaded.length} baris diunduh, ${rows.length} baris ${LOCATION} → ${file}`)
        const name = path.basename(file)
        if (source.key === 'pss') note(`PSS Header: ${summary(await ingestPssHeader(db!, rows, name, { dryRun: DRY_RUN }))}`)
        if (source.key === 'ptr') note(`PTR Header: ${summary(await ingestPtrHeader(db!, rows, name, { dryRun: DRY_RUN }))}`)
        if (source.key === 'ile') {
          const result = await ingestIle(db!, rows, name, { dryRun: DRY_RUN, skip: [...skipIle] })
          note(`ILE → Receiving: ${skipIle.has('receiving') ? 'dilewati (PTR Header gagal)' : summary(result.receiving)}`)
          note(`ILE → Outbound: ${skipIle.has('outbound') ? 'dilewati (PSS Header gagal)' : summary(result.outbound)}`)
          note(`ILE → PTS crossdocking: ${summary(result.pts)}`)
          for (const error of result.errors) { failed = true; note(`GAGAL ${error}`) }
        }
      } catch (error) {
        failed = true
        const shot = path.join(dir, `error-${source.key}.png`)
        await page.screenshot({ path: shot }).catch(() => {})
        log(`GAGAL ${source.label}: ${formatError(error)} (screenshot: ${shot})`)
        report.push(`GAGAL ${source.label}: ${formatError(error).split('\n')[0]}`)
        // Header gagal: detail yang bergantung padanya tidak diambil dulu (akan masuk di sinkron berikutnya).
        if (source.key === 'pss') skipIle.add('outbound')
        if (source.key === 'ptr') skipIle.add('receiving')
      }
    }
  } finally {
    await browser.close()
  }
  log(failed ? 'Selesai dengan kegagalan. Data bisa di-upload manual seperti biasa.' : 'Selesai.')
  await finishRun(failed ? 'failed' : 'done', failed ? 'Sebagian data gagal diambil' : undefined)
  if (failed) process.exitCode = 1
}

main().catch(async (error) => {
  log(`GAGAL: ${formatError(error)}`)
  await finishRun('failed', formatError(error).slice(0, 500)).catch(() => {})
  process.exitCode = 1
})
