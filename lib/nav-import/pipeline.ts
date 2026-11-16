/**
 * Alur impor lengkap per file NAV, sama dengan tombol upload di Outbound dan Receiving.
 * Dipakai scripts/nav-sync. Urutan wajib: PSS Header dan PTR Header dulu, lalu ILE.
 * dryRun: hanya menghitung baris baru, tidak menulis ke database.
 */
import * as db from './db'
import { mapPssHeaderRow, mapPtrHeaderRow, normalizePaoToPss, pssKey, receivingDetailKey, splitIleRows, validatePtrHeaderRows, type RawRow } from './map'
import { formatError } from './parse'

type Options = { dryRun?: boolean }
export type StepResult = { inserted: number; skipped: number; total: number; note?: string }

export async function ingestPssHeader(client: db.Db, rawRows: RawRow[], fileName: string, options: Options = {}): Promise<StepResult> {
  const cleanRows = rawRows.map((row) => mapPssHeaderRow(row, fileName)).filter((row) => row.pss_no)
  if (!cleanRows.length) return { inserted: 0, skipped: 0, total: rawRows.length, note: 'Tidak ada baris dengan PSS No.' }
  const { data: existing, error } = await db.getExistingOutboundHeaderPssNos(client, cleanRows.map(pssKey).filter(Boolean))
  if (error) throw error
  const existingSet = new Set<string>()
  for (const r of existing) {
    if (r.shipment_no) existingSet.add(String(r.shipment_no).trim())
    if (r.pss_no) existingSet.add(String(r.pss_no).trim())
  }
  const seen = new Set<string>()
  const toInsert = cleanRows.filter((row) => {
    const key = pssKey(row)
    if (!key || existingSet.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (options.dryRun || !toInsert.length) return { inserted: options.dryRun ? toInsert.length : 0, skipped: cleanRows.length - toInsert.length, total: cleanRows.length }
  const result = await db.insertOutboundHeaderRows(client, toInsert)
  return { inserted: result.inserted, skipped: cleanRows.length - result.inserted, total: cleanRows.length }
}

export async function ingestPtrHeader(client: db.Db, rawRows: RawRow[], fileName: string, options: Options = {}): Promise<StepResult> {
  const cleanRows = rawRows.map((row) => mapPtrHeaderRow(row, fileName)).filter((row) => row.ptr_no)
  if (!cleanRows.length) return { inserted: 0, skipped: 0, total: rawRows.length, note: 'Tidak ada baris dengan No. PTR' }
  const issues = validatePtrHeaderRows(cleanRows)
  if (issues.length) throw new Error(`Validasi PTR gagal:\n${issues.slice(0, 10).join('\n')}`)
  const { data: existing, error } = await db.getExistingReceivingHeaderPtrs(client, cleanRows.map((r) => String(r.ptr_no).trim()))
  if (error) throw error
  const existingSet = new Set(existing.map((r: any) => String(r.ptr_no ?? '').trim()))
  const seen = new Set<string>()
  const toInsert = cleanRows.filter((row) => {
    const ptr = String(row.ptr_no ?? '').trim()
    if (!ptr || existingSet.has(ptr) || seen.has(ptr)) return false
    seen.add(ptr)
    return true
  })
  if (options.dryRun || !toInsert.length) return { inserted: options.dryRun ? toInsert.length : 0, skipped: cleanRows.length - toInsert.length, total: cleanRows.length }
  const result = await db.insertReceivingHeaderRows(client, toInsert)
  return { inserted: result.inserted, skipped: cleanRows.length - result.inserted, total: cleanRows.length }
}

export type IleResult = { receiving?: StepResult; outbound?: StepResult; pts?: StepResult; errors: string[] }

export async function ingestIle(client: db.Db, rawRows: RawRow[], fileName: string, options: Options = {}): Promise<IleResult> {
  const { receivingRows, outboundRows, ptsRows } = splitIleRows(rawRows, fileName)
  const out: IleResult = { errors: [] }

  // 1. Transfer Receipt → receiving_detail (butuh PTR Header).
  if (receivingRows.length) {
    try {
      const ptrNos = [...new Set(receivingRows.map((r) => String(r.document_no ?? '').trim()))].filter(Boolean)
      const { data: headers, error } = await db.getReceivingHeadersByPtrs(client, ptrNos)
      if (error) throw error
      const headerMap = new Map<string, string>(headers.map((h: any) => [String(h.ptr_no ?? '').trim(), h.id]))
      const withHeader = receivingRows
        .map((row) => ({ ...row, receiving_header_id: headerMap.get(String(row.document_no ?? '').trim()) ?? null }))
        .filter((row) => row.receiving_header_id)
      const { data: existingDetails } = await db.getExistingReceivingDetailKeys(client, ptrNos)
      const existingKeys = new Set(existingDetails.map(receivingDetailKey))
      const seen = new Set<string>()
      const toInsert = withHeader.filter((row) => {
        const key = receivingDetailKey(row)
        if (existingKeys.has(key) || seen.has(key)) return false
        seen.add(key)
        return true
      })
      const missingHeader = receivingRows.length - withHeader.length
      const inserted = toInsert.length && !options.dryRun ? (await db.insertReceivingDetailRows(client, toInsert)).inserted : (options.dryRun ? toInsert.length : 0)
      out.receiving = {
        inserted, skipped: receivingRows.length - inserted, total: receivingRows.length,
        note: missingHeader ? `${missingHeader} baris belum punya PTR Header` : undefined,
      }
    } catch (error) {
      out.errors.push(`Receiving: ${formatError(error)}`)
    }
  }

  // 2. Posted Assembly / Sales Shipment → outbound_detail (PAO dipetakan ke PSS).
  if (outboundRows.length) {
    const valid = outboundRows.filter((r) => r.entry_no !== null && r.entry_no !== undefined && !isNaN(Number(r.entry_no)) && r.document_no)
    try {
      const { data: matchingHeaders } = await db.getOutboundHeadersForPaoMatching(client)
      const { normalized } = normalizePaoToPss(valid, matchingHeaders ?? [])
      valid.forEach((row, i) => { if (normalized[i]) row.document_no = normalized[i] })
      const pssNos = [...new Set(valid.map((r) => String(r.document_no ?? '').trim()))].filter(Boolean)
      const { data: pssHeaders } = await db.getOutboundHeadersByPssNos(client, pssNos)
      const pssHeaderMap = new Map<string, number>()
      for (const h of pssHeaders) {
        if (h.pss_no) pssHeaderMap.set(String(h.pss_no).trim(), Number(h.id))
        if (h.shipment_no) pssHeaderMap.set(String(h.shipment_no).trim(), Number(h.id))
      }
      for (const row of valid) {
        const id = pssHeaderMap.get(String(row.document_no ?? '').trim())
        if (id) row.outbound_header_id = id
      }
      if (options.dryRun) {
        const entryNos = valid.map((r) => Number(r.entry_no))
        const existing = new Set<number>()
        for (let i = 0; i < entryNos.length; i += 500) {
          const { data } = await client.from('outbound_detail').select('entry_no').in('entry_no', entryNos.slice(i, i + 500))
          for (const r of data ?? []) existing.add(Number(r.entry_no))
        }
        const fresh = new Set(entryNos.filter((n) => !existing.has(n))).size
        out.outbound = { inserted: fresh, skipped: outboundRows.length - fresh, total: outboundRows.length }
      } else {
        const result = await db.insertOutboundDetailRows(client, valid)
        out.outbound = { inserted: result.inserted, skipped: outboundRows.length - result.inserted, total: outboundRows.length }
        try { await db.updateOutboundHeaderCreatedTimes(client, valid) } catch (err) { console.warn('Gagal update header created times:', err) }
      }
    } catch (error) {
      out.errors.push(`Outbound: ${formatError(error)}`)
    }
  }

  // 3. Transfer Shipment → crossdocking PTS.
  if (ptsRows.length) {
    try {
      if (options.dryRun) {
        const merged = db.mergePtsUploadRows(ptsRows)
        const { data } = await client.from('crossdocking_pts').select('pts_no').in('pts_no', merged.map((r) => r.pts_no))
        const existing = new Set((data ?? []).map((r) => r.pts_no))
        const fresh = merged.filter((r) => !existing.has(r.pts_no)).length
        out.pts = { inserted: fresh, skipped: merged.length - fresh, total: merged.length }
      } else {
        const { inserted, total } = await db.uploadPtsRecords(client, ptsRows, fileName)
        out.pts = { inserted, skipped: total - inserted, total }
      }
    } catch (error) {
      out.errors.push(`PTS: ${formatError(error)}`)
    }
  }
  return out
}
