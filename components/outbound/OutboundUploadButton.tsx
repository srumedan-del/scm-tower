'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type * as XLSXModule from 'xlsx'
import { FileUp, Loader2 } from 'lucide-react'
import { ReactNode } from 'react'
import Swal from 'sweetalert2'
import { uploadProgress, uploadResult } from '@/lib/upload-progress'
import { notify } from '@/lib/feedback'
import {
  getExistingOutboundHeaderPssNos,
  insertOutboundHeaderRows,
  getOutboundHeadersByPssNos,
  getExistingOutboundDetailEntryNos,
  insertOutboundDetailRows,
  getOutboundDetailHeaderIds,
  getOutboundHeadersForPaoMatching,
  updateOutboundDetailDocumentLinks,
  updateOutboundDetailCreatedTimes,
  updateOutboundHeaderCreatedTimes,
} from '@/app/(app)/outbound/actions'

// Import helper batch RPC (single SQL query replaces thousands of calls)
import { rpcBulkInsertOutboundDetail } from '@/app/(app)/outbound/actions-batch'
import { mapPssHeaderRow, normalizePaoToPss } from '@/lib/nav-import/map'

// Load SheetJS only for an actual upload instead of while this page is compiled.
let XLSX: typeof XLSXModule
const loadXlsx = async () => XLSX ??= await import('xlsx')

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const pickValue = (row: Record<string, any>, aliases: string[]) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find((k) => normalizeKey(k) === normalizeKey(alias))
    if (key && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') {
      return row[key]
    }
  }
  return null
}

const toISODate = (value: unknown): string => {
  if (!value && value !== 0) return '9999-12-31'

  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
      }
    } catch {
      return '9999-12-31'
    }
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

const toISODateTime = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}T${String(date.H ?? 0).padStart(2, '0')}:${String(date.M ?? 0).padStart(2, '0')}:${String(date.S ?? 0).padStart(2, '0')}+07:00`
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

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatError(error: any): string {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.'
  if (typeof error === 'string') return error
  if (error?.message) {
    let msg = error.message
    if (error.code) msg += ` (code: ${error.code})`
    if (error.details) msg += `\nDetail: ${error.details}`
    if (error.hint) msg += `\nHint: ${error.hint}`
    return msg
  }
  return JSON.stringify(error)
}

function UploadButtonShell({
  label,
  loading,
  onClick,
  children,
}: {
  label: string
  loading: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 hover:shadow-md active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {loading ? 'Uploading...' : label}
      </button>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAO → PSS Normalization
// Runs entirely in the browser before data is sent to the server.
// Strategy: for each row where document_no starts with "PAO", look for a
// PSS in the same project, branch, and location. Prefer the PSS with the same
// document_created_at / document date time; if no exact match exists, use the
// closest preceding PSS within that context.
// ─────────────────────────────────────────────────────────────────────────────

// Pemetaan PAO → PSS dipakai bersama dengan scripts/nav-sync (lib/nav-import/map.ts).
export { normalizePaoToPss }
const isPss = (value: string) => value.trim().toUpperCase().startsWith('PSS')

// ─────────────────────────────────────────────────────────────────────────────
// Outbound Header Upload Button
// ─────────────────────────────────────────────────────────────────────────────

// Pemetaan PSS Header dipakai bersama dengan scripts/nav-sync (lib/nav-import/map.ts).
const mapHeaderRow = (raw: Record<string, any>, fileName: string) => mapPssHeaderRow(raw, fileName)

export function OutboundHeaderUploadButton() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    uploadProgress.start(file.name)

    try {
      await loadXlsx()
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      uploadProgress.stage('validate')
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

      if (!rows.length) throw new Error('File kosong.')

      const cleanRows = rows
        .map((r) => mapHeaderRow(r, file.name))
        .filter((r) => r.pss_no)

      if (!cleanRows.length)
        throw new Error('Tidak ada baris valid. Pastikan kolom PSS No. / Document No. terisi.')

      // Gunakan shipment_no sebagai key (kolom yang punya unique constraint di DB)
      const shipmentNos = cleanRows.map((r) => String(r.shipment_no ?? r.pss_no ?? '').trim()).filter(Boolean)
      const { data: existing } = await getExistingOutboundHeaderPssNos(shipmentNos)
      // Bangun set dari KEDUA kolom supaya tidak ada yang lolos
      const existingSet = new Set<string>()
      for (const r of existing ?? []) {
        if (r.shipment_no) existingSet.add(String(r.shipment_no).trim())
        if (r.pss_no) existingSet.add(String(r.pss_no).trim())
      }

      const seen = new Set<string>()
      const toInsert = cleanRows.filter((row) => {
        const key = String(row.shipment_no ?? row.pss_no ?? '').trim()
        if (!key || existingSet.has(key) || seen.has(key)) return false
        seen.add(key)
        return true
      })

      const skipped = cleanRows.length - toInsert.length
      if (!toInsert.length)
        throw new Error(`Semua ${shipmentNos.length} PSS No. sudah ada di database atau duplikat dalam file.`)

      uploadProgress.stage('save')
      const result = await insertOutboundHeaderRows(toInsert)
      const dbSkipped = (result as any).skipped ?? 0
      const totalSkipped = skipped + dbSkipped
      await uploadResult({
        icon: 'success',
        title: 'Upload Berhasil',
        text: `${toInsert.length - dbSkipped} PSS Header berhasil ditambahkan${totalSkipped ? `, ${totalSkipped} dilewati (sudah ada)` : ''}.`,
        confirmButtonColor: '#1F3F6E',
      })
      router.refresh()
    } catch (error: any) {
      await uploadResult({
        icon: 'error',
        title: 'Upload Gagal',
        text: formatError(error),
        confirmButtonColor: '#1F3F6E',
      })
    } finally {
      setLoading(false)
      uploadProgress.ensureClosed()
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <UploadButtonShell
      label="Upload PSS Header"
      loading={loading}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={handleFileSelect}
      />
    </UploadButtonShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Outbound Detail Upload Button (ILE)
// Includes PAO → PSS normalization before inserting to DB
// ─────────────────────────────────────────────────────────────────────────────

const DETAIL_ALLOWED_FIELDS = [
  'outbound_header_id',
  'posting_date',
  'document_created_at',
  'entry_type',
  'document_no',
  'item_no',
  'description',
  'branch_representative',
  'project',
  'location_code',
  'lot_no',
  'expiration_date',
  'quantity',
  'qty_out',
  'entry_no',
  'source_file',
  'import_period',
  'created_at',
  'updated_at',
] as const

const mapDetailRow = (raw: Record<string, any>, fileName: string) => {
  const row = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
  )
  const now = new Date().toISOString()
  const documentDateValue = pickValue(row, ['document_date', 'doc_date', 'order_date'])
  const documentDate = documentDateValue ? toISODate(documentDateValue) : null
  const documentCreatedAt = toISODateTime(pickValue(row, ['document_data_time', 'document_date_time', 'document_created_date_time', 'document_created_datetime', 'document_created_at', 'created_date']))

  const record: Record<string, any> = {
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])) || now.slice(0, 10),
    document_created_at: documentCreatedAt ?? (documentDate ? `${documentDate}T00:00:00+07:00` : null),
    entry_type: pickValue(row, ['entry_type']) ?? null,
    document_no: pickValue(row, ['document_no', 'doc_no', 'no']) ?? null,
    item_no: pickValue(row, ['item_no', 'sku', 'item']) ?? null,
    description: pickValue(row, ['description', 'item_name', 'desc']) ?? null,
    branch_representative: pickValue(row, ['cabang_perwakilan', 'branch_representative', 'branch', 'cabang']) ?? null,
    project: pickValue(row, ['project']) ?? null,
    location_code: pickValue(row, ['location_code', 'location', 'loc']) ?? null,
    lot_no: pickValue(row, ['lot_no', 'lot_no_', 'lot']) ?? null,
    expiration_date: toISODate(pickValue(row, ['expiration_date', 'expiry_date', 'exp_date', 'lot_expiration_date'])) || null,
    quantity: toNumber(pickValue(row, ['quantity', 'qty'])),
    qty_out: toNumber(pickValue(row, ['qty_out', 'qty_sold', 'quantity_sold'])),
    entry_no: toNumber(pickValue(row, ['entry_no'])),
    source_file: fileName,
    import_period: now.slice(0, 7),
    created_at: now,
    updated_at: now,
  }

  const sanitized: Record<string, any> = {}
  for (const field of DETAIL_ALLOWED_FIELDS) {
    const value = record[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      sanitized[field] = value
    }
  }
  return sanitized
}

export function OutboundDetailUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    uploadProgress.start(file.name)

    try {
      await loadXlsx()
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      uploadProgress.stage('validate')
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

      if (!rows.length) throw new Error('File kosong.')

      // --- Filter hanya Posted Assembly dan Sales Shipment ---
      const filteredRows = rows.filter((raw) => {
        const row = Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
        )
        const docType = pickValue(row, ['document_type', 'document type'])
        if (!docType) return false
        const normalized = normalizeKey(String(docType))
        return normalized === normalizeKey('Posted Assembly') || normalized === normalizeKey('Sales Shipment')
      })

      if (!filteredRows.length) {
        throw new Error(
          'Tidak ada baris dengan Document Type = "Posted Assembly" atau "Sales Shipment". ' +
          'File ini hanya akan memproses Posted Assembly dan Sales Shipment.'
        )
      }

      // Tampilkan status progress — simulasi bulk processing (opsional: progress nyata per baris)
      const totalToProcess = filteredRows.length
      let processed = 0
      const updateProgress = () => {
        processed++
        // Tampilkan status loading? Ini akan terlalu sering trigger UI update → pertimbangkan interval
      }

      // Step 1: Map semua baris (tambahkan progress per batch)
      const mappedRows = filteredRows
        .map((r) => {
          const mapped = mapDetailRow(r, file.name)
          updateProgress()
          return mapped
        })
        .filter((r) => r.document_no)

      if (!mappedRows.length)
        throw new Error('Tidak ada baris valid. Pastikan kolom Document No. terisi.')

      // Step 2: Normalisasi PAO → PSS (client-side, sebelum kirim ke DB)
      const { data: matchingHeaders, error: matchingHeadersError } = await getOutboundHeadersForPaoMatching()
      if (matchingHeadersError) throw matchingHeadersError
      const { normalized, remappedCount, unmappedPaos } = normalizePaoToPss(mappedRows, matchingHeaders ?? [])

      // Apply hasil normalisasi kembali ke rows
      const normalizedRows = mappedRows.map((row, i) => ({
        ...row,
        document_no: normalized[i],
      }))

      // Peringatan jika ada PAO yang tidak bisa di-remap
      if (unmappedPaos.length > 0) {
        console.warn('PAO tidak bisa di-remap (tidak ada PSS dalam konteks yang sama):', unmappedPaos)
        notify.info('Peringatan normalisasi', `PAO yang tidak dapat dipetakan: ${unmappedPaos.join(', ')}`)
      }

      // Step 3: Cari PSS yang unik untuk link ke outbound_header
      const uniquePssNos = [...new Set(normalized.filter((d) => isPss(d)))]

      const { data: headers, error: headersError } = await getOutboundHeadersByPssNos(uniquePssNos)
      if (headersError) {
        throw new Error(`Gagal mengambil header PSS untuk pencocokan: ${formatError(headersError)}`)
      }
      const headerMap = new Map<string, number>()
      for (const h of (headers ?? []) as any[]) {
        const id = Number(h.id)
        if (h.pss_no) headerMap.set(String(h.pss_no).trim(), id)
        if (h.shipment_no) headerMap.set(String(h.shipment_no).trim(), id)
      }

      // Step 4: Tambahkan outbound_header_id — null kalau tidak ketemu (FK allow null)
      const rowsWithHeaderId: Record<string, any>[] = normalizedRows.map((row) => ({
        ...row,
        outbound_header_id: headerMap.get(String(row.document_no).trim()) ?? null,
      }))

      const unmatchedHeaderPss = [...new Set(
        rowsWithHeaderId
          .filter((row) => row.outbound_header_id == null)
          .map((row) => String(row.document_no ?? '').trim())
          .filter(Boolean)
      )]

      if (unmappedPaos.length > 0) {
        throw new Error(`Upload dibatalkan. PAO tidak dapat dipetakan ke PSS pada Document Data Time yang sama: ${[...new Set(unmappedPaos)].join(', ')}`)
      }
      if (unmatchedHeaderPss.length > 0) {
        throw new Error(`Upload dibatalkan. PSS tidak memiliki header yang cocok di database: ${unmatchedHeaderPss.join(', ')}`)
      }

      uploadProgress.stage('save')
      let documentLinksUpdated = 0
      let timestampsBackfilled = 0
      let headersUpdated = 0
      const maintenanceWarnings: string[] = []

      try {
        const result = await updateOutboundDetailDocumentLinks(rowsWithHeaderId)
        documentLinksUpdated = result.updated
      } catch (error) {
        const message = formatError(error)
        console.warn(`Link detail Outbound tidak diperbarui: ${message}`)
        maintenanceWarnings.push(`Link detail tidak diperbarui: ${message}`)
      }

      // File yang di-upload ulang juga melengkapi timestamp NAV pada detail lama.
      try {
        const result = await updateOutboundDetailCreatedTimes(rowsWithHeaderId)
        timestampsBackfilled = result.updated
      } catch (error) {
        const message = formatError(error)
        console.warn(`Timestamp detail Outbound tidak diperbarui: ${message}`)
        maintenanceWarnings.push(`Timestamp detail tidak diperbarui: ${message}`)
      }

      // Propagate the NAV document creation time to the matching PSS header.
      try {
        const result = await updateOutboundHeaderCreatedTimes(rowsWithHeaderId)
        headersUpdated = result.updated
      } catch (error) {
        const message = formatError(error)
        console.warn(`Timestamp header PSS tidak diperbarui: ${message}`)
        maintenanceWarnings.push(`Timestamp header PSS tidak diperbarui: ${message}`)
      }

      // --- Langkah 7: Insert sekaligus via SQL RPC (batch 1000 baris per request) ---
      const BATCH_SIZE = 1000
      let totalInserted = 0
      let totalSkipped = 0
      for (let i = 0; i < rowsWithHeaderId.length; i += BATCH_SIZE) {
        const batch = rowsWithHeaderId.slice(i, i + BATCH_SIZE)
        const { inserted } = await rpcBulkInsertOutboundDetail(batch)
        totalInserted += inserted ?? 0
      }
      totalSkipped = rowsWithHeaderId.length - totalInserted

      if (totalInserted === 0) {
              await uploadResult({
                icon: 'info',
                title: 'Tidak Ada Data Baru',
                text: `${rowsWithHeaderId.length} baris sudah ada di database.${documentLinksUpdated ? ` ${documentLinksUpdated} relasi detail PSS diperbaiki.` : ''}${timestampsBackfilled ? ` ${timestampsBackfilled} timestamp detail dilengkapi.` : ''}${headersUpdated ? ` ${headersUpdated} header diperbarui.` : ''}${maintenanceWarnings.length ? `\n\nPeringatan:\n${maintenanceWarnings.join('\n')}` : ''}`,
                confirmButtonColor: '#1F3F6E',
              })
              return
            }

      // Verifikasi akhir: setiap header yang terdampak harus memiliki detail.
      const affectedHeaderIds = [...new Set(
        rowsWithHeaderId
          .map((row) => Number(row.outbound_header_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )]
      const { data: detailLinks, error: detailLinksError } = await getOutboundDetailHeaderIds(affectedHeaderIds)
      if (detailLinksError) throw detailLinksError
      const detailHeaderIds = new Set(
        (detailLinks ?? []).map((row: any) => Number(row.outbound_header_id))
      )
      const headersWithoutDetail = affectedHeaderIds.filter((id) => !detailHeaderIds.has(id))
      if (headersWithoutDetail.length > 0) {
        throw new Error(`Verifikasi gagal. Header/PSS berikut tidak mempunyai detail: ${headersWithoutDetail.join(', ')}`)
      }

      const remapNote = remappedCount > 0 ? ` (${remappedCount} nomor PAO diremap ke PSS)` : ''

      await uploadResult({
        icon: 'success',
        title: 'Upload Berhasil',
        text: `${totalInserted} baris berhasil ditambahkan${totalSkipped ? `, ${totalSkipped} dilewati` : ''}.${documentLinksUpdated ? ` ${documentLinksUpdated} relasi detail PSS diperbaiki.` : ''}${timestampsBackfilled ? ` ${timestampsBackfilled} timestamp detail lama dilengkapi.` : ''}${headersUpdated ? ` ${headersUpdated} header diperbarui.` : ''}${remapNote}${maintenanceWarnings.length ? `\n\nPeringatan:\n${maintenanceWarnings.join('\n')}` : ''}`,
        confirmButtonColor: '#1F3F6E',
      })
    } catch (error: any) {
      await uploadResult({
        icon: 'error',
        title: 'Upload Gagal',
        text: formatError(error),
        confirmButtonColor: '#1F3F6E',
      })
    } finally {
      setLoading(false)
      uploadProgress.ensureClosed()
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <UploadButtonShell
      label="Upload Outbound Detail"
      loading={loading}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={handleFileSelect}
      />
    </UploadButtonShell>
  )
}
