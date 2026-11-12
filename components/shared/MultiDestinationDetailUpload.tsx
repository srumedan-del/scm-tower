'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { uploadProgress, uploadResult } from '@/lib/upload-progress';
import { 
  getReceivingHeadersByPtrs,
  getExistingReceivingDetailKeys,
  insertReceivingDetailRows 
} from '@/app/(app)/receiving/actions';
import { 
  getOutboundHeadersByPssNos,
  getOutboundHeadersForPaoMatching,
  insertOutboundDetailRows,
  updateOutboundHeaderCreatedTimes
} from '@/app/(app)/outbound/actions';
import { normalizePaoToPss } from '@/components/outbound/OutboundUploadButton';
import { uploadPtsRecords } from '@/app/(app)/crossdocking/actions';
import type { PtsUploadRow } from '@/app/(app)/crossdocking/actions';

function formatError(error: any): string {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.';
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed && typeof parsed === 'object') {
        return formatError(parsed);
      }
    } catch {
      // bukan JSON string
    }
    return error;
  }

  const target = error.error || error.cause || error;

  if (target?.message) {
    let msg = typeof target.message === 'string' ? target.message : JSON.stringify(target.message);
    try {
      const inner = JSON.parse(msg);
      if (inner && inner.message) {
        msg = inner.message;
        if (inner.code) msg += ` (code: ${inner.code})`;
        if (inner.details) msg += `\nDetail: ${inner.details}`;
        if (inner.hint) msg += `\nHint: ${inner.hint}`;
        return msg;
      }
    } catch {
      // bukan JSON string
    }

    if (target.code) msg += ` (code: ${target.code})`;
    if (target.details) msg += `\nDetail: ${target.details}`;
    if (target.hint) msg += `\nHint: ${target.hint}`;
    return msg;
  }

  return JSON.stringify(error, null, 2);
}

function detailKey(row: Record<string, any>): string {
  return [
    String(row.document_no ?? '').trim(),
    String(row.item_no ?? '').trim(),
    String(row.variant_code ?? '').trim(),
    String(row.lot_no ?? '').trim(),
    String(row.serial_no ?? '').trim(),
  ].join('|');
}

const normalizeKey = (value: string) => 
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const toISODate = (value: unknown) => {
  if (!value && value !== 0) return '9999-12-31';
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
      return '9999-12-31';
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

const toISODateTime = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (!date) return null;
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}T${String(date.H ?? 0).padStart(2, '0')}:${String(date.M ?? 0).padStart(2, '0')}:${String(date.S ?? 0).padStart(2, '0')}+07:00`;
    } catch {
      return null;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = String(value).trim();
  const indonesianDateTime = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (indonesianDateTime) {
    const [, day, month, year, hour, minute, second = '00'] = indonesianDateTime;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}+07:00`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = typeof value === 'string' ? value.replace(/,/g, '') : value;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
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

// Allowed fields untuk receiving_detail (TIDAK ADA qty_out, TIDAK ADA outbound_header_id)
const RECEIVING_ALLOWED_FIELDS = [
  'receiving_header_id', 'posting_date', 'entry_type', 'document_type',
  'document_no', 'document_line_no', 'item_no', 'variant_code', 'description',
  'document_created_at', 'branch_representative', 'project', 'return_reason_code',
  'location_code', 'lot_no', 'expiration_date', 'serial_no', 'quantity',
  'invoiced_quantity', 'remaining_quantity', 'shipped_qty_not_returned',
  'reserved_quantity', 'open', 'order_type', 'entry_no',
  'source_file', 'import_period', 'created_at', 'updated_at',
] as const;

// Allowed fields untuk outbound_detail (TIDAK ADA qty_out karena generated column di DB, TIDAK ADA receiving_header_id)
const OUTBOUND_ALLOWED_FIELDS = [
  'outbound_header_id', 'posting_date', 'entry_type', 'document_type',
  'document_no', 'document_line_no', 'item_no', 'variant_code', 'description',
  'document_created_at', 'branch_representative', 'project', 'return_reason_code',
  'location_code', 'lot_no', 'expiration_date', 'serial_no', 'quantity',
  'invoiced_quantity', 'remaining_quantity', 'shipped_qty_not_returned',
  'reserved_quantity', 'open', 'order_type', 'entry_no',
  'source_file', 'import_period', 'created_at', 'updated_at',
] as const;

const mapReceivingRow = (raw: Record<string, any>, fileName: string, now: string) => {
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
    document_created_at: toISODateTime(pickValue(row, [
      'document_created_date_time',
      'document_created_datetime',
      'document_date_time',
      'document_data_time',
      'created_date',
    ])),
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
  };

  const sanitized: Record<string, any> = {};
  for (const field of RECEIVING_ALLOWED_FIELDS) {
    const value = record[field];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      sanitized[field] = value;
    }
  }
  return sanitized;
};

const mapOutboundRow = (raw: Record<string, any>, fileName: string, now: string) => {
  const row = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value])
  );

  const record: Record<string, any> = {
    posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])),
    entry_type: pickValue(row, ['entry_type']) ?? null,
    document_type: pickValue(row, ['document_type']) ?? null,
    document_no: pickValue(row, ['document_no', 'doc_no', 'pss_no', 'no', 'document_no_1']) ?? null,
    document_line_no: toNumber(pickValue(row, ['document_line_no', 'line_no', 'doc_line_no'])),
    item_no: pickValue(row, ['item_no', 'sku', 'item_no_1', 'item_no_no']) ?? null,
    variant_code: pickValue(row, ['variant_code']) ?? null,
    description: pickValue(row, ['description', 'item_name', 'desc']) ?? null,
    document_created_at: toISODateTime(pickValue(row, [
      'document_created_date_time',
      'document_created_datetime',
      'document_date_time',
      'document_data_time',
      'created_date',
    ])),
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
  };

  const sanitized: Record<string, any> = {};
  for (const field of OUTBOUND_ALLOWED_FIELDS) {
    const value = record[field];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      sanitized[field] = value;
    }
  }
  return sanitized;
};

/**
 * Multi-Destination Detail Upload Component
 * Satu file → 3 destinasi berdasarkan Document Type:
 * - Transfer Receipt → Receiving Detail (insertReceivingDetailRows)
 * - Posted Assembly / Sales Shipment → Outbound Detail (insertOutboundDetailRows)
 * - Transfer Shipment → PTS Detail (uploadPtsRecords)
 */
export default function MultiDestinationDetailUpload() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    uploadProgress.start(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      uploadProgress.stage('validate');
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null }) as Record<string, any>[];

      if (!rows.length) throw new Error('File kosong.');

      const now = new Date().toISOString();
      const receivingRows: Record<string, any>[] = [];
      const outboundRows: Record<string, any>[] = [];
      const ptsRows: Record<string, any>[] = [];

      rows.forEach((rawRow) => {
        const row = Object.fromEntries(
          Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value])
        );

        const rawDocType = pickValue(row, ['document_type', 'document type', 'doc_type']);
        if (!rawDocType) return;
        const normDocType = normalizeKey(String(rawDocType));

        // 1. Khusus Receiving / Inbound (PTR): HANYA ambil Document Type = Transfer Receipt
        if (normDocType === normalizeKey('Transfer Receipt')) {
          receivingRows.push(mapReceivingRow(rawRow, file.name, now));
        } 
        // 2. Khusus Outbound: HANYA ambil Document Type = Posted Assembly atau Sales Shipment
        else if (
          normDocType === normalizeKey('Posted Assembly') ||
          normDocType === normalizeKey('Sales Shipment')
        ) {
          outboundRows.push(mapOutboundRow(rawRow, file.name, now));
        } 
        // 3. Khusus Crossdocking (PTS): HANYA ambil Document Type = Transfer Shipment
        else if (normDocType === normalizeKey('Transfer Shipment')) {
          ptsRows.push({
            pts_no: pickValue(row, ['document_no', 'doc_no', 'pts_no', 'no']),
            posting_date: toISODate(pickValue(row, ['posting_date', 'posted_date'])),
            document_created_at: toISODateTime(pickValue(row, [
      'document_created_date_time',
      'document_created_datetime',
      'document_date_time',
      'document_data_time',
      'created_date',
    ])),
            transfer_order_no: pickValue(row, ['transfer_order_no', 'transfer_order']),
            entry_no: toNumber(pickValue(row, ['entry_no'])),
            document_line_no: toNumber(pickValue(row, ['document_line_no', 'line_no'])),
            item_no: pickValue(row, ['item_no', 'sku']),
            variant_code: pickValue(row, ['variant_code']),
            description: pickValue(row, ['description', 'item_name']),
            quantity: toNumber(pickValue(row, ['quantity', 'qty'])),
            lot_no: pickValue(row, ['lot_no', 'lot']),
            expiration_date: toISODate(pickValue(row, ['expiration_date', 'expiry_date', 'exp_date'])),
            location_code: pickValue(row, ['location_code', 'location']),
          });
        }
      });

      // Validasi dan proses per destination
      const results: {
        receiving?: { inserted: number; skipped: number; error?: string };
        outbound?: { inserted: number; skipped: number; error?: string };
        pts?: { inserted: number; total: number; error?: string };
      } = {};

      // 1. Process Receiving (Transfer Receipt)
      uploadProgress.stage('save');
      if (receivingRows.length > 0) {
        try {
          const ptrNos = [...new Set(receivingRows.map(r => String(r.document_no ?? '').trim()))].filter(Boolean);
          if (ptrNos.length > 0) {
            const { data: headers, error: headerErr } = await getReceivingHeadersByPtrs(ptrNos);
            if (headerErr) throw headerErr;

            const headerMap = new Map<string, string>();
            for (const h of (headers ?? []) as any[]) {
              headerMap.set(String(h.ptr_no ?? '').trim(), h.id);
            }

            const rowsWithHeaderId = receivingRows
              .map((row) => ({
                ...row,
                receiving_header_id: headerMap.get(String(row.document_no ?? '').trim()) ?? null,
              }))
              .filter((r) => r.receiving_header_id);

            if (rowsWithHeaderId.length > 0) {
              const existingDetailKeys = new Set<string>();
              try {
                const { data: existingDetails } = await getExistingReceivingDetailKeys(ptrNos);
                for (const row of existingDetails ?? []) {
                  existingDetailKeys.add(detailKey(row));
                }
              } catch {
                // Abaikan jika query existing gagal
              }

              const seenDetailKeys = new Set<string>();
              const toInsertDetails = rowsWithHeaderId.filter((row) => {
                const key = detailKey(row);
                if (existingDetailKeys.has(key) || seenDetailKeys.has(key)) return false;
                seenDetailKeys.add(key);
                return true;
              });

              if (toInsertDetails.length > 0) {
                const result = await insertReceivingDetailRows(toInsertDetails);
                const inserted = result.inserted;
                const skipped = receivingRows.length - inserted;
                results.receiving = { inserted, skipped };
              } else {
                results.receiving = {
                  inserted: 0,
                  skipped: receivingRows.length,
                  error: 'Semua baris detail PTR sudah ada di database atau duplikat dalam file.',
                };
              }
            } else {
              results.receiving = {
                inserted: 0,
                skipped: receivingRows.length,
                error: `Belum ada Header PTR di database untuk: ${ptrNos.slice(0, 3).join(', ')}. Upload PTR Header terlebih dahulu.`,
              };
            }
          } else {
            results.receiving = { inserted: 0, skipped: 0, error: 'Tidak ada nomor PTR (document_no) yang valid.' };
          }
        } catch (recError: any) {
          results.receiving = {
            inserted: 0,
            skipped: receivingRows.length,
            error: formatError(recError),
          };
        }
      }

      // 2. Process Outbound (Posted Assembly / Sales Shipment)
      if (outboundRows.length > 0) {
        const validOutboundRows = outboundRows.filter(
          (r) => r.entry_no !== null && r.entry_no !== undefined && !isNaN(Number(r.entry_no)) && r.document_no
        );

        if (validOutboundRows.length > 0) {
          try {
            // Normalisasi PAO -> PSS menggunakan context header & timestamp
            const { data: matchingHeaders } = await getOutboundHeadersForPaoMatching();
            const { normalized } = normalizePaoToPss(validOutboundRows, matchingHeaders ?? []);
            
            // Terapkan document_no yang telah dinormalisasi
            validOutboundRows.forEach((row, i) => {
              if (normalized[i]) row.document_no = normalized[i];
            });

            // Sambungkan outbound_header_id jika PSS header sudah ada di database
            const pssNos = [...new Set(validOutboundRows.map((r) => String(r.document_no ?? '').trim()))].filter(Boolean);
            if (pssNos.length > 0) {
              const { data: pssHeaders } = await getOutboundHeadersByPssNos(pssNos);
              if (pssHeaders && pssHeaders.length > 0) {
                const pssHeaderMap = new Map<string, number>();
                for (const h of pssHeaders as any[]) {
                  const id = Number(h.id);
                  if (h.pss_no) pssHeaderMap.set(String(h.pss_no).trim(), id);
                  if (h.shipment_no) pssHeaderMap.set(String(h.shipment_no).trim(), id);
                }
                for (const row of validOutboundRows) {
                  const hid = pssHeaderMap.get(String(row.document_no ?? '').trim());
                  if (hid) row.outbound_header_id = hid;
                }
              }
            }

            const result = await insertOutboundDetailRows(validOutboundRows);
            results.outbound = { inserted: result.inserted, skipped: result.skipped };

            // Update timestamp & has_detail pada outbound_header
            try {
              await updateOutboundHeaderCreatedTimes(validOutboundRows);
            } catch (err) {
              console.warn('Gagal update header created times:', err);
            }
          } catch (outboundError: any) {
            results.outbound = {
              inserted: 0,
              skipped: validOutboundRows.length,
              error: formatError(outboundError),
            };
          }
        } else {
          results.outbound = {
            inserted: 0,
            skipped: outboundRows.length,
            error: 'Tidak ada entry_no yang valid untuk outbound.',
          };
        }
      }

      // 3. Process PTS (Transfer Shipment)
      if (ptsRows.length > 0) {
        try {
          const ptsUploadRows: PtsUploadRow[] = ptsRows.map((row) => ({
            pts_no: String(row.pts_no ?? '').trim().toUpperCase() || '',
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

          const validPtsRows = ptsUploadRows.filter((r) => r.pts_no);

          if (validPtsRows.length > 0) {
            const { inserted, total } = await uploadPtsRecords(validPtsRows, file.name);
            results.pts = { inserted, total };
          } else {
            results.pts = { inserted: 0, total: ptsRows.length, error: 'Tidak ada nomor PTS yang valid.' };
          }
        } catch (ptsError: any) {
          results.pts = { inserted: 0, total: ptsRows.length, error: formatError(ptsError) };
        }
      }

      // Ringkasan hasil upload
      const successCount =
        (results.receiving?.inserted ?? 0) +
        (results.outbound?.inserted ?? 0) +
        (results.pts?.inserted ?? 0);
      const receivingSkipped = results.receiving?.skipped ?? 0;
      const outboundSkipped = results.outbound?.skipped ?? 0;
      const ptsTotal = results.pts?.total ?? 0;
      const ptsInserted = results.pts?.inserted ?? 0;
      const totalSkipped = receivingSkipped + outboundSkipped + (ptsTotal - ptsInserted);

      const errorMessages = [
        results.receiving?.error && `Receiving: ${results.receiving.error}`,
        results.outbound?.error && `Outbound: ${results.outbound.error}`,
        results.pts?.error && `PTS: ${results.pts.error}`,
      ].filter(Boolean);

      if (successCount === 0 && totalSkipped === 0) {
        await uploadResult({
          icon: 'info',
          title: 'Tidak Ada Data Terproses',
          text: 'Tidak ada baris dengan Document Type yang sesuai (Transfer Receipt, Posted Assembly, Sales Shipment, atau Transfer Shipment).',
          confirmButtonColor: '#1F3F6E',
        });
      } else if (successCount === 0) {
        await uploadResult({
          icon: errorMessages.length > 0 ? 'error' : 'info',
          title: errorMessages.length > 0 ? 'Upload Gagal' : 'Tidak Ada Data Baru',
          text: errorMessages.length > 0
            ? errorMessages.join('\n\n')
            : `${totalSkipped} baris sudah ada di database atau dilewati.`,
          confirmButtonColor: '#1F3F6E',
        });
      } else {
        const detailBreakdown: string[] = [];
        if (results.receiving?.inserted) {
          detailBreakdown.push(`Receiving: ${results.receiving.inserted} baris`);
        }
        if (results.outbound?.inserted) {
          detailBreakdown.push(`Outbound: ${results.outbound.inserted} baris`);
        }
        if (results.pts?.inserted) {
          detailBreakdown.push(`PTS: ${results.pts.inserted} dokumen`);
        }

        let messageText = `${successCount} baris berhasil di-upload (${detailBreakdown.join(', ')}).`;
        if (totalSkipped > 0) {
          messageText += `\n${totalSkipped} baris dilewati (sudah ada).`;
        }
        if (errorMessages.length > 0) {
          messageText += `\n\nCatatan:\n${errorMessages.join('\n')}`;
        }

        await uploadResult({
          icon: 'success',
          title: 'Upload Berhasil',
          text: messageText,
          confirmButtonColor: '#1F3F6E',
        });
        router.refresh();
      }

    } catch (error: any) {
      await uploadResult({
        icon: 'error',
        title: 'Upload Gagal',
        text: formatError(error),
        confirmButtonColor: '#1F3F6E',
      });
    } finally {
      setLoading(false);
      uploadProgress.ensureClosed();
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
        {loading ? 'Processing...' : 'Upload ILE'}
      </button>
    </div>
  );
}
