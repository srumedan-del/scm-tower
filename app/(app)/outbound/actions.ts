'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

/* ── Outbound Header (PSS Header) ───────────────────────── */

export async function getExistingOutboundHeaderPssNos(shipmentNos: string[]) {
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

  return { inserted, skipped }
}

export async function getOutboundHeadersByPssNos(pssNos: string[]) {
  if (!pssNos.length) return { data: [], error: null }

  // pss_no dan shipment_no selalu sama nilainya di DB kita
  // cukup query by pss_no saja, chunk 500 untuk hindari URL limit
  const CHUNK = 500
  const allData: any[] = []

  for (let i = 0; i < pssNos.length; i += CHUNK) {
    const chunk = pssNos.slice(i, i + CHUNK)
    const { data } = await supabaseAdmin
      .from('outbound_header')
      .select('id, pss_no, shipment_no')
      .in('pss_no', chunk)
    allData.push(...(data ?? []))
  }

  return { data: allData, error: null }
}

/* ── Outbound Detail (ILE) ──────────────────────────────── */

export async function getExistingOutboundDetailEntryNos(entryNos: number[]) {
  if (!entryNos.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('outbound_detail')
    .select('entry_no')
    .in('entry_no', entryNos)

  return { data: data ?? [], error }
}

export async function insertOutboundDetailRows(rows: Record<string, any>[]) {
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

/* ── Outbound Full Data (modal detail) ──────────────────── */

export async function getOutboundFullData(pssNo: string) {
  if (!pssNo) return { header: null, details: [], customer: null, error: null }

  // 1. Ambil header
  const { data: header, error: headerError } = await supabaseAdmin
    .from('outbound_header')
    .select('*')
    .eq('pss_no', pssNo)
    .single()

  if (headerError) return { header: null, details: [], customer: null, error: headerError }

  // 2. Ambil detail
  const { data: details, error: detailError } = await supabaseAdmin
    .from('outbound_detail')
    .select(
      'id, document_no, item_no, description, quantity, qty_out, ' +
      'location_code, lot_no, expiration_date, entry_no, posting_date, entry_type'
    )
    .eq('document_no', pssNo)
    .order('entry_no', { ascending: true })

  if (detailError) return { header, details: [], customer: null, error: detailError }

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

  // 4. Filter: hapus baris item_no mengandung "HD SET" yang tidak punya deskripsi di master_sku
  const enrichedDetails = (details as any[])
    .map((d) => ({
      ...d,
      description: skuMap.get(String(d.item_no ?? '').trim()) || d.description || null,
    }))
    .filter((d) => {
      const itemNo = String(d.item_no ?? '').toUpperCase()
      const hasHdSet = itemNo.includes('HD SET')
      const hasDesc = !!d.description
      // Sembunyikan kalau item_no mengandung "HD SET" DAN tidak ada deskripsi
      return !(hasHdSet && !hasDesc)
    })

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

  return { header, details: enrichedDetails, customer, error: null }
}
