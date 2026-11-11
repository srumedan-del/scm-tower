/**
 * Mengisi Laporan Tracking Pengiriman (Excel di folder sharing) dari data shipment SCM Tower.
 *
 *   Y  DISERAHKAN SCM DRV  = tanggal shipment dibuat
 *   Z  KIRIM / TANGGAL     = tanggal pengiriman (dispatch)
 *   AA PSS KEMBALI/TANGGAL = tanggal diterima customer (hanya jika Delivered)
 *
 * Acuan baris adalah Nomor PSS di kolom D. Hanya sel yang masih kosong yang diisi,
 * jadi isian manual tim tidak pernah tertimpa. Hasil setiap putaran dicatat sebagai
 * task harian di Task Board.
 *
 * Pemakaian:  node update-laporan.cjs [--dry-run] [--file "<path xlsx>"]
 */
const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DEFAULT_FILE = 'D:/srgjaya/File Sharing SCM Medan/Laporan Tracking Pengiriman 1.xlsx'
const FIRST_MONTH = '2611' // PSS-YYMM: mulai November 2026
const DATE_FORMAT = 'dd/mm/yyyy'
const COLUMNS = { Y: 'shipment dibuat', Z: 'kirim', AA: 'diterima customer' }

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const fileArg = args.indexOf('--file')
const file = fileArg >= 0 ? args[fileArg + 1] : (process.env.LAPORAN_TRACKING_FILE || DEFAULT_FILE)
const logFile = path.join(__dirname, 'update-laporan.log')

function loadEnv() {
  const env = {}
  for (const name of ['.env', '.env.local']) {
    const full = path.join(PROJECT_ROOT, name)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Konfigurasi Supabase tidak ditemukan di .env.local')
  return env
}

const env = loadEnv()
const rest = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/'
const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }

const jakartaDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(value))
const jakartaTime = () => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date())
const toExcelDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const display = iso => iso.split('-').reverse().join('/')

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)
  if (!dryRun) fs.appendFileSync(logFile, line + '\n')
}

function isLocked(target) {
  try {
    fs.closeSync(fs.openSync(target, 'r+'))
    return false
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM') return true
    throw error
  }
}

async function fetchShipments(pssNos) {
  const rows = []
  for (let i = 0; i < pssNos.length; i += 150) {
    const list = pssNos.slice(i, i + 150).map(no => `"${no}"`).join(',')
    const response = await fetch(rest + `shipment_tracking?select=id,pss_no,status,created_at,dispatch_time,delivery_time&pss_no=in.(${list})&order=id`, { headers })
    if (!response.ok) throw new Error(`Gagal membaca shipment: ${response.status} ${await response.text()}`)
    rows.push(...await response.json())
  }
  const byPss = new Map()
  for (const row of rows) {
    const list = byPss.get(row.pss_no) ?? []
    list.push(row)
    byPss.set(row.pss_no, list)
  }
  // Percobaan gagal tidak dipakai jika sudah ada pengiriman ulang.
  return new Map([...byPss].map(([pss, attempts]) => [pss, attempts.filter(a => a.status !== 'Failed Delivery').pop() ?? attempts.pop()]))
}

/** Satu task per hari di Task Board, diperbarui setiap putaran. */
async function recordTask({ status, summary, details }) {
  const today = jakartaDate()
  const id = `auto-laporan-tracking-${today}`
  const existing = await fetch(rest + `scm_tasks?select=description&id=eq.${id}`, { headers }).then(r => r.json())
  const previous = Array.isArray(existing) && existing[0]?.description ? existing[0].description : ''
  const entry = [`${jakartaTime()} WIB — ${summary}`, ...details].join('\n')
  const description = [entry, previous].filter(Boolean).join('\n\n').slice(0, 8000)
  const task = {
    id,
    name: `Update Laporan Tracking Pengiriman — ${display(today)}`,
    description,
    status,
    deadline: today,
    pic: 'SCM Tower (otomatis)',
    assigner: 'SCM Tower',
    frequency: 'Harian',
    tags: ['otomatis', 'laporan-tracking'],
    updated_at: new Date().toISOString(),
  }
  const response = await fetch(rest + 'scm_tasks?on_conflict=id', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(task),
  })
  if (!response.ok) throw new Error(`Gagal mencatat ke Task Board: ${response.status} ${await response.text()}`)
}

async function main() {
  if (!fs.existsSync(file)) throw new Error(`File tidak ditemukan: ${file}`)
  // File yang sedang dibuka di Excel tetap bisa dibaca, tapi tidak bisa ditulis.
  const locked = !dryRun && isLocked(file)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(file)

  const targets = []
  workbook.eachSheet(sheet => {
    sheet.eachRow((row, number) => {
      const pss = String(row.getCell('D').value ?? '').trim()
      const match = pss.match(/^PSS-(\d{4})-\d+$/)
      if (match && match[1] >= FIRST_MONTH) targets.push({ sheet, row, number, pss })
    })
  })

  const shipments = await fetchShipments([...new Set(targets.map(t => t.pss))])
  const changes = []
  let reformatted = 0

  for (const target of targets) {
    const shipment = shipments.get(target.pss)
    const values = shipment ? {
      Y: shipment.created_at ? jakartaDate(shipment.created_at) : null,
      Z: shipment.dispatch_time ? jakartaDate(shipment.dispatch_time) : null,
      AA: shipment.status === 'Delivered' && shipment.delivery_time ? jakartaDate(shipment.delivery_time) : null,
    } : {}
    const filled = []
    for (const column of Object.keys(COLUMNS)) {
      const cell = target.row.getCell(column)
      const empty = cell.value == null || String(cell.value).trim() === ''
      if (empty && values[column]) {
        cell.value = toExcelDate(values[column])
        cell.numFmt = DATE_FORMAT
        filled.push(`${column} ${display(values[column])}`)
      } else if (cell.value instanceof Date && cell.numFmt !== DATE_FORMAT) {
        cell.numFmt = DATE_FORMAT
        reformatted++
      }
    }
    if (filled.length) changes.push(`${target.pss}: ${filled.join(', ')}`)
  }

  const missing = [...new Set(targets.map(t => t.pss))].filter(pss => !shipments.has(pss))
  const summary = changes.length
    ? `${changes.length} PSS diperbarui (${targets.length} baris PSS dicek).`
    : `Tidak ada data baru (${targets.length} baris PSS dicek).`
  const details = [...changes]
  if (missing.length) details.push(`Belum ada shipment di SCM Tower: ${missing.join(', ')}`)

  if (dryRun) {
    console.log('[uji coba] ' + summary)
    details.forEach(line => console.log('  ' + line))
    if (reformatted) console.log(`  ${reformatted} sel tanggal akan diformat ulang menjadi ${DATE_FORMAT}`)
    return
  }

  if (locked) {
    log(`File sedang dibuka di Excel; ${changes.length} PSS menunggu.`)
    // Catat hanya jika memang ada data yang tertunda, agar board tidak penuh catatan kosong.
    if (changes.length) {
      await recordTask({
        status: 'BLOCKED',
        summary: `${changes.length} PSS menunggu, tapi file sedang dibuka di Excel. Tutup file agar terisi di jadwal berikutnya.`,
        details,
      })
    }
    return
  }

  if (changes.length || reformatted) {
    const backupDir = path.join(path.dirname(file), '_cadangan laporan')
    fs.mkdirSync(backupDir, { recursive: true })
    const backup = path.join(backupDir, `${path.basename(file, '.xlsx')} ${jakartaDate()}.xlsx`)
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup)
    await workbook.xlsx.writeFile(file)
  }

  log(summary + (reformatted ? ` ${reformatted} sel diformat ulang.` : ''))
  // Hanya catat ke Task Board jika ada perubahan, agar board tidak penuh catatan kosong.
  if (changes.length) await recordTask({ status: 'DONE', summary, details })
}

main().catch(async error => {
  log(`GAGAL: ${error.message}`)
  try { if (!dryRun) await recordTask({ status: 'BLOCKED', summary: `Gagal memperbarui: ${error.message}`, details: [] }) } catch {}
  process.exit(1)
})
