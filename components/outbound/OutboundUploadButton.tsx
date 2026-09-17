'use client'

import { useRef, useState } from 'react'
import type * as XLSXModule from 'xlsx'
import { FileUp, Loader2 } from 'lucide-react'
import { ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal'
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

type AlertState = { type: 'success' | 'error' | 'info'; title: string; message: string } | null

function useAlert() {
  const [alert, setAlert] = useState<AlertState>(null)
  const showAlert = (type: 'success' | 'error' | 'info', title: string, message: string) =>
    setAlert({ type, title, message })
  const closeAlert = () => setAlert(null)
  return { alert, showAlert, closeAlert }
}

function UploadButtonShell({
  label,
  loading,
  onClick,
  alert,
  closeAlert,
  color = 'indigo',
  children,
}: {
  label: string
  loading: boolean
  onClick: () => void
  alert: AlertState
  closeAlert: () => void
  color?: 'indigo' | 'emerald'
  children: ReactNode
}) {
  const colorClasses =
    color === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : 'bg-indigo-600 hover:bg-indigo-500'

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${colorClasses}`}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {loading ? 'Uploading...' : label}
      </button>

      <Modal
        isOpen={!!alert}
        onClose={closeAlert}
        type={alert?.type ?? 'info'}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
      />
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

const PSS_PREFIXES = ['PSS']
const PAO_PREFIXES = ['PAO']

function isPss(val: string): boolean {
  const v = val.trim().toUpperCase()
  return PSS_PREFIXES.some((p) => v.startsWith(p))
}

function isPao(val: string): boolean {
  const v = val.trim().toUpperCase()
  return PAO_PREFIXES.some((p) => v.startsWith(p))
}

function normalizeDocumentTime(value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const date = new Date(hasTimezone ? raw : `${raw}+07:00`)
  if (Number.isNaN(date.getTime())) return raw
  return new Date(Math.floor(date.getTime() / 60000) * 60000).toISOString()
}

function normalizePaoToPss(
  rows: Record<string, any>[],
  existingHeaders: Record<string, any>[] = []
): { normalized: string[]; remappedCount: number; unmappedPaos: string[] } {
  const result = rows.map((row) => String(row.document_no ?? '').trim())
  let remappedCount = 0
  const unmappedPaos: string[] = []

  const contextFor = (row: Record<string, any>) => [
    row.project,
    row.branch_representative,
    row.location_code,
  ].map((value) => String(value ?? '').trim()).join('\u001f')

  const contextMatches = (detailRow: Record<string, any>, header: Record<string, any>) => {
    const requiredFields = ['project', 'location_code']
    const optionalFields = ['branch_representative']
    const matches = (field: string, headerRequired: boolean) => {
      const detailValue = String(detailRow[field] ?? '').trim().toUpperCase()
      const headerValue = String(header[field] ?? '').trim().toUpperCase()
      if (!detailValue || !headerValue) return !headerRequired
      return detailValue === headerValue
    }

    return requiredFields.every((field) => matches(field, true))
      && optionalFields.every((field) => matches(field, false))
  }

  const pssByContext = new Map<string, { index: number; documentNo: string; documentTime: string | null }[]>()
  rows.forEach((row, index) => {
    const documentNo = result[index]
    if (!isPss(documentNo)) return
    const context = contextFor(row)
    const candidates = pssByContext.get(context) ?? []
    candidates.push({
      index,
      documentNo,
      documentTime: normalizeDocumentTime(row.document_created_at ?? row.document_date ?? null),
    })
    pssByContext.set(context, candidates)
  })

  existingHeaders.forEach((header) => {
    const documentNo = String(header.pss_no ?? header.shipment_no ?? '').trim()
    if (!isPss(documentNo)) return
    rows.forEach((row, index) => {
      if (!contextMatches(row, header)) return
      const context = contextFor(row)
      const candidates = pssByContext.get(context) ?? []
      candidates.push({
        index: Number.MAX_SAFE_INTEGER,
        documentNo,
        documentTime: normalizeDocumentTime(header.document_created_at ?? header.document_date ?? null),
      })
      pssByContext.set(context, candidates)
    })
  })

  for (let i = 0; i < result.length; i++) {
    if (!isPao(result[i])) continue

    const currentRow = rows[i]
    const currentTime = normalizeDocumentTime(currentRow.document_created_at ?? currentRow.document_date ?? null)
    const candidates = pssByContext.get(contextFor(currentRow)) ?? []

    const sameTime = candidates.filter((candidate) => {
      const candidateTime = candidate.documentTime
      return candidateTime && currentTime && candidateTime === currentTime
    })

    const replacement = sameTime.length > 0
      ? sameTime[sameTime.length - 1].documentNo
      : currentTime || candidates.some((candidate) => candidate.documentTime)
        ? null
        : (() => {
            const preceding = candidates.filter((candidate) => candidate.index <= i)
            return preceding.length > 0
              ? preceding[preceding.length - 1].documentNo
              : candidates[0]?.documentNo ?? null
          })()

    if (replacement) {
      result[i] = replacement
      remappedCount++
    } else {
      unmappedPaos.push(result[i])
    }
  }

  return { normalized: result, remappedCount, unmappedPaos }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outbound Header Upload Button
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_ALLOWED_FIELDS = [
  'pss_no',
  'shipment_no',
  'psi_no',
  'posting_date',
  'document_created_at',
  'document_date',
  'document_type',
  'location_code',
  'branch_representative',
  'project',
  'order_no',
  'customer_no',
  'customer_name',
  'ship_to_city',
  'cust_receipt_date',
  'promised_delivery_date',
  'shipping_agent_code',
  'currency_code',
  'no_printed',
  'package_tracking_no',
  'source_file',
  'import_period',
  'created_at',
  'updated_at',
] as const

const mapHeaderRow = (raw: Record<string, any>, fileName: string) => {
  const row = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
  )
  const now = new Date().toISOString()

  const record: Record<string, any> = {
    pss_no: pickValue(row, ['pss_no', 'pss', 'no', 'document_no', 'doc_no', 'shipment_no']) ?? null,
    shipment_no: pickValue(row, ['shipment_no', 'pss_no', 'pss', 'no', 'document_no']) ?? null,
    psi_no: pickValue(row, ['psi_no', 'psi', 'posted_sales_invoice_no', 'invoice_no', 'sales_invoice_no']) ?? null,
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date', 'posting_dt'])),
    document_date: toISODate(pickValue(row, ['document_date', 'doc_date', 'order_date'])),
    document_type: pickValue(row, ['document_type', 'doc_type', 'type']) ?? null,
    location_code: pickValue(row, ['location_code', 'location', 'loc']) ?? null,
    branch_representative: pickValue(row, ['cabang_perwakilan', 'branch_representative', 'branch', 'cabang']) ?? null,
    project: pickValue(row, ['project']) ?? null,
    order_no: pickValue(row, ['order_no', 'sales_order_no', 'so_no', 'sop_no']) ?? null,
    customer_no: pickValue(row, ['customer_no', 'cust_no', 'customer_number', 'sell_to_customer_no']) ?? null,
    customer_name: pickValue(row, ['customer_name', 'cust_name', 'sell_to_customer_name']) ?? null,
    ship_to_city: pickValue(row, ['ship_to_city', 'city', 'kota']) ?? null,
    cust_receipt_date: toISODate(pickValue(row, ['cust_receipt_date', 'receipt_date', 'received_date'])),
    promised_delivery_date: toISODate(pickValue(row, ['promised_delivery_date', 'promised_date', 'due_date'])),
    shipping_agent_code: pickValue(row, ['shipping_agent_code', 'shipping_agent', 'agent_code']) ?? null,
    currency_code: pickValue(row, ['currency_code', 'currency']) ?? null,
    no_printed: pickValue(row, ['no_printed']) ?? null,
    package_tracking_no: pickValue(row, ['package_tracking_no', 'tracking_no', 'tracking']) ?? null,
    source_file: fileName,
    import_period: now.slice(0, 7),
    created_at: now,
    updated_at: now,
  }

  // pss_no fallback: kalau tidak ada kolom pss_no di file, gunakan shipment_no
  if (!record.pss_no && record.shipment_no) record.pss_no = record.shipment_no
  if (!record.shipment_no && record.pss_no) record.shipment_no = record.pss_no

  const sanitized: Record<string, any> = {}
  for (const field of HEADER_ALLOWED_FIELDS) {
    const value = record[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      sanitized[field] = value
    }
  }
  return sanitized
}

export function OutboundHeaderUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const { alert, showAlert, closeAlert } = useAlert()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    closeAlert()

    try {
      await loadXlsx()
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
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

      const result = await insertOutboundHeaderRows(toInsert)
      const dbSkipped = (result as any).skipped ?? 0
      const totalSkipped = skipped + dbSkipped
      showAlert(
        'success',
        'Upload Berhasil',
        `${toInsert.length - dbSkipped} PSS Header berhasil ditambahkan${totalSkipped ? `, ${totalSkipped} dilewati (sudah ada)` : ''}.`
      )
    } catch (error: any) {
      showAlert('error', 'Upload Gagal', formatError(error))
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <UploadButtonShell
      label="Upload PSS Header"
      loading={loading}
      onClick={() => inputRef.current?.click()}
      alert={alert}
      closeAlert={closeAlert}
      color="indigo"
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

  const record: Record<string, any> = {
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])) || now.slice(0, 10),
    document_created_at: toISODateTime(pickValue(row, ['document_date_time', 'document_created_date_time', 'document_created_datetime', 'document_created_at', 'created_date'])),
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
  const { alert, showAlert, closeAlert } = useAlert()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    closeAlert()

    try {
      await loadXlsx()
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

      if (!rows.length) throw new Error('File kosong.')

      // Step 1: Map semua baris
      const mappedRows = rows
        .map((r) => mapDetailRow(r, file.name))
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
      }

      // Step 3: Cari PSS yang unik untuk link ke outbound_header
      const uniquePssNos = [...new Set(normalized.filter((d) => isPss(d)))]

      const { data: headers } = await getOutboundHeadersByPssNos(uniquePssNos)
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

      const { updated: documentLinksUpdated } = await updateOutboundDetailDocumentLinks(rowsWithHeaderId)

      // File yang di-upload ulang juga melengkapi timestamp NAV pada detail lama.
      const { updated: timestampsBackfilled } = await updateOutboundDetailCreatedTimes(rowsWithHeaderId)

      // Propagate the NAV document creation time to the matching PSS header.
      const { updated: headersUpdated } = await updateOutboundHeaderCreatedTimes(rowsWithHeaderId)

      // Step 5: Deduplicate berdasarkan entry_no
      const entryNos = rowsWithHeaderId
        .map((r) => r['entry_no'] as number | null | undefined)
        .filter((n): n is number => n !== null && n !== undefined)

      const existingEntrySet = new Set<number>()
      if (entryNos.length > 0) {
        const { data: existingEntries } = await getExistingOutboundDetailEntryNos(entryNos)
        for (const e of existingEntries ?? []) {
          existingEntrySet.add(Number(e.entry_no))
        }
      }

      const seenEntryNos = new Set<number>()
      const toInsert = rowsWithHeaderId.filter((row) => {
        const entryNo = row['entry_no'] as number | null | undefined
        if (entryNo !== null && entryNo !== undefined) {
          const en = Number(entryNo)
          if (existingEntrySet.has(en) || seenEntryNos.has(en)) return false
          seenEntryNos.add(en)
        }
        return true
      })

      const skipped = rowsWithHeaderId.length - toInsert.length

      if (!toInsert.length) {
        showAlert('info', 'Tidak Ada Data Baru', `${rowsWithHeaderId.length} baris sudah ada di database.${documentLinksUpdated ? ` ${documentLinksUpdated} relasi detail PSS diperbaiki.` : ''}${timestampsBackfilled ? ` ${timestampsBackfilled} timestamp detail dilengkapi.` : ''}${headersUpdated ? ` ${headersUpdated} header diperbarui.` : ''}`)
        return
      }

      await insertOutboundDetailRows(toInsert)

      // Verifikasi akhir: setiap header yang terdampak harus memiliki detail.
      const affectedHeaderIds = [...new Set(
        toInsert
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

      showAlert(
        'success',
        'Upload Berhasil',
        `${toInsert.length} baris berhasil ditambahkan${skipped ? `, ${skipped} dilewati` : ''}.${documentLinksUpdated ? ` ${documentLinksUpdated} relasi detail PSS diperbaiki.` : ''}${timestampsBackfilled ? ` ${timestampsBackfilled} timestamp detail lama dilengkapi.` : ''}${headersUpdated ? ` ${headersUpdated} header diperbarui.` : ''}${remapNote}`
      )
    } catch (error: any) {
      showAlert('error', 'Upload Gagal', formatError(error))
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <UploadButtonShell
      label="Upload Outbound Detail"
      loading={loading}
      onClick={() => inputRef.current?.click()}
      alert={alert}
      closeAlert={closeAlert}
      color="emerald"
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
