/**
 * Ambil data NAV (PSS, PTR, ILE) lewat web client NAV dan masukkan ke SCM Tower,
 * sama seperti upload manual di menu Outbound dan Receiving.
 *
 *   npx tsx scripts/nav-sync/nav-sync.ts               ambil 7 hari terakhir dan simpan ke SCM Tower
 *   npx tsx scripts/nav-sync/nav-sync.ts --dry-run     ambil dan hitung baris baru, tidak menyimpan
 *   npx tsx scripts/nav-sync/nav-sync.ts --probe       buka tiap halaman, catat judul/kolom + screenshot, tanpa unduh
 *   opsi: --days=14  --only=pss,ptr,ile  --headed (tampilkan jendela Chrome)  --windows-auth
 *
 * Akun NAV diisi sendiri oleh pemiliknya di scripts/nav-sync/.env (lihat .env.example).
 * Koneksi Supabase dibaca dari .env.local di root proyek.
 * Urutan wajib: PSS Header dan PTR Header dulu, lalu ILE (detail butuh header).
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { chromium, type Page } from 'playwright-core'
import { findNavHeaderRowIndex, formatError } from '../../lib/nav-import/parse'
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
const DAYS = Number(option('days') ?? env.NAV_DAYS ?? 7)
const BASE = (env.NAV_BASE_URL || 'http://10.10.20.166:8080/dynamicsnav110/WebClient/').replace(/\/?$/, '/')
const COMPANY = env.NAV_COMPANY || 'PT. SINAR RODA UTAMA'
const ARCHIVE = env.NAV_ARCHIVE_DIR || 'D:/nav'
const ONLY = new Set((option('only') ?? 'pss,ptr,ile').split(',').map((s) => s.trim().toLowerCase()))

// Halaman NAV dan field tanggal untuk filter. Bisa diganti lewat .env bila nomor halaman berbeda.
const SOURCES = [
  { key: 'pss', label: 'PSS Header (Posted Sales Shipments)', page: env.NAV_PAGE_PSS || '142', dateField: 'Posting Date' },
  { key: 'ptr', label: 'PTR Header (Posted Transfer Receipts)', page: env.NAV_PAGE_PTR || '5753', dateField: 'Posting Date' },
  { key: 'ile', label: 'ILE (Item Ledger Entries)', page: env.NAV_PAGE_ILE || '38', dateField: 'Posting Date' },
] as const

function log(message: string) {
  const line = `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${message}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* log opsional */ }
}

const jakartaDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() + offsetDays * 86400000))
/** Format tanggal filter NAV sesuai tampilan web client (bulan/tanggal/tahun). */
const navDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}` }

function pageUrl(page: string, dateField: string, from: string, to: string) {
  const filter = `'${dateField}' IS '${navDate(from)}..${navDate(to)}'`
  return `${BASE}?company=${encodeURIComponent(COMPANY)}&page=${page}&filter=${encodeURIComponent(filter)}`
}

/** Tunggu daftar NAV selesai dimuat (judul halaman berisi nama halaman, bukan "Microsoft Dynamics NAV" saja). */
async function waitForList(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => /- Microsoft Dynamics NAV$/.test(document.title) && !/^Microsoft Dynamics NAV$/.test(document.title), null, { timeout: 90_000 })
  await page.waitForTimeout(2500)
}

/** Klik tab ribbon HOME bila tombol "Open in Excel" belum terlihat, lalu kembalikan tombolnya. */
async function openInExcelButton(page: Page) {
  const button = page.getByRole('button', { name: /Open in Excel/i }).or(page.getByTitle(/Open in Excel/i)).first()
  if (await button.isVisible().catch(() => false)) return button
  const home = page.getByRole('tab', { name: /^HOME$/i }).or(page.getByText(/^HOME$/)).first()
  if (await home.isVisible().catch(() => false)) {
    await home.click()
    await page.waitForTimeout(800)
  }
  await button.waitFor({ state: 'visible', timeout: 20_000 })
  return button
}

async function probe(page: Page, source: (typeof SOURCES)[number], dir: string) {
  const title = await page.title()
  const headers = await page.locator('[role="columnheader"], th').allInnerTexts().catch(() => [])
  const excel = await openInExcelButton(page).then(() => 'ada').catch(() => 'TIDAK ditemukan')
  const shot = path.join(dir, `probe-${source.key}.png`)
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
  log(`[probe] ${source.label}: judul "${title}" | tombol Open in Excel ${excel} | kolom: ${headers.map((h) => h.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30).join(' | ')}`)
  log(`[probe] screenshot: ${shot}`)
}

async function download(page: Page, source: (typeof SOURCES)[number], dir: string) {
  const button = await openInExcelButton(page)
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

const summary = (r?: StepResult) => (r ? `${r.inserted} baru${DRY_RUN ? ' (uji coba)' : ''}, ${r.skipped} dilewati dari ${r.total}${r.note ? ` · ${r.note}` : ''}` : '-')

async function main() {
  if (!env.NAV_USERNAME || !env.NAV_PASSWORD) {
    if (!flag('windows-auth')) throw new Error('NAV_USERNAME dan NAV_PASSWORD belum diisi di scripts/nav-sync/.env (atau pakai --windows-auth)')
  }
  if (!PROBE && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Koneksi Supabase (.env.local) tidak ditemukan')

  const to = jakartaDate()
  const from = jakartaDate(-(DAYS - 1))
  const dir = path.join(ARCHIVE, to)
  fs.mkdirSync(dir, { recursive: true })
  log(`Mulai ${PROBE ? 'probe' : DRY_RUN ? 'uji coba' : 'sinkronisasi'} NAV: ${from} s/d ${to} (${[...ONLY].join(', ')})`)

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !flag('headed'),
    // --windows-auth: pakai login Windows yang sedang aktif (tanpa username/password di .env).
    args: flag('windows-auth') ? [`--auth-server-allowlist=${new URL(BASE).hostname}`] : [],
  })
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1600, height: 900 },
    ...(flag('windows-auth') ? {} : { httpCredentials: { username: env.NAV_USERNAME!, password: env.NAV_PASSWORD! } }),
  })
  const page = await context.newPage()
  const db = PROBE ? null : createClient<any>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  let failed = false
  try {
    for (const source of SOURCES) {
      if (!ONLY.has(source.key)) continue
      try {
        await page.goto(pageUrl(source.page, source.dateField, from, to), { waitUntil: 'domcontentloaded', timeout: 90_000 })
        await waitForList(page)
        if (PROBE) { await probe(page, source, dir); continue }

        const file = await download(page, source, dir)
        const rows = readRows(file)
        log(`${source.label}: ${rows.length} baris diunduh → ${file}`)
        const name = path.basename(file)
        if (source.key === 'pss') log(`  PSS Header: ${summary(await ingestPssHeader(db!, rows, name, { dryRun: DRY_RUN }))}`)
        if (source.key === 'ptr') log(`  PTR Header: ${summary(await ingestPtrHeader(db!, rows, name, { dryRun: DRY_RUN }))}`)
        if (source.key === 'ile') {
          const result = await ingestIle(db!, rows, name, { dryRun: DRY_RUN })
          log(`  ILE → Receiving: ${summary(result.receiving)}`)
          log(`  ILE → Outbound: ${summary(result.outbound)}`)
          log(`  ILE → PTS crossdocking: ${summary(result.pts)}`)
          for (const error of result.errors) { failed = true; log(`  GAGAL ${error}`) }
        }
      } catch (error) {
        failed = true
        const shot = path.join(dir, `error-${source.key}.png`)
        await page.screenshot({ path: shot }).catch(() => {})
        log(`GAGAL ${source.label}: ${formatError(error)} (screenshot: ${shot})`)
        // Header gagal: jangan lanjut ke ILE agar detail tidak masuk tanpa header.
        if (source.key !== 'ile') { ONLY.delete('ile'); log('  ILE dilewati karena header gagal diambil') }
      }
    }
  } finally {
    await browser.close()
  }
  log(failed ? 'Selesai dengan kegagalan. Data bisa di-upload manual seperti biasa.' : 'Selesai.')
  if (failed) process.exitCode = 1
}

main().catch((error) => { log(`GAGAL: ${formatError(error)}`); process.exitCode = 1 })
