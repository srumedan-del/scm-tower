import ExcelJS from 'exceljs'
import { STOCK_OPNAME_TEMPLATE_BASE64 } from '@/lib/templates/stock-opname-template'
import { lineDifference, opnameDateParts } from '@/lib/stock-opname'

type Line = {
  bincode: string | null
  kategori: string | null
  no_item: string | null
  nama_item: string | null
  lot_no: string | null
  expiration_date: string | null
  qty_system: number
  qty_physical: number | null
  penyebab: string | null
  action_plan: string | null
  line_status: string | null
}

export type OpnameDoc = 'lembar' | 'berita'

const SHEET = { lembar: 'BL ELISIO', berita: 'F-SRU-SCMWHL-37' } as const
// Baris data bawaan template (format sudah ada); lebih dari ini baris diduplikasi.
const LAYOUT = {
  lembar: { first: 5, last: 34, columns: 'CDEFGHIJKLMN' },
  berita: { first: 9, last: 52, columns: 'ABCDEFGHIJKLMN' },
}

const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null)

/** Isi template resmi F-SRU-SCMWHL-37 dan kembalikan file .xlsx satu sheet. */
export async function buildOpnameWorkbook(input: {
  doc: OpnameDoc
  opnameDate: string
  period?: string
  pic: string | null
  lines: Line[]
  signers: { name: string; title: string }[]
}) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(STOCK_OPNAME_TEMPLATE_BASE64, 'base64') as unknown as ArrayBuffer)
  // Excel menghitung ulang semua rumus (selisih, total per item) saat file dibuka.
  workbook.calcProperties.fullCalcOnLoad = true
  for (const sheet of [...workbook.worksheets]) if (sheet.name !== SHEET[input.doc]) workbook.removeWorksheet(sheet.id)
  const ws = workbook.getWorksheet(SHEET[input.doc])!
  if (input.doc === 'berita') {
    fillBerita(ws, input)
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }
  const layout = LAYOUT[input.doc]
  const capacity = layout.last - layout.first + 1
  const extra = Math.max(0, input.lines.length - capacity)
  if (extra) ws.duplicateRow(layout.first, extra, true)
  const lastDataRow = layout.last + extra

  // Kosongkan contoh isi template di area data.
  for (let r = layout.first; r <= lastDataRow; r++) {
    for (const c of layout.columns) ws.getCell(`${c}${r}`).value = null
  }

  const date = opnameDateParts(input.opnameDate)
  input.lines.forEach((line, index) => {
    const r = layout.first + index
    const set = (col: string, value: ExcelJS.CellValue) => {
      const cell = ws.getCell(`${col}${r}`)
      cell.value = value
      // Gaya sel bisa dipakai bersama sel lain; salin dulu agar format tanggal tidak menular.
      if (value instanceof Date) cell.style = { ...cell.style, numFmt: 'dd/mm/yyyy' }
    }
    if (input.doc === 'lembar') {
      set('C', index + 1); set('D', line.bincode); set('E', line.kategori); set('F', line.no_item); set('G', line.nama_item)
      set('H', line.lot_no); set('I', toDate(line.expiration_date)); set('J', null); set('K', line.qty_system)
      // Lembar hitung dibawa ke gudang: Qty Fisik dan Selisih diisi tangan.
    } else {
      const diff = lineDifference(line)
      set('A', index + 1); set('B', line.bincode); set('C', line.kategori); set('D', line.nama_item); set('E', line.no_item)
      set('F', line.lot_no); set('G', toDate(line.expiration_date)); set('H', line.qty_system); set('I', input.pic)
      set('J', line.qty_physical)
      set('K', line.qty_physical == null ? null : { formula: `J${r}-H${r}`, result: diff ?? 0 })
      set('L', line.penyebab); set('M', line.action_plan); set('N', line.line_status)
    }
  })

  if (input.doc === 'lembar') {
    ws.getCell('M2').value = `TANGGAL : ${date.long}`
    // Judul template berbunyi "...MINGGUAN..."; sesuaikan dengan periode sesi.
    const period = (input.period ?? 'Mingguan').toUpperCase()
    for (let row = 1; row <= 3; row++) {
      ws.getRow(row).eachCell(cell => {
        const value = cell.value as unknown
        const text = typeof value === 'string' ? value
          : value && typeof value === 'object' && 'richText' in value ? (value as { richText: { text: string }[] }).richText.map(part => part.text).join('') : null
        if (text && /MINGGUAN/i.test(text)) cell.value = text.replace(/MINGGUAN/i, period)
      })
    }
  } else {
    ws.getCell('A3').value = `PERIODE ${date.upper}`
    ws.getCell('A5').value = `Pada hari ${date.day}, tanggal ${date.long} telah dilaksanakan stock opname di gudang Medan oleh Tim Accounting dan Tim SCM`
    // Kolom tanda tangan: Dibuat Oleh (A), Diperiksa Oleh (D, E, H, K).
    const nameRow = 61 + extra
    ;['A', 'D', 'E', 'H', 'K'].forEach((col, i) => {
      const signer = input.signers[i]
      ws.getCell(`${col}${nameRow}`).value = signer?.name ?? ''
      ws.getCell(`${col}${nameRow + 1}`).value = signer?.title ?? ''
    })
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

// ── Berita acara F-SRU-SCMWHL-37 ─────────────────────────────────────────────
const BERITA = { first: 9, bottomFirst: 52, bottomLast: 62, lastCol: 18 } as const
const YELLOW: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
const clone = <T,>(value: T): T => (value == null ? value : JSON.parse(JSON.stringify(value)))

export type BeritaEntry = { kind: 'line'; line: Line; no: number } | { kind: 'total'; no_item: string; from: number; to: number; system: number; physical: number | null; diff: number | null }

/** Baris per lot, lalu baris TOTAL per item (kuning, tebal). */
export function beritaEntries(lines: Line[]): BeritaEntry[] {
  const entries: BeritaEntry[] = []
  let start = 0
  lines.forEach((line, index) => {
    entries.push({ kind: 'line', line, no: index + 1 })
    const next = lines[index + 1]
    if (next && next.no_item === line.no_item) return
    const group = lines.slice(start, index + 1)
    const counted = group.filter(l => l.qty_physical != null)
    const firstRow = entries.length - group.length
    entries.push({
      kind: 'total', no_item: line.no_item ?? '-', from: firstRow, to: entries.length - 1,
      system: group.reduce((s, l) => s + l.qty_system, 0),
      physical: counted.length ? counted.reduce((s, l) => s + (l.qty_physical ?? 0), 0) : null,
      diff: counted.length ? counted.reduce((s, l) => s + ((l.qty_physical ?? 0) - l.qty_system), 0) : null,
    })
    start = index + 1
  })
  return entries
}

function fillBerita(ws: ExcelJS.Worksheet, input: { opnameDate: string; pic: string | null; lines: Line[]; signers: { name: string; title: string }[] }) {
  const date = opnameDateParts(input.opnameDate)
  const entries = beritaEntries(input.lines)

  // Simpan gaya baris data, lalu isi, gaya, tinggi dan gabungan sel bagian penutup/tanda tangan.
  const dataStyle = Array.from({ length: 14 }, (_, i) => clone(ws.getCell(BERITA.first, i + 1).style))
  const bottom = []
  for (let r = BERITA.bottomFirst; r <= BERITA.bottomLast; r++) {
    const row = ws.getRow(r)
    bottom.push({ height: row.height, cells: Array.from({ length: BERITA.lastCol }, (_, i) => ({ value: clone(ws.getCell(r, i + 1).value), style: clone(ws.getCell(r, i + 1).style) })) })
  }
  const bottomMerges = (ws.model.merges as string[]).filter(range => Number(range.match(/\d+/)![0]) >= BERITA.bottomFirst)
  bottomMerges.forEach(range => ws.unMergeCells(range))

  // Kosongkan seluruh area data dan bagian bawah template.
  const clearTo = Math.max(BERITA.bottomLast, BERITA.first + entries.length + 1 + bottom.length)
  for (let r = BERITA.first; r <= clearTo; r++) {
    ws.getRow(r).height = undefined as unknown as number
    for (let c = 1; c <= BERITA.lastCol; c++) { const cell = ws.getCell(r, c); cell.value = null; cell.style = {} }
  }

  // Baris lot dan baris total.
  entries.forEach((entry, index) => {
    const r = BERITA.first + index
    for (let c = 1; c <= 14; c++) ws.getCell(r, c).style = clone(dataStyle[c - 1])
    const set = (col: string, value: ExcelJS.CellValue) => {
      const cell = ws.getCell(`${col}${r}`)
      cell.value = value
      if (value instanceof Date) cell.style = { ...cell.style, numFmt: 'dd/mm/yyyy' }
    }
    if (entry.kind === 'line') {
      const { line } = entry
      set('A', entry.no); set('B', line.bincode); set('C', line.kategori); set('D', line.nama_item); set('E', line.no_item)
      set('F', line.lot_no); set('G', toDate(line.expiration_date)); set('H', line.qty_system); set('I', input.pic)
      set('J', line.qty_physical)
      set('K', line.qty_physical == null ? null : { formula: `J${r}-H${r}`, result: lineDifference(line) ?? 0 })
      set('L', line.penyebab); set('M', line.action_plan); set('N', line.line_status)
    } else {
      const from = BERITA.first + entry.from
      const to = BERITA.first + entry.to
      set('D', `TOTAL ${entry.no_item}`)
      set('H', { formula: `SUM(H${from}:H${to})`, result: entry.system })
      set('J', entry.physical == null ? null : { formula: `SUM(J${from}:J${to})`, result: entry.physical })
      set('K', entry.diff == null ? null : { formula: `SUM(K${from}:K${to})`, result: entry.diff })
      for (let c = 1; c <= 14; c++) {
        const cell = ws.getCell(r, c)
        cell.fill = YELLOW
        cell.font = { ...(cell.font ?? {}), bold: true }
      }
    }
  })

  // Satu baris kosong bergaris setelah data.
  const blankRow = BERITA.first + entries.length
  for (let c = 1; c <= 14; c++) ws.getCell(blankRow, c).style = clone(dataStyle[c - 1])

  // Tempel kembali penutup dan tanda tangan tepat di bawahnya.
  const bottomStart = blankRow + 1
  const offset = bottomStart - BERITA.bottomFirst
  bottom.forEach((row, i) => {
    const r = bottomStart + i
    if (row.height) ws.getRow(r).height = row.height
    row.cells.forEach((cell, c) => { const target = ws.getCell(r, c + 1); target.style = cell.style ?? {}; target.value = cell.value })
  })
  bottomMerges.forEach(range => {
    const shifted = range.replace(/([A-Z]+)(\d+)/g, (_, col: string, row: string) => `${col}${Number(row) + offset}`)
    ws.mergeCells(shifted)
  })

  ws.getCell('A3').value = `PERIODE ${date.upper}`
  ws.getCell('A5').value = `Pada hari ${date.day}, tanggal ${date.long} telah dilaksanakan stock opname di gudang Medan oleh Tim Accounting dan Tim SCM`
  // Kolom tanda tangan: Dibuat Oleh (A), Diperiksa Oleh (D, E, H, K).
  const nameRow = 61 + offset
  ;['A', 'D', 'E', 'H', 'K'].forEach((col, i) => {
    const signer = input.signers[i]
    ws.getCell(`${col}${nameRow}`).value = signer?.name ?? ''
    ws.getCell(`${col}${nameRow + 1}`).value = signer?.title ?? ''
  })
  // Area cetak mengikuti isi baru.
  ws.pageSetup.printArea = `A1:N${BERITA.bottomLast + offset}`
}
