/**
 * exportExcel — client-side Excel export utility
 * Pakai xlsx library yang sudah ada di project.
 * Harus dipanggil dari client component (browser only).
 */
import * as XLSX from 'xlsx'

export interface ExportSheetConfig {
  sheetName: string
  rows: Record<string, any>[]
  columns?: {
    key: string
    header: string
    width?: number       // karakter
    format?: 'date' | 'number' | 'currency' | 'text'
  }[]
}

/**
 * Export satu atau lebih sheet ke file .xlsx dan trigger download.
 * @param sheets Array config per sheet
 * @param fileName Nama file tanpa ekstensi
 */
export function exportToExcel(sheets: ExportSheetConfig[], fileName: string) {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const { sheetName, rows, columns } = sheet

    // Jika columns tidak didefinisikan, pakai semua key dari baris pertama
    const cols = columns ?? (rows[0]
      ? Object.keys(rows[0]).map(k => ({ key: k, header: k, width: undefined, format: undefined }))
      : [])

    // Header row
    const headerRow = cols.map(c => c.header)

    // Data rows
    const dataRows = rows.map(row =>
      cols.map(c => {
        const v = row[c.key]
        if (v == null) return ''
        if (c.format === 'date' && typeof v === 'string') {
          // Kembalikan string date apa adanya — Excel akan bisa parse
          return v.slice(0, 10)
        }
        if (c.format === 'number' || c.format === 'currency') {
          return typeof v === 'number' ? v : Number(v) || 0
        }
        return v
      })
    )

    const wsData = [headerRow, ...dataRows]
    const ws     = XLSX.utils.aoa_to_sheet(wsData)

    // Set column widths
    ws['!cols'] = cols.map(c => ({ wch: c.width ?? Math.max(c.header.length + 2, 12) }))

    // Bold header row
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8EAED' } } }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`)
}

/**
 * Format angka ke currency Indonesia (tanpa simbol Rp)
 */
export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return ''
  return v.toLocaleString('id-ID')
}
