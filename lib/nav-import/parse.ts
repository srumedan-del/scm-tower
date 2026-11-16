/**
 * Pembaca nilai untuk file ekspor NAV (PSS, PTR, ILE).
 * Dipakai bersama oleh tombol upload di browser dan script otomatis scripts/nav-sync,
 * jadi aturan pembacaannya selalu sama. Tidak bergantung pada library xlsx agar ringan di browser.
 */

export type RawRow = Record<string, any>

/** "Entry No." → "entry_no", "Document Created Date/Time" → "document_created_date_time". */
export const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Nilai kolom pertama yang terisi dari daftar alias (nama kolom dinormalisasi). */
export const pickValue = (row: RawRow, aliases: string[]) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find((k) => normalizeKey(k) === normalizeKey(alias))
    if (key && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') {
      return row[key]
    }
  }
  return null
}

/** Baris dengan nama kolom yang sudah dinormalisasi. */
export const normalizeRow = (raw: RawRow): RawRow =>
  Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeKey(key), value]))

/** Nomor seri tanggal Excel → komponen tanggal/jam (sama dengan XLSX.SSF.parse_date_code untuk tanggal modern). */
export function excelSerialParts(serial: number) {
  if (!Number.isFinite(serial)) return null
  // Aturan detik sama dengan SheetJS: dibulatkan ke bawah, kecuali sisa > 0.9999 detik.
  let days = Math.floor(serial)
  let seconds = Math.floor(86400 * (serial - days))
  const rest = 86400 * (serial - days) - seconds
  if (rest > 0.9999) {
    seconds += 1
    if (seconds === 86400) { seconds = 0; days += 1 }
  }
  // Basis 1899-12-30 sudah memperhitungkan bug tahun kabisat 1900 di Excel untuk tanggal setelah Maret 1900.
  const date = new Date(Date.UTC(1899, 11, 30) + days * 86400000)
  return {
    y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(),
    H: Math.floor(seconds / 3600), M: Math.floor((seconds % 3600) / 60), S: seconds % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (value: unknown): string => {
  if (!value && value !== 0) return '9999-12-31'
  if (typeof value === 'number') {
    const date = excelSerialParts(value)
    return date ? `${date.y}-${pad(date.m)}-${pad(date.d)}` : '9999-12-31'
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '9999-12-31'
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    return trimmed
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return '9999-12-31'
}

export const toISODateTime = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const date = excelSerialParts(value)
    if (!date) return null
    return `${date.y}-${pad(date.m)}-${pad(date.d)}T${pad(date.H)}:${pad(date.M)}:${pad(date.S)}+07:00`
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const text = String(value).trim()
  const indonesianDateTime = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (indonesianDateTime) {
    const [, day, month, year, hour, minute, second = '00'] = indonesianDateTime
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}+07:00`
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** Angka, termasuk teks dengan koma ribuan seperti "3,120". */
export const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const cleaned = typeof value === 'string' ? value.replace(/,/g, '') : value
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Hanya simpan kolom yang diizinkan dan bernilai. */
export function keepFields<T extends readonly string[]>(record: RawRow, fields: T): RawRow {
  const sanitized: RawRow = {}
  for (const field of fields) {
    const value = record[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') sanitized[field] = value
  }
  return sanitized
}

/**
 * File NAV kadang punya 1-2 baris judul (mis. "Posted Transfer Receipts") di atas header kolom.
 * Dari hasil sheet_to_json({ header: 1 }) cari indeks baris header sebenarnya.
 */
export function findNavHeaderRowIndex(rowsAsArrays: unknown[][]): number {
  for (let i = 0; i < Math.min(rowsAsArrays.length, 10); i++) {
    const cells = (rowsAsArrays[i] ?? []).map((c) => String(c ?? '').trim().toLowerCase())
    const isHeaderRow = cells.some(
      (c) =>
        c === 'no.' || c === 'no' || c === 'ptr_no' || c === 'posting date' ||
        c === 'document no.' || c === 'document no' || c === 'entry no.' || c === 'entry no' ||
        (c.length > 0 && c.startsWith('ptr'))
    )
    if (isHeaderRow) return i
  }
  return 0
}

export function formatError(error: any): string {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.'
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error)
      if (parsed && typeof parsed === 'object') return formatError(parsed)
    } catch { /* bukan JSON */ }
    return error
  }
  const target = error.error || error.cause || error
  if (target?.message) {
    let msg = typeof target.message === 'string' ? target.message : JSON.stringify(target.message)
    try {
      const inner = JSON.parse(msg)
      if (inner && inner.message) {
        msg = inner.message
        if (inner.code) msg += ` (code: ${inner.code})`
        if (inner.details) msg += `\nDetail: ${inner.details}`
        if (inner.hint) msg += `\nHint: ${inner.hint}`
        return msg
      }
    } catch { /* bukan JSON */ }
    if (target.code) msg += ` (code: ${target.code})`
    if (target.details) msg += `\nDetail: ${target.details}`
    if (target.hint) msg += `\nHint: ${target.hint}`
    return msg
  }
  return JSON.stringify(error, null, 2)
}
