#!/usr/bin/env node
/**
 * Ambil stok dari SIRUP "Stok Gudang" dan simpan sebagai snapshot harian di SCM Tower.
 * Snapshot TIDAK membuat sesi opname; sesi dibuat pengguna lewat Stock Opname → Buat Opname.
 *
 *   node fetch-sirup.cjs            -> simpan snapshot hari ini (WIB); Sabtu dan Minggu dilewati
 *   node fetch-sirup.cjs --force    -> tetap ambil walau akhir pekan
 *   node fetch-sirup.cjs --dry-run  -> hanya tampilkan hasil saringan, tidak menyimpan
 *   node fetch-sirup.cjs --debug    -> tampilkan urutan redirect dan simpan halaman hasil filter
 *
 * Kredensial SIRUP ada di scripts/sirup-opname/.env (lihat .env.example), diisi sendiri
 * oleh pemilik akun. Koneksi Supabase dibaca dari .env.local di root proyek.
 * Logika saringan sama dengan lib/stock-opname.ts; ubah keduanya bersamaan.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const LOG_FILE = path.join(__dirname, 'fetch-sirup.log')
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const DEBUG = process.argv.includes('--debug')

const CATEGORIES = new Set(['HOLOW FIBER / DIALYZER', 'BLOOD TUBING SET'])
const BINCODE = 'MDN-PAR-CON'

function log(message) {
  const line = `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${message}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* log opsional */ }
}

function readEnv(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
}

const env = { ...readEnv(path.join(ROOT, '.env.local')), ...readEnv(path.join(__dirname, '.env')) }
const SIRUP_BASE = (env.SIRUP_BASE_URL || 'https://datawh.sinarrodautama.co.id/sirup').replace(/\/$/, '')
const STOCK_PATH = env.SIRUP_STOCK_PATH || '/reportnav/stokgudang?idm=379&idm_enc=cFJ6NS9VWGU0SHhxWTRXdHdJMm1jUT09'
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

// ── HTTP dengan cookie sesi ──────────────────────────────────────────────────
const cookies = new Map()
function storeCookies(response) {
  for (const header of response.headers.getSetCookie?.() ?? []) {
    const [pair] = header.split(';')
    const i = pair.indexOf('=')
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
async function request(url, options = {}, redirects = 0) {
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
    headers: { 'User-Agent': 'SCM-Tower-Opname/1.0', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(options.headers || {}) },
  })
  storeCookies(response)
  if (DEBUG) console.log(`  ${options.method || 'GET'} ${url.replace(/idm_enc=[^&]+/, 'idm_enc=…')} -> ${response.status}${response.headers.get('location') ? ` (ke ${response.headers.get('location').replace(/idm_enc=[^&]+/, 'idm_enc=…')})` : ''} | cookie: ${[...cookies.keys()].join(', ')}`)
  const location = response.headers.get('location')
  if (location && response.status >= 300 && response.status < 400 && redirects < 5) {
    return request(new URL(location, url).toString(), { method: 'GET' }, redirects + 1)
  }
  return { response, url, text: await response.text() }
}
const csrfOf = html => html.match(/name="_csrf"\s+value="([^"]+)"/)?.[1] ?? html.match(/name="csrf-token"\s+content="([^"]+)"/)?.[1] ?? ''
const form = data => new URLSearchParams(data).toString()

// ── Parsing tabel #idtabel ───────────────────────────────────────────────────
const decode = text => text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim()
function tableRows(html) {
  const start = html.search(/<table[^>]*id=["']idtabel["']/i)
  if (start < 0) return null
  const end = html.indexOf('</table>', start)
  const table = html.slice(start, end < 0 ? undefined : end)
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => decode(c[1])))
}
const parseQty = text => {
  const t = String(text ?? '').trim()
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''))
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const parseExpiry = text => {
  const m = String(text ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m && Number(m[1]) >= 1900 ? `${m[1]}-${m[2]}-${m[3]}` : null
}
function extractLines(rows) {
  const headerIndex = rows.findIndex(r => r.some(c => c.toUpperCase() === 'KATEGORI PRODUK') && r.some(c => c.toUpperCase() === 'QUANTITY'))
  if (headerIndex < 0) throw new Error('Header tabel SIRUP tidak dikenali')
  const header = rows[headerIndex].map(c => c.toUpperCase())
  const col = name => header.indexOf(name)
  const idx = { kategori: col('KATEGORI PRODUK'), no_item: col('NO ITEM'), nama: col('NAMA ITEM'), serial: col('SERIAL NO'), lot: col('LOT NO'), ed: col('EXPIRATION DATE'), bin: col('BINCODE'), qty: col('QUANTITY') }
  const data = rows.slice(headerIndex + 1).filter(r => r[idx.no_item])
  const lines = data
    .filter(r => CATEGORIES.has(String(r[idx.kategori]).toUpperCase()) && String(r[idx.bin]).toUpperCase() === BINCODE)
    .map(r => ({
      bincode: BINCODE,
      kategori: String(r[idx.kategori]).toUpperCase(),
      no_item: r[idx.no_item],
      nama_item: r[idx.nama] ?? '',
      serial_no: r[idx.serial] || null,
      lot_no: String(r[idx.lot] ?? '').replace(/\.+$/, '') || null,
      expiration_date: parseExpiry(r[idx.ed]),
      qty_system: parseQty(r[idx.qty]),
    }))
    .filter(line => line.qty_system > 0)
    .sort((a, b) => a.kategori.localeCompare(b.kategori) || a.no_item.localeCompare(b.no_item) ||
      String(a.expiration_date ?? '').localeCompare(String(b.expiration_date ?? '')) || String(a.lot_no ?? '').localeCompare(String(b.lot_no ?? '')))
  return { lines, totalRows: data.length }
}

// ── Supabase REST ────────────────────────────────────────────────────────────
async function supabase(pathAndQuery, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...options,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

async function main() {
  if (!env.SIRUP_USERNAME || !env.SIRUP_PASSWORD) throw new Error('SIRUP_USERNAME dan SIRUP_PASSWORD belum diisi di scripts/sirup-opname/.env')
  if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) throw new Error('Koneksi Supabase (.env.local) tidak ditemukan')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()

  if (!FORCE && (weekday === 0 || weekday === 6)) { log(`${today} akhir pekan, tidak mengambil stok.`); return }

  // 1. Login
  const loginPage = await request(`${SIRUP_BASE}/site/login`)
  const loginResult = await request(`${SIRUP_BASE}/site/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ _csrf: csrfOf(loginPage.text), 'LoginForm[username]': env.SIRUP_USERNAME, 'LoginForm[password]': env.SIRUP_PASSWORD, 'LoginForm[rememberMe]': '0', 'login-button': '' }),
  })
  if (/LoginForm\[password\]/.test(loginResult.text)) throw new Error('Login SIRUP gagal. Periksa username dan password di .env')
  log('Login SIRUP berhasil')

  // 1b. Pilih role dan client (halaman /site/akses setelah login). Tanpa ini semua menu "Akses Ditolak".
  if (/name="role"/.test(loginResult.text)) {
    const role = env.SIRUP_ROLE || '407' // 407 = SCM Medan
    const client = env.SIRUP_CLIENT || '1' // 1 = Sinar Roda Utama
    const roles = [...loginResult.text.matchAll(/<option value="(\d+)"[^>]*>([^<]+)</g)].map(m => ({ value: m[1], label: m[2].trim() }))
    if (!roles.some(r => r.value === role)) throw new Error(`Role ${role} tidak tersedia untuk akun ini. Pilihan: ${roles.map(r => `${r.value}=${r.label}`).join(', ')}`)
    const aksesResult = await request(loginResult.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ _csrf: csrfOf(loginResult.text), role, client, 'login-button': '' }),
    })
    if (/name="role"/.test(aksesResult.text)) throw new Error('Gagal memilih role di SIRUP')
    log(`Role SIRUP: ${roles.find(r => r.value === role)?.label ?? role}`)
  }

  // 2. Filter Stok Gudang: CAB01-MDN / MDN-PAR / semua kategori
  const stockUrl = `${SIRUP_BASE}${STOCK_PATH}`
  const stockPage = await request(stockUrl)
  const result = await request(stockUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ _csrf: csrfOf(stockPage.text), cabang: 'CAB01-MDN', loccode: 'MDN-PAR', tglawal: '', tglakhir: '', lot: '', serno: '', tglawal2: '', kat: 'All', tombol: 'filter' }),
  })
  if (DEBUG) { const file = path.join(require('os').tmpdir(), 'sirup-stok-last.html'); fs.writeFileSync(file, result.text); console.log(`  Halaman hasil filter disimpan di ${file}`) }
  const rows = tableRows(result.text)
  if (!rows) throw new Error('Tabel stok tidak ditemukan di halaman SIRUP (format halaman mungkin berubah)')
  const { lines, totalRows } = extractLines(rows)
  log(`Tabel SIRUP: ${totalRows} baris, ${lines.length} lot opname (Dialyzer + Blood Tubing Set, ${BINCODE})`)
  if (!lines.length) throw new Error('Tidak ada baris opname setelah disaring')

  if (DRY_RUN) {
    for (const line of lines) console.log(`  ${line.kategori.padEnd(24)} ${line.no_item.padEnd(14)} ${String(line.lot_no).padEnd(12)} ${line.expiration_date} ${line.qty_system}`)
    return
  }

  // 3. Simpan snapshot hari ini (ditimpa bila script dijalankan lagi di hari yang sama)
  await supabase('sirup_stock_snapshot?on_conflict=snapshot_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ snapshot_date: today, taken_at: new Date().toISOString(), total_rows: totalRows, source_note: `SIRUP Stok Gudang CAB01-MDN/MDN-PAR (${totalRows} baris)`, lines }),
  })
  log(`Snapshot stok ${today} disimpan (${lines.length} lot). Sesi opname dibuat dari menu Stock Opname → Buat Opname.`)
}

module.exports = { tableRows, extractLines }

if (require.main === module) {
  main().catch(error => { log(`GAGAL: ${error.message}`); process.exitCode = 1 })
}
