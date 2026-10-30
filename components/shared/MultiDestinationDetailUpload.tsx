'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  getExistingReceivingHeaderPtrs, 
  insertReceivingDetailRows 
} from '@/app/(app)/receiving/actions';
import { rpcBulkInsertOutboundDetail } from '@/app/(app)/outbound/actions-batch';
import { uploadPtsRecords } from '@/app/(app)/crossdocking/actions';
import type { PtsUploadRow } from '@/app/(app)/crossdocking/actions';

const normalizeKey = (value: string) => 
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const RECEIVING_DETAIL_FIELDS = [
  'receiving_header_id', 'posting_date', 'entry_type', 'document_type',
  'document_no', 'document_line_no', 'item_no', 'variant_code', 'description',
  'document_created_at', 'branch_representative', 'project', 'return_reason_code',
  'location_code', 'lot_no', 'expiration_date', 'serial_no', 'quantity',
  'invoiced_quantity', 'remaining_quantity', 'shipped_qty_not_returned',
  'reserved_quantity', 'open', 'order_type', 'entry_no',
  'source_file', 'import_period', 'created_at', 'updated_at',
] as const;

const toISODate = (value: unknown) => {
  if (!value && value !== 0) return '9999-12-31';
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    } catch {
      return '9999-12-31';
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '9999-12-31';
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return '9999-12-31';
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const mapDetailRow = (raw: Record<string, any>) => {
  const row = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
  );

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
    source_file: '',
    import_period: new Date().toISOString().slice(0, 7),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sanitized: Record<string, any> = {};
  for (const field of RECEIVING_DETAIL_FIELDS) {
    const value = record[field];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      sanitized[field] = value;
    }
  }
  return sanitized;
};

const pickValue = (row: Record<string, any>, aliases: string[]) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find((k) => normalizeKey(k) === normalizeKey(alias));
    if (key && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return null;
};

/**
 * Multi-Destination Detail Upload Component
 * Satu file → 3 destinasi berdasarkan Document Type:
 * - Transfer Receipt → Receiving Detail (insertReceivingDetailRows)
 * - Posted Assembly / Sales Shipment → Outbound Detail (rpcBulkInsertOutboundDetail)
 * - Transfer Shipment → PTS Detail (uploadPtsRecords)
 */
export default function MultiDestinationDetailUpload() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[];

      if (!rows.length) throw new Error('File kosong.');

      // Parse dan triak baris berdasarkan Document Type
      const receivingRows: Record<string, any>[] = [];
      const outboundRows: Record<string, any>[] = [];
      const ptsRows: Record<string, any>[] = [];

      rows.forEach((rawRow) => {
        const row = Object.fromEntries(
          Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value])
        );

        const docType = pickValue(row, ['document_type']).trim().toUpperCase();
        if (!docType) return;

        // Map ke field detail yang dibutuhkan setiap destination
        const mapped = mapDetailRow(rawRow);
        mapped.source_file = file.name;

        switch (docType) {
          case 'TRANSFER RECEIPT':
          case 'PTR':
            receivingRows.push(mapped);
            break;
          case 'POSTED ASSEMBLY':
          case 'SALES SHIPMENT':
            outboundRows.push(mapped);
            break;
          case 'TRANSFER SHIPMENT':
          case 'PTS':
            ptsRows.push(mapped);
            break;
          default:
            // Unknown document type, dilewati dengan catatan
            break;
        }
      });

      // Validasi dan proses per destination
      const results: {
        receiving?: { inserted: number; skipped: number; error?: string };
        outbound?: { inserted: number; skipped: number; error?: string };
        pts?: { inserted: number; total: number; error?: string };
      } = {};

      // 1. Process Receiving (Transfer Receipt)
      if (receivingRows.length > 0) {
        // Check existing PTR headers
        const ptrNos = [...new Set(receivingRows.map(r => String(r.document_no ?? '').trim()))].filter(Boolean);
        if (ptrNos.length > 0) {
          const { data: existing } = await getExistingReceivingHeaderPtrs(ptrNos);
          const existingSet = new Set((existing ?? []).map((r: any) => String(r.ptr_no ?? '').trim()));
          const seen = new Set<string>();
          const toInsert = receivingRows.filter((row) => {
            const ptr = String(row.document_no ?? '').trim();
            if (!ptr || existingSet.has(ptr) || seen.has(ptr)) return false;
            seen.add(ptr);
            return true;
          });

          if (toInsert.length > 0) {
            // Pastikan header PTR sudah ada dulu
            const headerPts = [...new Set(toInsert.map(r => String(r.ptr_no ?? '').trim()))].filter(Boolean);
            const { data: headers } = await getExistingReceivingHeaderPtrs(headerPts);
            const headerMap = new Map<string, string>();
            for (const h of headers as any[]) {
              headerMap.set(String(h.ptr_no).trim(), h.id);
            }

            const rowsWithHeaderId = toInsert.map((row) => ({
              ...row,
              receiving_header_id: headerMap.get(String(row.document_no).trim()) ?? null,
            })).filter((r) => r.receiving_header_id);

            if (rowsWithHeaderId.length > 0) {
              const result = await insertReceivingDetailRows(rowsWithHeaderId);
              const inserted = result.inserted;
              const skipped = toInsert.length - inserted;
              results.receiving = { inserted, skipped };
            } else {
              results.receiving = { inserted: 0, skipped: toInsert.length, error: 'Tid ada header PTR yang cocok' };
            }
          } else {
            results.receiving = { inserted: 0, skipped: ptrNos.length, error: 'Semua PTR sudah ada di database' };
          }
        } else {
          results.receiving = { inserted: 0, skipped: 0, error: 'Tid ada ptr_no yang valid' };
        }
      }

      // 2. Process Outbound (Posted Assembly / Sales Shipment)
      if (outboundRows.length > 0) {
        // Filter baris yang punya entry_no dan field yang dibutuhkan
        const validOutboundRows = outboundRows.filter(
          (r) => r.entry_no !== null && r.entry_no !== undefined && !isNaN(Number(r.entry_no))
        );

        if (validOutboundRows.length > 0) {
          try {
            const result = await rpcBulkInsertOutboundDetail(validOutboundRows);
            results.outbound = { inserted: result.inserted, skipped: validOutboundRows.length - result.inserted };
          } catch (rpcError: any) {
            results.outbound = { inserted: 0, skipped: validOutboundRows.length, error: rpcError?.message || 'Gagal insert outbound via RPC' };
          }
        } else {
          results.outbound = { inserted: 0, skipped: outboundRows.length, error: 'Tid ada entry_no yang valid untuk outbound' };
        }
      }

      // 3. Process PTS (Transfer Shipment)
      if (ptsRows.length > 0) {
        // Transform flat rows kePtsUploadRow format
        const ptsUploadRows: PtsUploadRow[] = ptsRows.map((row) => ({
          pts_no: String(row.pts_no ?? row.document_no ?? '').trim().toUpperCase() || '',
          document_date: row.posting_date || null,
          document_created_at: row.document_created_at || null,
          transfer_order_no: String(row.transfer_order_no ?? '').trim().toUpperCase() || null,
          details: [
            {
              nav_entry_no: Number(row.entry_no ?? 0) || null,
              document_line_no: Number(row.document_line_no ?? 0) || null,
              item_no: String(row.item_no ?? '').trim() || null,
              variant_code: String(row.variant_code ?? '').trim() || null,
              description: String(row.description ?? '').trim() || null,
              quantity: Number(row.quantity) || null,
              lot_no: String(row.lot_no ?? '').trim() || null,
              expiration_date: String(row.expiration_date ?? '').trim() || null,
              source_location_code: String(row.location_code ?? '').trim() || null,
            },
          ],
        }));

        // Filter rows yang punya pts_no
        const validPtsRows = ptsUploadRows.filter(r => r.pts_no);
        
        if (validPtsRows.length > 0) {
          try {
            const { inserted, total } = await uploadPtsRecords(validPtsRows, file.name);
            results.pts = { inserted, total };
          } catch (ptsError: any) {
            results.pts = { inserted: 0, total: validPtsRows.length, error: ptsError?.message || 'Gagal upload PTS' };
          }
        } else {
          results.pts = { inserted: 0, total: ptsRows.length, error: 'Tid ada pts_no yang valid' };
        }
      }

      // Ringkasan akhir
      const successCount = (results.receiving?.inserted ?? 0) + (results.outbound?.inserted ?? 0) + (results.pts?.inserted ?? 0);
      const receivingSkipped = results.receiving?.skipped ?? 0;
      const outboundSkipped = results.outbound?.skipped ?? 0;
      const ptsTotal = results.pts?.total ?? 0;
      const ptsInserted = results.pts?.inserted ?? 0;
      const totalSkipped = receivingSkipped + outboundSkipped + (ptsTotal - ptsInserted);

      setMessage({
        type: 'success',
        text: `${successCount} baris berhasil di-upload${totalSkipped > 0 ? `, ${totalSkipped} dilewati` : ''}.`,
      });

    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal proses upload multi-destination.' });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={handleFileSelect}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <polyline
              points="12 1 12 22"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 3 21 3 22 7" />
            <polyline points="7 21 3 17 7 3" />
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="3" x2="8" y2="3" />
            <line x1="16" y1="21" x2="8" y2="21" />
            <line x1="10" y1="9" x2="8" y2="9" />
            <line x1="14" y1="15" x2="12" y2="15" />
          </svg>
        )}
        {loading ? 'Processing...' : 'Upload Detail (Semua Menu)' }
      </button>

      {message && (
        <div
          className={
            `inline-flex max-w-xl items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`
          }
        >
          {message.type === 'success'
            ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 11.08V12a10 10 0 11-5.94-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6l6 6" />
              </svg>}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}