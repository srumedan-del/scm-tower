import ExcelJS from 'exceljs'
import type { ShipmentCostRow } from '@/app/(app)/shipment-cost/actions'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const NUM = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)'
const NUM_DEC = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)'
const TOTAL_FILL = 'FFFFE699'
const HEADER_FILL = 'FFF2F2F2'
const THIN = { style: 'thin' as const }
const BORDER = { left: THIN, right: THIN, top: THIN, bottom: THIN }

export function periodLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return 'Semua Periode'
  const [y, m] = month.split('-').map(Number)
  return `${BULAN[m - 1]} ${y}`
}

const num = (value: number | null | undefined) => (value == null || !Number(value) ? null : Number(value))

function vendorOf(row: ShipmentCostRow) {
  const notesVendor = row.notes?.match(/(?:^|\|\s*)Vendor:\s*([^|]+)/i)?.[1]?.trim()
  return (row.transporter_name?.trim() || notesVendor || 'Vendor belum ditentukan').toUpperCase()
}

const docNo = (row: ShipmentCostRow) => row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : String(row.id))
const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null)

// Kolom mengikuti format laporan bulanan "Realisasi Biaya Kirim Internal Medan DK & LK";
// tambahan: No. Trip, Ekspedisi. Keterangan sengaja dikosongkan untuk diisi manual.
const COLUMNS: { header: string; width: number; money?: boolean }[] = [
  { header: 'Date', width: 9 },
  { header: 'Customer Name', width: 44 },
  { header: 'Document No.', width: 16 },
  { header: 'No. Trip', width: 16 },
  { header: 'Tanggal PSS', width: 12 },
  { header: 'DK / LK', width: 8 },
  { header: 'INT / EXT', width: 9 },
  { header: 'Ekspedisi', width: 26 },
  { header: 'No. Invoice (Ekspedisi Eksternal)', width: 30 },
  { header: 'Total Biaya Kirim Eksternal', width: 15, money: true },
  { header: 'No. Payment', width: 20 },
  { header: 'BBM Liter', width: 10 },
  { header: 'BBM Rupiah', width: 12, money: true },
  { header: 'Bongkar Muat', width: 12, money: true },
  { header: 'Hotel', width: 11, money: true },
  { header: 'Uang Makan Driver', width: 11, money: true },
  { header: 'Uang Makan Helper', width: 11, money: true },
  { header: 'Tol', width: 11, money: true },
  { header: 'Parkir', width: 9, money: true },
  { header: 'Total Biaya', width: 13, money: true },
  { header: 'Keterangan', width: 40 },
]
const COL = (header: string) => COLUMNS.findIndex((c) => c.header === header) + 1
const letter = (n: number) => String.fromCharCode(64 + n)

/** Buat file .xlsx rekap biaya kirim bulanan (detail per PSS + rekap vendor/DK-LK). */
export async function buildShipmentCostWorkbook(rows: ShipmentCostRow[], month: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SCM Tower'
  wb.calcProperties.fullCalcOnLoad = true
  const period = periodLabel(month)
  const sorted = [...rows].sort((a, b) =>
    (a.document_date ?? '').localeCompare(b.document_date ?? '') || docNo(a).localeCompare(docNo(b)))

  // ── Sheet 1: detail ──
  const ws = wb.addWorksheet('Realisasi Biaya', { views: [{ showGridLines: false, zoomScale: 85, state: 'frozen', ySplit: 5, xSplit: 3 }] })
  ws.columns = COLUMNS.map((c) => ({ width: c.width }))
  ws.getCell('A1').value = 'Realisasi biaya kirim SCM Medan DK & LK Sumatera Utara - Nangroe Aceh Darussalam'
  ws.getCell('A2').value = `Periode : ${period}`
  for (const a of ['A1', 'A2']) ws.getCell(a).font = { bold: true, size: 11 }

  const header = ws.getRow(4)
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = BORDER
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  })
  header.height = 32

  const first = 6
  const last = first + Math.max(sorted.length, 1) - 1
  sorted.forEach((r, i) => {
    const internal = r.cost_model === 'Internal'
    const total = Number(r.total_biaya ?? 0)
    const values: Record<string, unknown> = {
      'Date': r.document_date?.slice(0, 7) ?? '',
      'Customer Name': r.customer_name ?? '',
      'Document No.': docNo(r),
      'No. Trip': r.trip_id ?? '',
      'Tanggal PSS': toDate(r.document_date),
      'DK / LK': r.dk_lk ?? '',
      'INT / EXT': internal ? 'INT' : 'EXT',
      'Ekspedisi': vendorOf(r),
      'No. Invoice (Ekspedisi Eksternal)': internal ? '' : (r.invoice_no_eksternal ?? r.no_resi ?? ''),
      'Total Biaya Kirim Eksternal': internal ? null : num(total),
      'No. Payment': r.payment_voucher_no ?? '',
      'BBM Liter': internal ? num(r.bbm_liter) : null,
      'BBM Rupiah': internal ? num(r.bbm_rupiah) : null,
      'Bongkar Muat': internal ? num(Number(r.bongkar_muat_cost ?? 0) + Number(r.biaya_tkbm ?? 0)) : null,
      'Hotel': internal ? num(r.hotel_cost) : null,
      'Uang Makan Driver': internal ? num(r.uang_makan_driver) : null,
      'Uang Makan Helper': internal ? num(r.uang_makan_helper) : null,
      'Tol': internal ? num(r.toll_cost) : null,
      'Parkir': internal ? num(r.parkir_cost) : null,
      'Total Biaya': num(total),
      'Keterangan': null,
    }
    const row = ws.getRow(first + i)
    COLUMNS.forEach((c, ci) => {
      const cell = row.getCell(ci + 1)
      cell.value = values[c.header] as never
      cell.border = BORDER
      if (c.money) cell.numFmt = NUM
    })
    row.getCell(COL('Tanggal PSS')).numFmt = 'dd/mm/yyyy'
    row.getCell(COL('BBM Liter')).numFmt = NUM_DEC
    for (const h of ['Date', 'Tanggal PSS', 'DK / LK', 'INT / EXT']) row.getCell(COL(h)).alignment = { horizontal: 'center' }
  })

  // Baris TOTAL di atas data (seperti format bulanan), rumus SUM agar tetap benar jika diedit.
  const totalRow = ws.getRow(5)
  totalRow.getCell(2).value = `TOTAL ${period.toUpperCase()}`
  const sumHeaders = COLUMNS.filter((c) => c.money || c.header === 'BBM Liter').map((c) => c.header)
  COLUMNS.forEach((c, ci) => {
    const cell = totalRow.getCell(ci + 1)
    cell.font = { bold: true }
    cell.border = BORDER
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
    if (sumHeaders.includes(c.header)) {
      const L = letter(ci + 1)
      const result = sorted.reduce((s, r, i) => s + Number(ws.getRow(first + i).getCell(ci + 1).value ?? 0), 0)
      cell.value = { formula: `SUM(${L}${first}:${L}${last})`, result }
      cell.numFmt = c.header === 'BBM Liter' ? NUM_DEC : NUM
    }
  })
  totalRow.getCell(1).value = sorted.length
  totalRow.getCell(1).numFmt = '0" PSS"'
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLUMNS.length } }

  // ── Sheet 2: rekap ──
  const rk = wb.addWorksheet('Rekap', { views: [{ showGridLines: false }] })
  rk.columns = [{ width: 38 }, { width: 12 }, { width: 18 }]
  rk.getCell('A1').value = 'Rekap Realisasi Biaya Kirim SCM Medan'
  rk.getCell('A2').value = `Periode : ${period}`
  for (const a of ['A1', 'A2']) rk.getCell(a).font = { bold: true, size: 11 }

  let at = 4
  const section = (title: string, groups: Map<string, ShipmentCostRow[]>) => {
    rk.getCell(`A${at}`).value = title
    rk.getCell(`A${at}`).font = { bold: true }
    at++
    const head = rk.getRow(at)
    ;['Kategori', 'Shipment', 'Realisasi Biaya'].forEach((h, i) => {
      const cell = head.getCell(i + 1)
      cell.value = h
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'center' }
      cell.border = BORDER
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    })
    at++
    const start = at
    const entries = [...groups.entries()].sort((a, b) => sumBy(b[1]) - sumBy(a[1]))
    for (const [name, list] of entries) {
      rk.getRow(at).values = [name, list.length, sumBy(list)]
      at++
    }
    const tot = rk.getRow(at)
    const tb = sumBy(sorted)
    tot.values = ['TOTAL']
    tot.getCell(2).value = { formula: `SUM(B${start}:B${at - 1})`, result: sorted.length }
    tot.getCell(3).value = { formula: `SUM(C${start}:C${at - 1})`, result: tb }
    for (let r = start; r <= at; r++) {
      const row = rk.getRow(r)
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c)
        cell.border = BORDER
        if (c === 3) cell.numFmt = NUM
        if (r === at) {
          cell.font = { bold: true }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
        }
      }
    }
    at += 2
  }
  const group = (key: (r: ShipmentCostRow) => string) => {
    const m = new Map<string, ShipmentCostRow[]>()
    for (const r of sorted) {
      const k = key(r)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return m
  }
  section('Per Model (Internal / Eksternal)', group((r) => (r.cost_model === 'Internal' ? 'INTERNAL' : (r.cost_model ?? 'EKSTERNAL').toUpperCase())))
  section('Per Vendor / Ekspedisi', group(vendorOf))
  section('Per DK / LK', group((r) => r.dk_lk ?? '-'))
  section('Per Customer', group((r) => r.customer_name ?? '-'))

  // Komponen biaya internal.
  rk.getCell(`A${at}`).value = 'Komponen Biaya Internal'
  rk.getCell(`A${at}`).font = { bold: true }
  at++
  const internalRows = sorted.filter((r) => r.cost_model === 'Internal')
  const komponen: [string, (r: ShipmentCostRow) => number][] = [
    ['BBM', (r) => Number(r.bbm_rupiah ?? 0)],
    ['Bongkar Muat', (r) => Number(r.bongkar_muat_cost ?? 0) + Number(r.biaya_tkbm ?? 0)],
    ['Hotel', (r) => Number(r.hotel_cost ?? 0)],
    ['Uang Makan Driver', (r) => Number(r.uang_makan_driver ?? 0)],
    ['Uang Makan Helper', (r) => Number(r.uang_makan_helper ?? 0)],
    ['Tol', (r) => Number(r.toll_cost ?? 0)],
    ['Parkir', (r) => Number(r.parkir_cost ?? 0)],
  ]
  const kh = rk.getRow(at)
  ;['Komponen', '', 'Biaya'].forEach((h, i) => {
    const cell = kh.getCell(i + 1)
    cell.value = h || null
    cell.font = { bold: true }
    cell.border = BORDER
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  })
  at++
  const kStart = at
  for (const [name, fn] of komponen) {
    const row = rk.getRow(at)
    row.getCell(1).value = name
    row.getCell(3).value = internalRows.reduce((s, r) => s + fn(r), 0)
    at++
  }
  rk.getRow(at).getCell(1).value = 'TOTAL'
  rk.getRow(at).getCell(3).value = {
    formula: `SUM(C${kStart}:C${at - 1})`,
    result: internalRows.reduce((s, r) => s + komponen.reduce((k, [, fn]) => k + fn(r), 0), 0),
  }
  for (let r = kStart; r <= at; r++) {
    for (let c = 1; c <= 3; c++) {
      const cell = rk.getRow(r).getCell(c)
      cell.border = BORDER
      if (c === 3) cell.numFmt = NUM
      if (r === at) {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
      }
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

function sumBy(list: ShipmentCostRow[]) {
  return list.reduce((s, r) => s + Number(r.total_biaya ?? 0), 0)
}
