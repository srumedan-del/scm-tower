/**
 * Pemetaan baris ekspor NAV ke kolom tabel SCM Tower.
 *   PSS Header (Posted Sales Shipments)   → outbound_header
 *   PTR Header (Posted Transfer Receipts) → receiving_header
 *   ILE (Item Ledger Entries)             → receiving_detail / outbound_detail / crossdocking_pts
 * Dipakai bersama oleh tombol upload dan scripts/nav-sync.
 */
import {
  keepFields, normalizeKey, normalizeRow, pickValue, toISODate, toISODateTime, toNumber, type RawRow,
} from './parse'
export type { RawRow } from './parse'

// ── PSS Header ──────────────────────────────────────────────────────────────

const PSS_HEADER_FIELDS = [
  'pss_no', 'shipment_no', 'psi_no', 'posting_date', 'document_created_at', 'document_date', 'document_type',
  'location_code', 'branch_representative', 'project', 'order_no', 'customer_no', 'customer_name', 'ship_to_city',
  'cust_receipt_date', 'promised_delivery_date', 'shipping_agent_code', 'currency_code', 'no_printed',
  'package_tracking_no', 'source_file', 'import_period', 'created_at', 'updated_at',
] as const

export function mapPssHeaderRow(raw: RawRow, fileName: string, now = new Date().toISOString()): RawRow {
  const row = normalizeRow(raw)
  const documentDateValue = pickValue(row, ['document_date', 'doc_date', 'order_date'])
  const documentDate = documentDateValue ? toISODate(documentDateValue) : null
  const documentCreatedAt = toISODateTime(pickValue(row, [
    'document_data_time', 'document_date_time', 'document_created_date_time', 'document_created_datetime',
    'document_created_at', 'created_date_time', 'created_datetime', 'created_date', 'document_datetime',
    'doc_datetime', 'doc_date_time',
  ]))

  const record: RawRow = {
    pss_no: pickValue(row, ['pss_no', 'pss', 'no', 'document_no', 'doc_no', 'shipment_no']) ?? null,
    shipment_no: pickValue(row, ['shipment_no', 'pss_no', 'pss', 'no', 'document_no']) ?? null,
    psi_no: pickValue(row, ['psi_no', 'psi', 'posted_sales_invoice_no', 'invoice_no', 'sales_invoice_no']) ?? null,
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date', 'posting_dt'])),
    document_date: documentDate,
    document_created_at: documentCreatedAt ?? (documentDate ? `${documentDate}T00:00:00+07:00` : null),
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
  // pss_no dan shipment_no saling mengisi bila salah satunya tidak ada di file.
  if (!record.pss_no && record.shipment_no) record.pss_no = record.shipment_no
  if (!record.shipment_no && record.pss_no) record.shipment_no = record.pss_no
  return keepFields(record, PSS_HEADER_FIELDS)
}

/** Kunci unik PSS Header (kolom yang ber-constraint unik di DB). */
export const pssKey = (row: RawRow) => String(row.shipment_no ?? row.pss_no ?? '').trim()

// ── PTR Header ──────────────────────────────────────────────────────────────

const PTR_HEADER_FIELDS = [
  'ptr_no', 'transfer_order_no', 'transfer_from_code', 'transfer_to_code', 'posting_date', 'shipment_date',
  'receipt_date', 'shipping_agent_code', 'ship_to_receipt_days', 'receipt_to_posting_days', 'ship_to_posting_days',
  'source_file', 'import_period', 'created_at', 'updated_at',
] as const

export function mapPtrHeaderRow(raw: RawRow, fileName: string, now = new Date().toISOString()): RawRow {
  const row = normalizeRow(raw)
  return keepFields({
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
    source_file: fileName.trim(),
    import_period: now.slice(0, 7),
    created_at: now,
    updated_at: now,
  }, PTR_HEADER_FIELDS)
}

export function validatePtrHeaderRows(rows: RawRow[]): string[] {
  const issues: string[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 2
    if (!row.ptr_no) issues.push(`Baris ${rowNumber}: ptr_no wajib diisi`)
    if (!row.receipt_date) issues.push(`Baris ${rowNumber}: receipt_date wajib diisi`)
    if (!row.transfer_from_code) issues.push(`Baris ${rowNumber}: transfer_from_code wajib diisi`)
    if (!row.transfer_to_code) issues.push(`Baris ${rowNumber}: transfer_to_code wajib diisi`)
  })
  return issues
}

// ── ILE (Item Ledger Entries) ───────────────────────────────────────────────

// receiving_detail tanpa qty_out/outbound_header_id; outbound_detail tanpa qty_out (generated) / receiving_header_id.
const ILE_COMMON_FIELDS = [
  'posting_date', 'entry_type', 'document_type', 'document_no', 'document_line_no', 'item_no', 'variant_code',
  'description', 'document_created_at', 'branch_representative', 'project', 'return_reason_code', 'location_code',
  'lot_no', 'expiration_date', 'serial_no', 'quantity', 'invoiced_quantity', 'remaining_quantity',
  'shipped_qty_not_returned', 'reserved_quantity', 'open', 'order_type', 'entry_no',
  'source_file', 'import_period', 'created_at', 'updated_at',
] as const
const RECEIVING_DETAIL_FIELDS = ['receiving_header_id', ...ILE_COMMON_FIELDS] as const
const OUTBOUND_DETAIL_FIELDS = ['outbound_header_id', ...ILE_COMMON_FIELDS] as const

const DOCUMENT_CREATED_ALIASES = [
  'document_created_date_time', 'document_created_datetime', 'document_date_time', 'document_data_time', 'created_date',
]

function mapIleRecord(raw: RawRow, fileName: string, now: string, documentNoAliases: string[]): RawRow {
  const row = normalizeRow(raw)
  return {
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])),
    entry_type: pickValue(row, ['entry_type']) ?? null,
    document_type: pickValue(row, ['document_type']) ?? null,
    document_no: pickValue(row, documentNoAliases) ?? null,
    document_line_no: toNumber(pickValue(row, ['document_line_no', 'line_no', 'doc_line_no'])),
    item_no: pickValue(row, ['item_no', 'sku', 'item_no_1', 'item_no_no']) ?? null,
    variant_code: pickValue(row, ['variant_code']) ?? null,
    description: pickValue(row, ['description', 'item_name', 'desc']) ?? null,
    document_created_at: toISODateTime(pickValue(row, DOCUMENT_CREATED_ALIASES)),
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
}

export const mapReceivingDetailRow = (raw: RawRow, fileName: string, now: string) =>
  keepFields(mapIleRecord(raw, fileName, now, ['document_no', 'doc_no', 'ptr_no', 'no', 'document_no_1']), RECEIVING_DETAIL_FIELDS)

export const mapOutboundDetailRow = (raw: RawRow, fileName: string, now: string) =>
  keepFields(mapIleRecord(raw, fileName, now, ['document_no', 'doc_no', 'pss_no', 'no', 'document_no_1']), OUTBOUND_DETAIL_FIELDS)

/** Kunci unik receiving_detail. */
export function receivingDetailKey(row: RawRow): string {
  return [row.document_no, row.item_no, row.variant_code, row.lot_no, row.serial_no]
    .map((value) => String(value ?? '').trim()).join('|')
}

export type PtsUploadRow = {
  pts_no: string
  document_date?: string | null
  document_created_at?: string | null
  transfer_order_no?: string | null
  details: Array<{
    nav_entry_no?: number | null
    document_line_no?: number | null
    item_no?: string | null
    variant_code?: string | null
    description?: string | null
    quantity?: number | null
    lot_no?: string | null
    expiration_date?: string | null
    source_location_code?: string | null
  }>
}

/**
 * Satu file ILE dipecah menurut Document Type:
 *   Transfer Receipt                  → receiving_detail
 *   Posted Assembly / Sales Shipment  → outbound_detail
 *   Transfer Shipment                 → crossdocking PTS
 */
export function splitIleRows(rows: RawRow[], fileName: string, now = new Date().toISOString()) {
  const receivingRows: RawRow[] = []
  const outboundRows: RawRow[] = []
  const ptsRows: PtsUploadRow[] = []
  const receipt = normalizeKey('Transfer Receipt')
  const outboundTypes = new Set([normalizeKey('Posted Assembly'), normalizeKey('Sales Shipment')])
  const transferShipment = normalizeKey('Transfer Shipment')

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow)
    const rawDocType = pickValue(row, ['document_type', 'document type', 'doc_type'])
    if (!rawDocType) continue
    const docType = normalizeKey(String(rawDocType))
    if (docType === receipt) {
      receivingRows.push(mapReceivingDetailRow(rawRow, fileName, now))
    } else if (outboundTypes.has(docType)) {
      outboundRows.push(mapOutboundDetailRow(rawRow, fileName, now))
    } else if (docType === transferShipment) {
      const ptsNo = String(pickValue(row, ['document_no', 'doc_no', 'pts_no', 'no']) ?? '').trim().toUpperCase()
      ptsRows.push({
        pts_no: ptsNo,
        document_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])) || null,
        document_created_at: toISODateTime(pickValue(row, DOCUMENT_CREATED_ALIASES)) || null,
        transfer_order_no: String(pickValue(row, ['transfer_order_no', 'transfer_order']) ?? '').trim().toUpperCase() || null,
        details: [{
          nav_entry_no: Number(toNumber(pickValue(row, ['entry_no'])) ?? 0) || null,
          document_line_no: Number(toNumber(pickValue(row, ['document_line_no', 'line_no'])) ?? 0) || null,
          item_no: String(pickValue(row, ['item_no', 'sku']) ?? '').trim() || null,
          variant_code: String(pickValue(row, ['variant_code']) ?? '').trim() || null,
          description: String(pickValue(row, ['description', 'item_name']) ?? '').trim() || null,
          quantity: Number(toNumber(pickValue(row, ['quantity', 'qty']))) || null,
          lot_no: String(pickValue(row, ['lot_no', 'lot']) ?? '').trim() || null,
          expiration_date: toISODate(pickValue(row, ['expiration_date', 'expiry_date', 'exp_date'])) || null,
          source_location_code: String(pickValue(row, ['location_code', 'location']) ?? '').trim() || null,
        }],
      })
    }
  }
  return { receivingRows, outboundRows, ptsRows: ptsRows.filter((row) => row.pts_no) }
}

// ── PAO → PSS ───────────────────────────────────────────────────────────────
// Baris ILE "Posted Assembly" bernomor PAO dipetakan ke PSS dalam project/cabang/lokasi yang sama,
// diutamakan yang document_created_at-nya sama; bila tidak ada, PSS terdekat sebelumnya.

const isPss = (value: string) => value.trim().toUpperCase().startsWith('PSS')
const isPao = (value: string) => value.trim().toUpperCase().startsWith('PAO')

function normalizeDocumentTime(value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const date = new Date(hasTimezone ? raw : `${raw}+07:00`)
  if (Number.isNaN(date.getTime())) return raw
  return new Date(Math.floor(date.getTime() / 60000) * 60000).toISOString()
}

function normalizeDocumentDate(value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  const directDate = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directDate) return directDate[1]
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export function normalizePaoToPss(
  rows: RawRow[],
  existingHeaders: RawRow[] = []
): { normalized: string[]; remappedCount: number; unmappedPaos: string[] } {
  const result = rows.map((row) => String(row.document_no ?? '').trim())
  let remappedCount = 0
  const unmappedPaos: string[] = []

  const contextFor = (row: RawRow) =>
    [row.project, row.branch_representative, row.location_code].map((value) => String(value ?? '').trim()).join('\u001f')

  const contextMatches = (detailRow: RawRow, header: RawRow) => {
    const matches = (field: string, headerRequired: boolean) => {
      const detailValue = String(detailRow[field] ?? '').trim().toUpperCase()
      const headerValue = String(header[field] ?? '').trim().toUpperCase()
      if (!detailValue || !headerValue) return !headerRequired
      return detailValue === headerValue
    }
    return ['project', 'location_code'].every((field) => matches(field, true))
      && ['branch_representative'].every((field) => matches(field, false))
  }

  type Candidate = { index: number; documentNo: string; documentTime: string | null; documentDate: string | null }
  const pssByContext = new Map<string, Candidate[]>()
  rows.forEach((row, index) => {
    const documentNo = result[index]
    if (!isPss(documentNo)) return
    const context = contextFor(row)
    const candidates = pssByContext.get(context) ?? []
    candidates.push({
      index,
      documentNo,
      documentTime: normalizeDocumentTime(row.document_created_at ?? row.document_date ?? null),
      documentDate: normalizeDocumentDate(row.document_created_at ?? row.document_date ?? null),
    })
    pssByContext.set(context, candidates)
  })

  existingHeaders.forEach((header) => {
    const documentNo = String(header.pss_no ?? header.shipment_no ?? '').trim()
    if (!isPss(documentNo)) return
    rows.forEach((row) => {
      if (!contextMatches(row, header)) return
      const context = contextFor(row)
      const candidates = pssByContext.get(context) ?? []
      candidates.push({
        index: Number.MAX_SAFE_INTEGER,
        documentNo,
        documentTime: normalizeDocumentTime(header.document_created_at ?? header.document_date ?? null),
        documentDate: normalizeDocumentDate(header.document_created_at ?? header.document_date ?? null),
      })
      pssByContext.set(context, candidates)
    })
  })

  for (let i = 0; i < result.length; i++) {
    if (!isPao(result[i])) continue
    const currentRow = rows[i]
    const currentTime = normalizeDocumentTime(currentRow.document_created_at ?? currentRow.document_date ?? null)
    const currentDate = normalizeDocumentDate(currentRow.document_created_at ?? currentRow.document_date ?? null)
    const contextualCandidates = pssByContext.get(contextFor(currentRow)) ?? []
    const candidates = contextualCandidates.length > 0 ? contextualCandidates : [...pssByContext.values()].flat()

    let sameTime = candidates.filter((candidate) => candidate.documentTime && currentTime && candidate.documentTime === currentTime)
    // Sebagian ekspor NAV tidak mengisi project/lokasi pada satu jenis dokumen; jam dokumen tetap acuan PAO → PSS.
    if (sameTime.length === 0 && currentTime) {
      sameTime = [...pssByContext.values()].flat().filter((candidate) => candidate.documentTime === currentTime)
    }
    if (sameTime.length === 0 && currentDate) {
      sameTime = candidates.filter((candidate) => candidate.documentDate === currentDate)
    }
    if (sameTime.length === 0 && currentDate) {
      sameTime = [...pssByContext.values()].flat().filter((candidate) => candidate.documentDate === currentDate)
    }

    const replacement = sameTime.length > 0
      ? sameTime[sameTime.length - 1].documentNo
      : currentTime || candidates.some((candidate) => candidate.documentTime)
        ? null
        : (() => {
            const preceding = candidates.filter((candidate) => candidate.index <= i)
            return preceding.length > 0 ? preceding[preceding.length - 1].documentNo : candidates[0]?.documentNo ?? null
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
