'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

/* ── Outbound Header (PSS Header) ───────────────────────── */

export async function getExistingOutboundHeaderPssNos(shipmentNos: string[]) {
  await requireAuthenticatedUser()
  if (!shipmentNos.length) return { data: [], error: null }

  const CHUNK = 500
  const allData: any[] = []

  for (let i = 0; i < shipmentNos.length; i += CHUNK) {
    const chunk = shipmentNos.slice(i, i + CHUNK)
    const { data, error } = await supabaseAdmin
      .from('outbound_header')
      .select('pss_no, shipment_no')
      .in('shipment_no', chunk)
    if (error) return { data: [], error }
    allData.push(...(data ?? []))
  }

  return { data: allData, error: null }
}

export async function insertOutboundHeaderRows(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  if (!rows.length) return { inserted: 0, skipped: 0 }

  const shipmentNos = rows
    .map((r) => String(r.shipment_no ?? r.pss_no ?? '').trim())
    .filter(Boolean)

  // Cek existing dalam chunk
  const CHUNK = 500
  const existingAll: any[] = []
  for (let i = 0; i < shipmentNos.length; i += CHUNK) {
    const chunk = shipmentNos.slice(i, i + CHUNK)
    const { data } = await supabaseAdmin
      .from('outbound_header')
      .select('shipment_no')
      .in('shipment_no', chunk)
    existingAll.push(...(data ?? []))
  }

  const existingSet = new Set(
    existingAll.map((r: any) => String(r.shipment_no ?? '').trim())
  )

  const seen = new Set<string>()
  const toInsert = rows.filter((r) => {
    const key = String(r.shipment_no ?? r.pss_no ?? '').trim()
    if (!key || existingSet.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const skipped = rows.length - toInsert.length
  if (!toInsert.length) return { inserted: 0, skipped }

  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data, error } = await supabaseAdmin
      .from('outbound_header')
      .insert(batch)
      .select()
    if (error) throw error
    inserted += data?.length ?? 0
  }

  // Auto-sync with existing outbound_detail (link foreign key & propagate timestamps)
  try {
    const insertedShipmentNos = toInsert
      .map((r) => String(r.shipment_no ?? r.pss_no ?? '').trim())
      .filter(Boolean)
    await syncOutboundHeadersWithExistingDetails(insertedShipmentNos)
  } catch (err) {
    console.warn('Auto-sync outbound details failed:', err)
  }

  return { inserted, skipped }
}

export async function syncOutboundHeadersWithExistingDetails(pssNos: string[]) {
  await requireAuthenticatedUser()
  if (!pssNos.length) return { linked: 0, timestampsSynced: 0 }

  const CHUNK = 500
  let linked = 0
  let timestampsSynced = 0

  for (let i = 0; i < pssNos.length; i += CHUNK) {
    const chunk = pssNos.slice(i, i + CHUNK)

    const { data: headers } = await supabaseAdmin
      .from('outbound_header')
      .select('id, pss_no, shipment_no, document_created_at')
      .or(`pss_no.in.(${chunk.join(',')}),shipment_no.in.(${chunk.join(',')})`)

    if (!headers || !headers.length) continue

    const headerMap = new Map<string, { id: number; document_created_at: string | null }>()
    for (const h of headers) {
      if (h.pss_no) headerMap.set(String(h.pss_no).trim(), { id: h.id, document_created_at: h.document_created_at })
      if (h.shipment_no) headerMap.set(String(h.shipment_no).trim(), { id: h.id, document_created_at: h.document_created_at })
    }

    const { data: details } = await supabaseAdmin
      .from('outbound_detail')
      .select('id, document_no, document_created_at, outbound_header_id')
      .in('document_no', chunk)

    if (!details || !details.length) continue

    const detailsToLink = details.filter((d) => !d.outbound_header_id)
    for (const d of detailsToLink) {
      const match = headerMap.get(String(d.document_no).trim())
      if (match) {
        await supabaseAdmin
          .from('outbound_detail')
          .update({ outbound_header_id: match.id })
          .eq('id', d.id)
        linked++
      }
    }

    const earliestByDoc = new Map<string, string>()
    for (const d of details) {
      if (!d.document_created_at) continue
      const docNo = String(d.document_no).trim()
      const prev = earliestByDoc.get(docNo)
      if (!prev || new Date(d.document_created_at).getTime() < new Date(prev).getTime()) {
        earliestByDoc.set(docNo, d.document_created_at)
      }
    }

    for (const [docNo, isoTime] of earliestByDoc.entries()) {
      const h = headerMap.get(docNo)
      if (h && (!h.document_created_at || h.document_created_at.includes('T00:00:00'))) {
        await supabaseAdmin
          .from('outbound_header')
          .update({ document_created_at: isoTime })
          .eq('id', h.id)
        timestampsSynced++
      }
    }
  }

  return { linked, timestampsSynced }
}

export async function getOutboundHeadersByPssNos(pssNos: string[]) {
  await requireAuthenticatedUser()
  if (!pssNos.length) return { data: [], error: null }

  // Ambil dari kedua kolom karena data lama bisa hanya mengisi shipment_no.
  const CHUNK = 500
  const allData: any[] = []

  for (let i = 0; i < pssNos.length; i += CHUNK) {
    const chunk = pssNos.slice(i, i + CHUNK)
      const [{ data: pssData, error: pssError }, { data: shipmentData, error: shipmentError }] = await Promise.all([
      supabaseAdmin
      .from('outbound_header')
      .select('id, pss_no, shipment_no')
        .in('pss_no', chunk),
      supabaseAdmin
        .from('outbound_header')
        .select('id, pss_no, shipment_no')
        .in('shipment_no', chunk),
    ])
      if (pssError) return { data: [], error: pssError }
      if (shipmentError) return { data: [], error: shipmentError }
    allData.push(...(pssData ?? []), ...(shipmentData ?? []))
  }

  const uniqueData = [...new Map(allData.map(row => [row.id, row])).values()]
  return { data: uniqueData, error: null }
}

export async function getOutboundHeadersForPaoMatching() {
  await requireAuthenticatedUser()
  const PAGE_SIZE = 1000
  const allData: any[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('outbound_header')
      .select('id, pss_no, shipment_no, document_created_at, document_date, project, branch_representative, location_code')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) return { data: [], error }
    allData.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return { data: allData, error: null }
}

export async function getOutboundDetailHeaderIds(headerIds: number[]) {
  await requireAuthenticatedUser()
  if (!headerIds.length) return { data: [], error: null }

  const CHUNK = 500
  const allData: any[] = []
  for (let i = 0; i < headerIds.length; i += CHUNK) {
    const chunk = headerIds.slice(i, i + CHUNK)
    const { data, error } = await supabaseAdmin
      .from('outbound_detail')
      .select('outbound_header_id')
      .in('outbound_header_id', chunk)
    if (error) return { data: [], error }
    allData.push(...(data ?? []))
  }

  return { data: allData, error: null }
}

/* ── Outbound Detail (ILE) ──────────────────────────────── */

export async function getExistingOutboundDetailEntryNos(entryNos: number[]) {
  await requireAuthenticatedUser()
  if (!entryNos.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('outbound_detail')
    .select('entry_no')
    .in('entry_no', entryNos)

    if (error) return { data: [], error }
  return { data: data ?? [], error }
}

export async function updateOutboundDetailDocumentLinks(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  const updates = rows.filter(row =>
    row.entry_no !== null && row.entry_no !== undefined && row.document_no && row.outbound_header_id
  )

  let updated = 0
  const BATCH = 500
  for (let index = 0; index < updates.length; index += BATCH) {
    const batch = updates.slice(index, index + BATCH)
    const results = await Promise.all(batch.map(row =>
      supabaseAdmin
        .from('outbound_detail')
        .update({
          document_no: String(row.document_no).trim(),
          outbound_header_id: Number(row.outbound_header_id),
        })
        .eq('entry_no', Number(row.entry_no))
        .select('id')
    ))
    for (const { data, error } of results) {
      if (error) throw error
      updated += data?.length ?? 0
    }
  }

  return { updated }
}

export async function insertOutboundDetailRows(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  if (!rows.length) return { inserted: 0, skipped: 0 }

  // entry_no adalah NOT NULL constraint di DB — drop baris tanpa entry_no
  const validRows = rows.filter(
    (r) => r.entry_no !== null && r.entry_no !== undefined && !isNaN(Number(r.entry_no))
  )
  const droppedCount = rows.length - validRows.length

  if (!validRows.length) return { inserted: 0, skipped: droppedCount }

  // Cek existing entry_no di DB dalam chunk
  const CHUNK = 500
  const entryNos = validRows.map((r) => Number(r.entry_no))
  const existingSet = new Set<number>()

  for (let i = 0; i < entryNos.length; i += CHUNK) {
    const chunk = entryNos.slice(i, i + CHUNK)
    const { data: existing } = await supabaseAdmin
      .from('outbound_detail')
      .select('entry_no')
      .in('entry_no', chunk)
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

  // Insert dalam batch besar secara parallel (max 3 concurrent)
  const BATCH = 500
  const batches: Record<string, any>[][] = []
  for (let i = 0; i < toInsert.length; i += BATCH) {
    batches.push(toInsert.slice(i, i + BATCH))
  }

  let inserted = 0
  const CONCURRENCY = 3
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const concurrent = batches.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      concurrent.map((batch) =>
        supabaseAdmin.from('outbound_detail').insert(batch).select()
      )
    )
    for (const { data, error } of results) {
      if (error) throw error
      inserted += data?.length ?? 0
    }
  }

  return { inserted, skipped }
}

/** Isi timestamp NAV pada detail yang telah ada ketika file ILE di-upload ulang. */
export async function updateOutboundDetailCreatedTimes(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  const updates = rows.filter(row =>
    row.entry_no !== null && row.entry_no !== undefined && row.document_created_at
  )

  let updated = 0
  const BATCH = 500
  for (let index = 0; index < updates.length; index += BATCH) {
    const batch = updates.slice(index, index + BATCH)
    const results = await Promise.all(batch.map(row =>
      supabaseAdmin
        .from('outbound_detail')
        .update({ document_created_at: row.document_created_at })
        .eq('entry_no', Number(row.entry_no))
        .is('document_created_at', null)
        .select('id')
    ))
    for (const { data, error } of results) {
      if (error) throw error
      updated += data?.length ?? 0
    }
  }
  return { updated }
}

/** Propagate the earliest NAV document timestamp for each PSS to its header. */
export async function updateOutboundHeaderCreatedTimes(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  const earliestByDocument = new Map<string, string>()

  for (const row of rows) {
    const documentNo = String(row.document_no ?? '').trim()
    const createdAt = row.document_created_at
    if (!documentNo || !createdAt) continue

    const previous = earliestByDocument.get(documentNo)
    if (!previous || new Date(createdAt).getTime() < new Date(previous).getTime()) {
      earliestByDocument.set(documentNo, createdAt)
    }
  }

  let updated = 0
  for (const [documentNo, documentCreatedAt] of earliestByDocument) {
    const { data, error } = await supabaseAdmin
      .from('outbound_header')
      .update({ document_created_at: documentCreatedAt })
      .or(`pss_no.eq.${documentNo},shipment_no.eq.${documentNo}`)
      .select('id')

    if (error) throw error
    updated += data?.length ?? 0
  }

  return { updated }
}

/* ── Outbound Full Data (modal detail) ──────────────────── */

export async function getOutboundFullData(pssNo: string) {
  await requireAuthenticatedUser()
  if (!pssNo) return { header: null, details: [], customer: null, excludedItems: [], error: null }

  // 1. Ambil header
  const { data: header, error: headerError } = await supabaseAdmin
    .from('outbound_header')
    .select('*')
    .eq('pss_no', pssNo)
    .single()

  if (headerError) return { header: null, details: [], customer: null, excludedItems: [], error: headerError }

  // 2. Ambil detail
  const { data: details, error: detailError } = await supabaseAdmin
    .from('outbound_detail')
    .select(
      'id, document_no, item_no, description, quantity, qty_out, ' +
      'location_code, lot_no, expiration_date, entry_no, posting_date, entry_type'
    )
    .eq('document_no', pssNo)
    .order('entry_no', { ascending: true })

  if (detailError) return { header, details: [], customer: null, excludedItems: [], error: detailError }

  // 3. Enrich deskripsi dari master_sku
  const itemNos = [...new Set((details as any[]).map((d: any) => String(d.item_no ?? '').trim()).filter(Boolean))]
  const skuMap = new Map<string, string>()

  if (itemNos.length > 0) {
    const { data: skus } = await supabaseAdmin
      .from('master_sku')
      .select('sku_code, item_name')
      .in('sku_code', itemNos)

    for (const sku of skus ?? []) {
      skuMap.set(String(sku.sku_code).trim(), sku.item_name ?? '')
    }
  }

  const isAssemblyParent = (itemNo: string | null | undefined): boolean => {
    if (!itemNo) return false
    const clean = itemNo.trim().toUpperCase()
    return clean.startsWith('HD SET') || clean.startsWith('HD-SET') || /^HD\s*SET/i.test(clean)
  }

  const excludedItems = (details as any[])
    .filter((d) => isAssemblyParent(d.item_no))
    .map((d) => String(d.item_no ?? '').trim())

  // 4. Tampilkan semua detail yang di-upload, kecuali item assembly kit parent (seperti HD SET ...)
  // yang bukan merupakan komponen fisik dengan Lot & Expired Date.
  const enrichedDetails = (details as any[])
    .map((d) => {
      const itemNo = String(d.item_no ?? '').trim()
      return {
        ...d,
        description: skuMap.get(itemNo) || d.description || itemNo || null,
      }
    })
    .filter((d) => !isAssemblyParent(d.item_no))

  // 5. Ambil alamat customer dari tabel customers
  const customerNo = (header as any)?.customer_no ?? null
  let customer: { customer_name: string; address: string; city: string } | null = null

  if (customerNo) {
    const { data: cust } = await supabaseAdmin
      .from('customers')
      .select('customer_name, address, city')
      .eq('customer_code', customerNo)
      .single()

    if (cust) {
      customer = cust as { customer_name: string; address: string; city: string }
    }
  }

  return { header, details: enrichedDetails, customer, excludedItems, error: null }
}
