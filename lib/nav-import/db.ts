/**
 * Operasi database untuk impor NAV. Menerima Supabase client (service role) sebagai parameter,
 * sehingga server action (setelah cek login) dan scripts/nav-sync memakai logika yang sama.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { pssKey, type PtsUploadRow, type RawRow } from './map'

export type Db = SupabaseClient<any>
const CHUNK = 500

// ── Outbound header (PSS) ───────────────────────────────────────────────────

export async function getExistingOutboundHeaderPssNos(db: Db, shipmentNos: string[]) {
  if (!shipmentNos.length) return { data: [] as any[], error: null }
  const allData: any[] = []
  for (let i = 0; i < shipmentNos.length; i += CHUNK) {
    const { data, error } = await db.from('outbound_header').select('pss_no, shipment_no').in('shipment_no', shipmentNos.slice(i, i + CHUNK))
    if (error) return { data: [] as any[], error }
    allData.push(...(data ?? []))
  }
  return { data: allData, error: null }
}

export async function insertOutboundHeaderRows(db: Db, rows: RawRow[]) {
  if (!rows.length) return { inserted: 0, skipped: 0 }
  const shipmentNos = rows.map(pssKey).filter(Boolean)
  const existingAll: any[] = []
  for (let i = 0; i < shipmentNos.length; i += CHUNK) {
    const { data } = await db.from('outbound_header').select('shipment_no').in('shipment_no', shipmentNos.slice(i, i + CHUNK))
    existingAll.push(...(data ?? []))
  }
  const existingSet = new Set(existingAll.map((r: any) => String(r.shipment_no ?? '').trim()))
  const seen = new Set<string>()
  const toInsert = rows.filter((r) => {
    const key = pssKey(r)
    if (!key || existingSet.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const skipped = rows.length - toInsert.length
  if (!toInsert.length) return { inserted: 0, skipped }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 50) {
    const { data, error } = await db.from('outbound_header').insert(toInsert.slice(i, i + 50)).select()
    if (error) throw error
    inserted += data?.length ?? 0
  }
  // Sambungkan detail yang sudah ada lebih dulu (FK + timestamp NAV).
  try {
    await syncOutboundHeadersWithExistingDetails(db, toInsert.map(pssKey).filter(Boolean))
  } catch (err) {
    console.warn('Auto-sync outbound details failed:', err)
  }
  return { inserted, skipped }
}

export async function syncOutboundHeadersWithExistingDetails(db: Db, pssNos: string[]) {
  if (!pssNos.length) return { linked: 0, timestampsSynced: 0 }
  let linked = 0
  let timestampsSynced = 0
  for (let i = 0; i < pssNos.length; i += CHUNK) {
    const chunk = pssNos.slice(i, i + CHUNK)
    const { data: headers } = await db
      .from('outbound_header')
      .select('id, pss_no, shipment_no, document_created_at')
      .or(`pss_no.in.(${chunk.join(',')}),shipment_no.in.(${chunk.join(',')})`)
    if (!headers || !headers.length) continue
    const headerMap = new Map<string, { id: number; document_created_at: string | null }>()
    for (const h of headers) {
      if (h.pss_no) headerMap.set(String(h.pss_no).trim(), { id: h.id, document_created_at: h.document_created_at })
      if (h.shipment_no) headerMap.set(String(h.shipment_no).trim(), { id: h.id, document_created_at: h.document_created_at })
    }
    const { data: details } = await db
      .from('outbound_detail')
      .select('id, document_no, document_created_at, outbound_header_id')
      .in('document_no', chunk)
    if (!details || !details.length) continue

    for (const d of details.filter((detail) => !detail.outbound_header_id)) {
      const match = headerMap.get(String(d.document_no).trim())
      if (match) {
        await db.from('outbound_detail').update({ outbound_header_id: match.id }).eq('id', d.id)
        linked++
      }
    }
    const earliestByDoc = new Map<string, string>()
    for (const d of details) {
      if (!d.document_created_at) continue
      const docNo = String(d.document_no).trim()
      const prev = earliestByDoc.get(docNo)
      if (!prev || new Date(d.document_created_at).getTime() < new Date(prev).getTime()) earliestByDoc.set(docNo, d.document_created_at)
    }
    for (const [docNo, isoTime] of earliestByDoc.entries()) {
      const h = headerMap.get(docNo)
      if (h && (!h.document_created_at || h.document_created_at.includes('T00:00:00'))) {
        await db.from('outbound_header').update({ document_created_at: isoTime }).eq('id', h.id)
        timestampsSynced++
      }
    }
  }
  return { linked, timestampsSynced }
}

export async function getOutboundHeadersByPssNos(db: Db, pssNos: string[]) {
  if (!pssNos.length) return { data: [] as any[], error: null }
  // Data lama bisa hanya mengisi shipment_no, jadi cari di kedua kolom.
  const allData: any[] = []
  for (let i = 0; i < pssNos.length; i += CHUNK) {
    const chunk = pssNos.slice(i, i + CHUNK)
    const [{ data: pssData, error: pssError }, { data: shipmentData, error: shipmentError }] = await Promise.all([
      db.from('outbound_header').select('id, pss_no, shipment_no').in('pss_no', chunk),
      db.from('outbound_header').select('id, pss_no, shipment_no').in('shipment_no', chunk),
    ])
    if (pssError) return { data: [] as any[], error: pssError }
    if (shipmentError) return { data: [] as any[], error: shipmentError }
    allData.push(...(pssData ?? []), ...(shipmentData ?? []))
  }
  return { data: [...new Map(allData.map((row) => [row.id, row])).values()], error: null }
}

export async function getOutboundHeadersForPaoMatching(db: Db) {
  const PAGE_SIZE = 1000
  const allData: any[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from('outbound_header')
      .select('id, pss_no, shipment_no, document_created_at, document_date, project, branch_representative, location_code')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return { data: [] as any[], error }
    allData.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return { data: allData, error: null }
}

// ── Outbound detail (ILE) ───────────────────────────────────────────────────

export async function insertOutboundDetailRows(db: Db, rows: RawRow[]) {
  if (!rows.length) return { inserted: 0, skipped: 0 }
  // entry_no NOT NULL di DB.
  const validRows = rows.filter((r) => r.entry_no !== null && r.entry_no !== undefined && !isNaN(Number(r.entry_no)))
  if (!validRows.length) return { inserted: 0, skipped: rows.length }
  const entryNos = validRows.map((r) => Number(r.entry_no))
  const existingSet = new Set<number>()
  for (let i = 0; i < entryNos.length; i += CHUNK) {
    const { data: existing } = await db.from('outbound_detail').select('entry_no').in('entry_no', entryNos.slice(i, i + CHUNK))
    for (const r of existing ?? []) existingSet.add(Number(r.entry_no))
  }
  const seenNos = new Set<number>()
  const toInsert = validRows.filter((r) => {
    const en = Number(r.entry_no)
    if (existingSet.has(en) || seenNos.has(en)) return false
    seenNos.add(en)
    return true
  })
  const skipped = rows.length - toInsert.length
  if (!toInsert.length) return { inserted: 0, skipped }

  const batches: RawRow[][] = []
  for (let i = 0; i < toInsert.length; i += 500) batches.push(toInsert.slice(i, i + 500))
  let inserted = 0
  for (let i = 0; i < batches.length; i += 3) {
    const results = await Promise.all(batches.slice(i, i + 3).map((batch) => db.from('outbound_detail').insert(batch).select()))
    for (const { data, error } of results) {
      if (error) throw error
      inserted += data?.length ?? 0
    }
  }
  return { inserted, skipped }
}

/** Timestamp dokumen NAV paling awal per PSS diteruskan ke header. */
export async function updateOutboundHeaderCreatedTimes(db: Db, rows: RawRow[]) {
  const earliestByDocument = new Map<string, string>()
  for (const row of rows) {
    const documentNo = String(row.document_no ?? '').trim()
    const createdAt = row.document_created_at
    if (!documentNo || !createdAt) continue
    const previous = earliestByDocument.get(documentNo)
    if (!previous || new Date(createdAt).getTime() < new Date(previous).getTime()) earliestByDocument.set(documentNo, createdAt)
  }
  let updated = 0
  for (const [documentNo, documentCreatedAt] of earliestByDocument) {
    const { data, error } = await db
      .from('outbound_header')
      .update({ document_created_at: documentCreatedAt })
      .or(`pss_no.eq.${documentNo},shipment_no.eq.${documentNo}`)
      .select('id')
    if (error) throw error
    updated += data?.length ?? 0
  }
  return { updated }
}

// ── Receiving (PTR) ─────────────────────────────────────────────────────────

export async function getExistingReceivingHeaderPtrs(db: Db, ptrs: string[]) {
  if (!ptrs.length) return { data: [] as any[], error: null }
  const { data, error } = await db.from('receiving_header').select('ptr_no').in('ptr_no', ptrs)
  return { data: data ?? [], error }
}

export async function insertReceivingHeaderRows(db: Db, rows: RawRow[]) {
  if (!rows.length) return { inserted: 0 }
  const { data, error } = await db.from('receiving_header').insert(rows).select()
  if (error) throw error
  return { inserted: data?.length ?? 0 }
}

export async function getReceivingHeadersByPtrs(db: Db, ptrs: string[]) {
  if (!ptrs.length) return { data: [] as any[], error: null }
  const { data, error } = await db.from('receiving_header').select('id, ptr_no').in('ptr_no', ptrs)
  return { data: data ?? [], error }
}

export async function getExistingReceivingDetailKeys(db: Db, docNos: string[]) {
  if (!docNos.length) return { data: [] as any[], error: null }
  const { data, error } = await db.from('receiving_detail').select('document_no, item_no, variant_code, lot_no, serial_no').in('document_no', docNos)
  return { data: data ?? [], error }
}

export async function insertReceivingDetailRows(db: Db, rows: RawRow[]) {
  if (!rows.length) return { inserted: 0 }
  const { data, error } = await db.from('receiving_detail').insert(rows).select()
  if (error) throw error
  return { inserted: data?.length ?? 0 }
}

// ── Crossdocking PTS (Transfer Shipment) ────────────────────────────────────

// File ILE berisi satu baris per item/lot, jadi satu PTS bisa muncul berkali-kali.
export function mergePtsUploadRows(rows: PtsUploadRow[]) {
  const merged = new Map<string, Required<PtsUploadRow>>()
  for (const row of rows) {
    const ptsNo = String(row.pts_no ?? '').trim().toUpperCase()
    if (!ptsNo) continue
    const transferOrderNo = row.transfer_order_no ? String(row.transfer_order_no).trim().toUpperCase() : null
    const current = merged.get(ptsNo)
    if (current) {
      current.document_date ||= row.document_date || null
      current.document_created_at ||= row.document_created_at || null
      current.transfer_order_no ||= transferOrderNo
      current.details.push(...(row.details ?? []))
    } else {
      merged.set(ptsNo, {
        pts_no: ptsNo,
        document_date: row.document_date || null,
        document_created_at: row.document_created_at || null,
        transfer_order_no: transferOrderNo,
        details: [...(row.details ?? [])],
      })
    }
  }
  return [...merged.values()]
}

export async function uploadPtsRecords(db: Db, rows: PtsUploadRow[], sourceFileName: string) {
  const uniqueRows = mergePtsUploadRows(rows)
  if (uniqueRows.length === 0) throw new Error('Tidak ditemukan nomor PTS pada file.')
  const { data: existing, error: existingError } = await db.from('crossdocking_pts').select('pts_no').in('pts_no', uniqueRows.map((row) => row.pts_no))
  if (existingError) throw existingError
  const existingNos = new Set((existing ?? []).map((row) => row.pts_no))
  const newRows = uniqueRows.filter((row) => !existingNos.has(row.pts_no))
  if (newRows.length === 0) return { inserted: 0, total: uniqueRows.length }

  const { data, error } = await db
    .from('crossdocking_pts')
    .insert(newRows.map(({ details: _details, ...row }) => ({ ...row, source_file_name: sourceFileName })))
    .select('id, pts_no')
  if (error) throw error
  const idByPts = new Map((data ?? []).map((row) => [row.pts_no, row.id]))
  const detailRows = newRows
    .flatMap((row) => row.details.map((detail) => ({ ...detail, crossdocking_pts_id: idByPts.get(row.pts_no) })))
    .filter((row) => row.crossdocking_pts_id)
  if (detailRows.length) {
    const { error: detailError } = await db.from('crossdocking_pts_detail').insert(detailRows)
    if (detailError) throw detailError
  }
  return { inserted: data?.length ?? 0, total: uniqueRows.length }
}
