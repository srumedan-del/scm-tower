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
  for (const sheet of [...workbook.worksheets]) if (sheet.name !== SHEET[input.doc]) workbook.removeWorksheet(sheet.id)
  const ws = workbook.getWorksheet(SHEET[input.doc])!
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
