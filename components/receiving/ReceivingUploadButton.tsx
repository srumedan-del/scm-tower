'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileUp, Loader2 } from 'lucide-react'
import { ReactNode } from 'react'
import { getExistingReceivingHeaderPtrs, insertReceivingHeaderRows, getReceivingHeadersByPtrs, getExistingReceivingDetailKeys, insertReceivingDetailRows } from '@/app/(app)/receiving/actions'
import { Modal } from '@/components/ui/Modal'

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const RECEIVING_HEADER_FIELDS = [
  'ptr_no',
  'transfer_order_no',
  'transfer_from_code',
  'transfer_to_code',
  'posting_date',
  'shipment_date',
  'receipt_date',
  'shipping_agent_code',
  'ship_to_receipt_days',
  'receipt_to_posting_days',
  'ship_to_posting_days',
  'source_file',
  'import_period',
  'created_at',
  'updated_at',
] as const

const toAllowedHeaderRow = (row: Record<string, any>) => {
  const sanitized: Record<string, any> = {}

  for (const field of RECEIVING_HEADER_FIELDS) {
    const value = row[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      sanitized[field] = value
    }
  }

  return sanitized
}

const pickValue = (row: Record<string, any>, aliases: string[]) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find((k) => normalizeKey(k) === normalizeKey(alias))
    if (key && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') {
      return row[key]
    }
  }
  return null
}

const toISODate = (value: unknown) => {
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
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }

    return trimmed
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return '9999-12-31'
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const mapRow = (raw: Record<string, any>) => {
  const row = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
  )

  const record: Record<string, any> = {
    ptr_no: pickValue(row, ['ptr_no', 'ptr', 'no', 'document_no', 'ptr_no_1']) ?? null,
    transfer_order_no: pickValue(row, ['transfer_order_no', 'transfer_order', 'transfer_order_no_1']) ?? null,
    transfer_from_code: pickValue(row, ['transfer_from_code', 'from_code', 'transfer_from', 'from_warehouse']) ?? null,
    transfer_to_code: pickValue(row, ['transfer_to_code', 'to_code', 'transfer_to', 'to_warehouse']) ?? null,
    shipping_agent_code: pickValue(row, ['shipping_agent_code', 'shipping_agent', 'agent_code', 'ship_agent']) ?? null,
    shipment_date: toISODate(pickValue(row, ['shipment_date', 'ship_date', 'delivery_date', 'shipment_dt'])),
    receipt_date: toISODate(pickValue(row, ['receipt_date', 'received_date', 'date_of_receipt', 'posting_date'])),
    ship_to_receipt_days: toNumber(pickValue(row, ['ship_to_receipt_days', 'lead_time_days', 'lead_time'])),
    receipt_to_posting_days: toNumber(pickValue(row, ['receipt_to_posting_days', 'r_p_days', 'posting_days'])),
    ship_to_posting_days: toNumber(pickValue(row, ['ship_to_posting_days', 'ship_to_posting_days_1'])),
  }

  const filtered = Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== '')
  )

  return toAllowedHeaderRow(filtered)
}

const validateRows = (rows: Record<string, any>[]) => {
  const issues: string[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    if (!row.ptr_no) {
      issues.push(`Baris ${rowNumber}: ptr_no wajib diisi`)
    }
    if (!row.receipt_date) {
      issues.push(`Baris ${rowNumber}: receipt_date wajib diisi`)
    }
    if (!row.transfer_from_code) {
      issues.push(`Baris ${rowNumber}: transfer_from_code wajib diisi`)
    }
    if (!row.transfer_to_code) {
      issues.push(`Baris ${rowNumber}: transfer_to_code wajib diisi`)
    }
  })

  return issues
}

function getDuplicateSafeRows(rows: Record<string, any>[]) {
  const seen = new Set<string>()
  const result: Record<string, any>[] = []

  for (const row of rows) {
    const ptr = String(row.ptr_no ?? row.document_no ?? '').trim()
    if (!ptr) continue
    if (seen.has(ptr)) continue
    seen.add(ptr)
    result.push(row)
  }

  return result
}

function detailKey(row: Record<string, any>): string {
  return [
    String(row.document_no ?? '').trim(),
    String(row.item_no ?? '').trim(),
    String(row.variant_code ?? '').trim(),
    String(row.lot_no ?? '').trim(),
    String(row.serial_no ?? '').trim(),
  ].join('|')
}

function formatError(error: any): string {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.'

  if (typeof error === 'string') return error

  if (error?.message && typeof error.message === 'string') {
    let msg = error.message
    if (error.code) msg += ` (code: ${error.code})`
    if (error.details) msg += `\nDetail: ${error.details}`
    if (error.hint) msg += `\nHint: ${error.hint}`
    return msg
  }

  if (error?.code) {
    let msg = error.message ?? error.error_description ?? 'Error'
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

  const showAlert = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ type, title, message })
  }

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
  const colorClasses = color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'

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

export function PtrHeaderUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const { alert, showAlert, closeAlert } = useAlert()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    closeAlert()

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

      if (!rows.length) throw new Error('File kosong.')

      const cleanRows = rows.map((raw) => {
        const row = Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
        ) as Record<string, any>
        return toAllowedHeaderRow({
          ptr_no: pickValue(row, ['ptr_no', 'ptr', 'no', 'document_no', 'ptr_no_1']) ?? null,
          transfer_order_no: pickValue(row, ['transfer_order_no', 'transfer_order', 'transfer_order_no_1']) ?? null,
          transfer_from_code: pickValue(row, ['transfer_from_code', 'from_code', 'transfer_from', 'from_warehouse']) ?? null,
          transfer_to_code: pickValue(row, ['transfer_to_code', 'to_code', 'transfer_to', 'to_warehouse']) ?? null,
          posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date', 'receipt_date', 'received_date'])),
          shipment_date: toISODate(pickValue(row, ['shipment_date', 'ship_date', 'delivery_date', 'shipment_dt'])),
          receipt_date: toISODate(pickValue(row, ['receipt_date', 'received_date', 'date_of_receipt', 'posting_date'])),
          shipping_agent_code: pickValue(row, ['shipping_agent_code', 'shipping_agent', 'agent_code', 'ship_agent']) ?? null,
          ship_to_receipt_days: toNumber(pickValue(row, ['ship_to_receipt_days', 'lead_time_days', 'lead_time'])),
          receipt_to_posting_days: toNumber(pickValue(row, ['receipt_to_posting_days', 'r_p_days', 'posting_days'])),
          ship_to_posting_days: toNumber(pickValue(row, ['ship_to_posting_days', 'ship_to_posting_days_1'])),
          source_file: file.name.trim(),
          import_period: new Date().toISOString().slice(0, 7),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }).filter((r) => r.ptr_no)

      const issues = validateRows(cleanRows)
      if (issues.length > 0) {
        throw new Error(`Validasi gagal:\n${issues.join('\n')}`)
      }

      if (!cleanRows.length) throw new Error('Tidak ada baris valid. Pastikan kolom No. (PTR) terisi.')

      const ptrs = cleanRows.map((r) => String(r.ptr_no ?? '').trim()).filter(Boolean)
      const { data: existing } = await getExistingReceivingHeaderPtrs(ptrs)
      const existingSet = new Set((existing ?? []).map((r: any) => String(r.ptr_no ?? '').trim()))

      const seen = new Set<string>()
      const toInsert = cleanRows.filter((row) => {
        const ptr = String(row.ptr_no ?? '').trim()
        if (!ptr || existingSet.has(ptr) || seen.has(ptr)) return false
        seen.add(ptr)
        return true
      })

      if (!toInsert.length) throw new Error(`${ptrs.length} PTR sudah ada di database atau duplikat.`)

      await insertReceivingHeaderRows(toInsert)
      const skipped = cleanRows.length - toInsert.length
      showAlert(
        'success',
        'Upload Berhasil',
        `${toInsert.length} PTR berhasil ditambahkan${skipped ? `, ${skipped} dilewati` : ''}.`
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
      label="Upload PTR Header"
      loading={loading}
      onClick={() => inputRef.current?.click()}
      alert={alert}
      closeAlert={closeAlert}
      color="indigo"
    >
      <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
    </UploadButtonShell>
  )
}

/* ── PTR Detail Upload Button ─────────────────────────── */

const DETAIL_ALLOWED_FIELDS = [
  'receiving_header_id', 'posting_date', 'entry_type', 'document_type',
  'document_no', 'document_line_no', 'item_no', 'variant_code', 'description',
  'document_created_at', 'branch_representative', 'project', 'return_reason_code',
  'location_code', 'lot_no', 'expiration_date', 'serial_no', 'quantity',
  'invoiced_quantity', 'remaining_quantity', 'shipped_qty_not_returned',
  'reserved_quantity', 'open', 'order_type', 'entry_no',
  'source_file', 'import_period', 'created_at', 'updated_at',
] as const

const mapDetailRow = (raw: Record<string, any>, fileName: string) => {
  const row = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
  )

  const now = new Date().toISOString()
  const record: Record<string, any> = {
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])),
    entry_type: pickValue(row, ['entry_type']) ?? null,
    document_type: pickValue(row, ['document_type']) ?? null,
    document_no: pickValue(row, ['document_no', 'doc_no', 'ptr_no', 'no', 'document_no_1']) ?? null,
    document_line_no: toNumber(pickValue(row, ['document_line_no', 'line_no', 'doc_line_no'])),
    item_no: pickValue(row, ['item_no', 'sku', 'item_no_1', 'item_no_no']) ?? null,
    variant_code: pickValue(row, ['variant_code']) ?? null,
    description: pickValue(row, ['description', 'item_name', 'desc']) ?? null,
    document_created_at: toISODate(pickValue(row, ['document_created_datetime', 'document_created_date_time', 'created_date'])),
    branch_representative: pickValue(row, ['cabang_perwakilan', 'branch_representative', 'branch', 'cabang']) ?? null,
    project: pickValue(row, ['project']) ?? null,
    return_reason_code: pickValue(row, ['return_reason_code']) ?? null,
    location_code: pickValue(row, ['location_code', 'location', 'loc']) ?? null,
    lot_no: pickValue(row, ['lot_no', 'lot']) ?? null,
    expiration_date: toISODate(pickValue(row, ['expiration_date', 'expiry_date', 'exp_date'])) || '9999-12-31',
    serial_no: pickValue(row, ['serial_no', 'serial']) ?? null,
    quantity: toNumber(pickValue(row, ['quantity', 'qty'])),
    invoiced_quantity: toNumber(pickValue(row, ['invoiced_quantity', 'invoiced_qty'])),
    remaining_quantity: toNumber(pickValue(row, ['remaining_quantity', 'remaining_qty'])),
    shipped_qty_not_returned: toNumber(pickValue(row, ['shipped_qty_not_returned', 'shipped_not_returned'])),
    reserved_quantity: toNumber(pickValue(row, ['reserved_quantity', 'reserved_qty'])),
    open: pickValue(row, ['open']) ?? null,
    order_type: pickValue(row, ['order_type']) ?? null,
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

export function PtrDetailUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const { alert, showAlert, closeAlert } = useAlert()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    closeAlert()

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

      if (!rows.length) throw new Error('File kosong.')

      const mappedRows = rows.map((r) => mapDetailRow(r, file.name)).filter((r) => r.document_no)

      if (!mappedRows.length) throw new Error('Tidak ada baris valid. Pastikan kolom Document No. terisi.')

      const docNos = [...new Set(mappedRows.map((r) => String(r.document_no).trim()))]
      const { data: headers } = await getReceivingHeadersByPtrs(docNos)

      if (!headers?.length) {
        throw new Error(`Tidak ada PTR Header ditemukan untuk document_no: ${docNos.slice(0, 5).join(', ')}${docNos.length > 5 ? '...' : ''}. Upload PTR Header terlebih dahulu.`)
      }

      const headerMap = new Map<string, string>()
      for (const h of headers as any[]) {
        headerMap.set(String(h.ptr_no).trim(), h.id)
      }

      const rowsWithHeaderId = mappedRows.map((row) => {
        const ptrNo = String(row.document_no).trim()
        return {
          ...row,
          receiving_header_id: headerMap.get(ptrNo) ?? null,
        }
      }).filter((r) => r.receiving_header_id)

      const skippedCount = mappedRows.length - rowsWithHeaderId.length
      if (!rowsWithHeaderId.length) {
        throw new Error('Tidak ada baris yang bisa di-link ke PTR Header.')
      }

      const existingDetailKeys = new Set<string>()
      try {
        const { data: existingDetails } = await getExistingReceivingDetailKeys(docNos)
        for (const row of existingDetails ?? []) {
          existingDetailKeys.add(detailKey(row))
        }
      } catch {
        // ignore — proceed to insert; if unique constraint hits, error will show in modal
      }

      const seenDetailKeys = new Set<string>()
      const toInsertDetails = rowsWithHeaderId.filter((row) => {
        const key = detailKey(row)
        if (existingDetailKeys.has(key) || seenDetailKeys.has(key)) return false
        seenDetailKeys.add(key)
        return true
      })

      const detailInsertedCount = toInsertDetails.length
      const detailSkippedCount = rowsWithHeaderId.length - toInsertDetails.length

      if (!toInsertDetails.length) {
        showAlert('info', 'Tidak Ada Data Baru', `${rowsWithHeaderId.length} baris detail sudah ada di database.`)
        return
      }

      await insertReceivingDetailRows(toInsertDetails)
      showAlert(
        'success',
        'Upload Berhasil',
        `${detailInsertedCount} baris detail berhasil ditambahkan${detailSkippedCount ? `, ${detailSkippedCount} dilewati (sudah ada)` : ''}.`
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
      label="Upload PTR Detail"
      loading={loading}
      onClick={() => inputRef.current?.click()}
      alert={alert}
      closeAlert={closeAlert}
      color="emerald"
    >
      <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
    </UploadButtonShell>
  )
}

export default function ReceivingUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const { alert, showAlert, closeAlert } = useAlert()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    closeAlert()

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

      if (!rows.length) throw new Error('File kosong.')

      const cleanRows = rows.map((raw) => {
        const row = Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
        ) as Record<string, any>
        return toAllowedHeaderRow({
          ptr_no: pickValue(row, ['ptr_no', 'ptr', 'no', 'document_no', 'ptr_no_1']) ?? null,
          transfer_order_no: pickValue(row, ['transfer_order_no', 'transfer_order', 'transfer_order_no_1']) ?? null,
          transfer_from_code: pickValue(row, ['transfer_from_code', 'from_code', 'transfer_from', 'from_warehouse']) ?? null,
          transfer_to_code: pickValue(row, ['transfer_to_code', 'to_code', 'transfer_to', 'to_warehouse']) ?? null,
          posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date', 'receipt_date', 'received_date'])),
          shipment_date: toISODate(pickValue(row, ['shipment_date', 'ship_date', 'delivery_date', 'shipment_dt'])),
          receipt_date: toISODate(pickValue(row, ['receipt_date', 'received_date', 'date_of_receipt', 'posting_date'])),
          shipping_agent_code: pickValue(row, ['shipping_agent_code', 'shipping_agent', 'agent_code', 'ship_agent']) ?? null,
          ship_to_receipt_days: toNumber(pickValue(row, ['ship_to_receipt_days', 'lead_time_days', 'lead_time'])),
          receipt_to_posting_days: toNumber(pickValue(row, ['receipt_to_posting_days', 'r_p_days', 'posting_days'])),
          ship_to_posting_days: toNumber(pickValue(row, ['ship_to_posting_days', 'ship_to_posting_days_1'])),
          source_file: file.name.trim(),
          import_period: new Date().toISOString().slice(0, 7),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }).filter((r) => r.ptr_no)

      if (!cleanRows.length) throw new Error('Tidak ada baris valid. Pastikan kolom No. (PTR) terisi.')

      const ptrs = cleanRows.map((r) => String(r.ptr_no ?? '').trim()).filter(Boolean)
      const { data: existing } = await getExistingReceivingHeaderPtrs(ptrs)
      const existingSet = new Set((existing ?? []).map((r: any) => String(r.ptr_no ?? '').trim()))

      const seen = new Set<string>()
      const toInsert = cleanRows.filter((row) => {
        const ptr = String(row.ptr_no ?? '').trim()
        if (!ptr || existingSet.has(ptr) || seen.has(ptr)) return false
        seen.add(ptr)
        return true
      })

      if (!toInsert.length) throw new Error(`${ptrs.length} PTR sudah ada di database atau duplikat.`)

      await insertReceivingHeaderRows(toInsert)
      const skipped = cleanRows.length - toInsert.length
      showAlert(
        'success',
        'Upload Berhasil',
        `${toInsert.length} PTR berhasil ditambahkan${skipped ? `, ${skipped} dilewati` : ''}.`
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
      label="Upload PTR Header"
      loading={loading}
      onClick={() => inputRef.current?.click()}
      alert={alert}
      closeAlert={closeAlert}
      color="indigo"
    >
      <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
    </UploadButtonShell>
  )
}
