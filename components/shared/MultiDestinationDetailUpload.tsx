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
import { normalizePaoToPss, receivingDetailKey, splitIleRows } from '@/lib/nav-import/map';
import { formatError } from '@/lib/nav-import/parse';
import { uploadPtsRecords } from '@/app/(app)/crossdocking/actions';

// Pemetaan ILE dipakai bersama dengan scripts/nav-sync agar aturannya sama.
const detailKey = receivingDetailKey;

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

      const { receivingRows, outboundRows, ptsRows: ptsUploadRows } = splitIleRows(rows, file.name);
      const ptsRows = ptsUploadRows;

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
