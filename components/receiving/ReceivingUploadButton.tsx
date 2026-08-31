'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileUp, Loader2, CheckCircle2, AlertCircle, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

const toISODate = (value: unknown) => {
  if (!value && value !== 0) return null

  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
      }
    } catch {
      return null
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }

    return trimmed
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return null
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
    ptr_no: pickValue(row, ['ptr_no', 'ptr', 'document_no', 'ptr_no_1']) ?? null,
    transfer_order_no: pickValue(row, ['transfer_order_no', 'transfer_order', 'transfer_order_no_1']) ?? null,
    transfer_from_code: pickValue(row, ['transfer_from_code', 'from_code', 'transfer_from', 'from_warehouse']) ?? null,
    transfer_to_code: pickValue(row, ['transfer_to_code', 'to_code', 'transfer_to', 'to_warehouse']) ?? null,
    shipping_agent_code: pickValue(row, ['shipping_agent_code', 'shipping_agent', 'agent_code', 'ship_agent']) ?? null,
    shipment_date: toISODate(pickValue(row, ['shipment_date', 'ship_date', 'delivery_date', 'shipment_dt'])),
    receipt_date: toISODate(pickValue(row, ['receipt_date', 'received_date', 'date_of_receipt', 'posting_date'])),
    ship_to_receipt_days: toNumber(pickValue(row, ['ship_to_receipt_days', 'lead_time_days', 'lead_time'])),
    receipt_to_posting_days: toNumber(pickValue(row, ['receipt_to_posting_days', 'r_p_days', 'posting_days'])),
    ship_to_posting_days: toNumber(pickValue(row, ['ship_to_posting_days', 'ship_to_posting_days_1'])),
    document_no: pickValue(row, ['document_no', 'doc_no']) ?? null,
    source_code: pickValue(row, ['source_code', 'source', 'source_code_1']) ?? null,
    warehouse_code: pickValue(row, ['warehouse_code', 'warehouse']) ?? null,
    vendor_code: pickValue(row, ['vendor_code', 'supplier_code', 'vendor']) ?? null,
    sku_code: pickValue(row, ['sku_code', 'item_code', 'product_code', 'item_no']) ?? null,
    qty: toNumber(pickValue(row, ['qty', 'quantity', 'received_qty', 'inbound_qty'])),
    uom: pickValue(row, ['uom', 'unit', 'unit_of_measure']) ?? null,
    status: pickValue(row, ['status', 'receipt_status']) ?? 'draft',
  }

  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== '')
  )
}

const validateRows = (rows: Record<string, any>[]) => {
  const issues: string[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    if (!row.ptr_no && !row.document_no) {
      issues.push(`Baris ${rowNumber}: ptr_no/document_no wajib diisi`)
    }
    if (!row.receipt_date) {
      issues.push(`Baris ${rowNumber}: receipt_date wajib diisi`)
    }
    if (!row.source_code) {
      issues.push(`Baris ${rowNumber}: source_code wajib diisi`)
    }
    if (!row.sku_code) {
      issues.push(`Baris ${rowNumber}: sku_code wajib diisi`)
    }
    if (!row.qty || Number(row.qty) <= 0) {
      issues.push(`Baris ${rowNumber}: qty harus > 0`)
    }
  })

  return issues
}

export default function ReceivingUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([])
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [pendingUpload, setPendingUpload] = useState(false)

  const resetState = () => {
    setPreviewRows([])
    setValidationIssues([])
    setPendingUpload(false)
  }

  const parseFile = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[]

    if (!rows.length) {
      throw new Error('File tidak berisi data. Pastikan file CSV/XLSX berisi baris data.')
    }

    const cleanRows = rows
      .map(mapRow)
      .filter((row) => Object.keys(row).length > 0)

    if (!cleanRows.length) {
      throw new Error('Tidak ada baris yang bisa dipetakan ke format receiving. Cek header kolom file Anda.')
    }

    const issues = validateRows(cleanRows)

    setPreviewRows(cleanRows.slice(0, 10))
    setValidationIssues(issues)
    setPendingUpload(issues.length === 0)

    if (issues.length) {
      throw new Error(`Validasi gagal. ${issues.slice(0, 5).join(' | ')}`)
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setMessage({ type: 'info', text: 'Membaca file dan memvalidasi data...' })

    try {
      await parseFile(file)
      setMessage({
        type: 'success',
        text: `Preview valid. ${previewRows.length} baris siap diupload. Klik “Lanjut Upload” untuk melanjutkan.`,
      })
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Gagal memvalidasi file receiving.',
      })
    } finally {
      setLoading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const doInsert = async () => {
    if (!previewRows.length) {
      setMessage({ type: 'error', text: 'Belum ada data preview untuk diupload.' })
      return
    }

    setLoading(true)
    setMessage({ type: 'info', text: 'Mengupload data receiving ke database...' })

    try {
      const { error } = await supabase.from('receiving_header').insert(previewRows)
      if (error) throw error

      setMessage({
        type: 'success',
        text: `${previewRows.length} data receiving berhasil ditambahkan.`,
      })
      resetState()
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Gagal mengupload receiving.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={handleUpload}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {loading ? 'Processing...' : 'Upload Receiving'}
        </button>

        {pendingUpload && previewRows.length > 0 && (
          <button
            type="button"
            onClick={doInsert}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            <Eye className="h-4 w-4" />
            Lanjut Upload
          </button>
        )}
      </div>

      {message && (
        <div className={`inline-flex max-w-xl items-start gap-2 rounded-lg border px-3 py-2 text-xs ${message.type === 'success'
          ? 'border-green-200 bg-green-50 text-green-700'
          : message.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-white">
          <div className="border-b bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
            Preview Data ({previewRows.length} baris)
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-2 py-2">PTR</th>
                  <th className="px-2 py-2">Transfer</th>
                  <th className="px-2 py-2">From</th>
                  <th className="px-2 py-2">To</th>
                  <th className="px-2 py-2">Receipt</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Qty</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={`${(row.ptr_no ?? 'row')}-${idx}`} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">{String(row.ptr_no ?? row.document_no ?? '-')}</td>
                    <td className="px-2 py-1.5">{String(row.transfer_order_no ?? '-')}</td>
                    <td className="px-2 py-1.5">{String(row.transfer_from_code ?? '-')}</td>
                    <td className="px-2 py-1.5">{String(row.transfer_to_code ?? '-')}</td>
                    <td className="px-2 py-1.5">{String(row.receipt_date ?? '-')}</td>
                    <td className="px-2 py-1.5">{String(row.sku_code ?? '-')}</td>
                    <td className="px-2 py-1.5">{String(row.qty ?? '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {validationIssues.length > 0 && (
        <div className="w-full max-w-2xl rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <div className="mb-2 font-semibold">Issue validasi yang ditemukan:</div>
          <ul className="list-disc space-y-1 pl-4">
            {validationIssues.slice(0, 10).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
