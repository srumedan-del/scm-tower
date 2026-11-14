/**
 * Stock opname mingguan dari SIRUP "Stok Gudang".
 * Tabel SIRUP (#idtabel, juga isi file Export to Excel) berkolom:
 * NO, KATEGORI PRODUK, NO ITEM, NAMA ITEM, SERIAL NO, LOT NO, EXPIRATION DATE,
 * CABANG, LOCODE, LOKASI, BINCODE, RUMAH SAKIT, QUANTITY.
 * Logika yang sama dipakai scripts/sirup-opname/fetch-sirup.cjs; ubah keduanya bersamaan.
 */

/** Nama kategori persis seperti di SIRUP (termasuk ejaan "HOLOW"). */
export const OPNAME_CATEGORIES = ['HOLOW FIBER / DIALYZER', 'BLOOD TUBING SET'] as const
export const OPNAME_BINCODE = 'MDN-PAR-CON'
export const LINE_STATUSES = ['Open', 'Proses', 'Closed'] as const
/** Draft → Sedang dihitung → Selesai mengikuti progres pengisian Qty Fisik (lihat statusFromProgress). */
export const SESSION_STATUSES = ['Draft', 'Sedang dihitung', 'Selesai', 'Diverifikasi'] as const
export const statusFromProgress = (counted: number, total: number) =>
  counted === 0 ? 'Draft' : counted < total ? 'Sedang dihitung' : 'Selesai'

export const OPNAME_PERIODS = ['Harian', 'Mingguan', 'Bulanan'] as const
export type OpnamePeriod = typeof OPNAME_PERIODS[number]
/** Segmen URL per periode: /inventory/opname/harian, /mingguan, /bulanan. */
export const PERIOD_SLUG: Record<OpnamePeriod, string> = { Harian: 'harian', Mingguan: 'mingguan', Bulanan: 'bulanan' }
export const periodHref = (period: OpnamePeriod | null | undefined) => `/inventory/opname/${PERIOD_SLUG[period ?? 'Mingguan']}`

export type OpnameLineInput = {
  bincode: string
  kategori: string
  no_item: string
  nama_item: string
  serial_no: string | null
  lot_no: string | null
  expiration_date: string | null
  qty_system: number
}

const norm = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
const key = (value: unknown) => norm(value).toUpperCase()

/** "1.140" (titik ribuan) atau "1140" menjadi 1140; "7,5" menjadi 7.5. */
export function parseQty(value: unknown): number {
  if (typeof value === 'number') return value
  const text = norm(value)
  if (!text) return 0
  if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ''))
  const n = Number(text.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** "2027-06-30", "6/30/27", serial Excel, atau tanggal placeholder NAV 1753-01-01 (kosong). */
export function parseExpiry(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && value > 1000) {
    const date = new Date(Math.round((value - 25569) * 86_400_000))
    return date.getUTCFullYear() < 1900 ? null : date.toISOString().slice(0, 10)
  }
  const text = norm(value)
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return Number(match[1]) < 1900 ? null : `${match[1]}-${match[2]}-${match[3]}`
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])
    return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
  }
  return null
}

const COLUMN_ALIASES: Record<string, string[]> = {
  kategori: ['KATEGORI PRODUK', 'KATEGORI'],
  no_item: ['NO ITEM', 'ITEM NO'],
  nama_item: ['NAMA ITEM', 'DESCRIPTION'],
  serial_no: ['SERIAL NO', 'SERIAL NUMBER'],
  lot_no: ['LOT NO', 'LOT NUMBER', 'LOT'],
  expiration_date: ['EXPIRATION DATE', 'ED', 'EXPIRED'],
  bincode: ['BINCODE', 'BIN CODE'],
  qty: ['QUANTITY', 'QTY'],
}

/**
 * Baris mentah (array of cells, termasuk baris judul) menjadi baris opname yang
 * sudah disaring: kategori opname di bincode MDN-PAR-CON, qty > 0.
 */
/** Bulanan: semua item di semua bin. Harian/Mingguan: Dialyzer + Blood Tubing Set di MDN-PAR-CON. */
export const opnameTakesAll = (period: OpnamePeriod | null | undefined) => period === 'Bulanan'

/** Urutan baris: per bin dulu (Bulanan; MDN-PAR-CON paling atas), lalu kategori, item, ED, lot. */
export function sortOpnameLines<T extends { bincode: string | null; kategori: string | null; no_item: string | null; expiration_date: string | null; lot_no: string | null }>(lines: T[], byBin: boolean): T[] {
  const s = (v: string | null) => v ?? ''
  return [...lines].sort((a, b) =>
    (byBin ? Number(a.bincode !== OPNAME_BINCODE) - Number(b.bincode !== OPNAME_BINCODE) || s(a.bincode).localeCompare(s(b.bincode)) : 0) ||
    s(a.kategori).localeCompare(s(b.kategori)) || s(a.no_item).localeCompare(s(b.no_item)) ||
    s(a.expiration_date).localeCompare(s(b.expiration_date)) || s(a.lot_no).localeCompare(s(b.lot_no)))
}

export function extractOpnameLines(rows: unknown[][], options: { all?: boolean } = {}): { lines: OpnameLineInput[]; totalRows: number } {
  const headerIndex = rows.findIndex(row => row.some(cell => key(cell) === 'KATEGORI PRODUK') && row.some(cell => key(cell) === 'QUANTITY'))
  if (headerIndex < 0) throw new Error('Kolom "KATEGORI PRODUK" dan "QUANTITY" tidak ditemukan. Pastikan file berasal dari SIRUP Stok Gudang.')
  const header = rows[headerIndex].map(key)
  const col = Object.fromEntries(Object.entries(COLUMN_ALIASES).map(([field, aliases]) => [field, header.findIndex(cell => aliases.includes(cell))]))
  for (const required of ['kategori', 'no_item', 'lot_no', 'bincode', 'qty']) {
    if (col[required] < 0) throw new Error(`Kolom ${COLUMN_ALIASES[required][0]} tidak ditemukan di file.`)
  }
  const at = (row: unknown[], field: string) => (col[field] >= 0 ? row[col[field]] : '')
  const categories = new Set<string>(OPNAME_CATEGORIES)

  const data = rows.slice(headerIndex + 1).filter(row => norm(at(row, 'no_item')))
  const lines = data
    .filter(row => options.all || (categories.has(key(at(row, 'kategori'))) && key(at(row, 'bincode')) === OPNAME_BINCODE))
    .map(row => ({
      bincode: key(at(row, 'bincode')),
      kategori: key(at(row, 'kategori')),
      no_item: norm(at(row, 'no_item')),
      nama_item: norm(at(row, 'nama_item')),
      serial_no: norm(at(row, 'serial_no')) || null,
      lot_no: norm(at(row, 'lot_no')).replace(/\.+$/, '') || null,
      expiration_date: parseExpiry(at(row, 'expiration_date')),
      qty_system: parseQty(at(row, 'qty')),
    }))
    .filter(line => line.qty_system > 0)
  // Urut seperti form: Blood Tubing Set dulu, lalu dialyzer; per item lalu ED. Bulanan: per bin lebih dulu.
  return { lines: sortOpnameLines(lines, Boolean(options.all)), totalRows: data.length }
}

export function lineDifference(line: { qty_system: number | string; qty_physical: number | string | null }) {
  if (line.qty_physical == null || line.qty_physical === '') return null
  return Number(line.qty_physical) - Number(line.qty_system)
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** "2026-11-13" menjadi { day: "Jumat", long: "13 November 2026" }. */
export function opnameDateParts(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return { day: DAY_NAMES[date.getUTCDay()], long: `${d} ${MONTH_NAMES[m - 1]} ${y}`, upper: `${d} ${MONTH_NAMES[m - 1].toUpperCase()} ${y}` }
}
