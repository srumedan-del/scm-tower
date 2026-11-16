'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'
// Logika impor NAV dipakai bersama dengan scripts/nav-sync (lib/nav-import/db.ts).
import * as navDb from '@/lib/nav-import/db'

/* ── Outbound Header (PSS Header) ───────────────────────── */

export async function getExistingOutboundHeaderPssNos(shipmentNos: string[]) {
  await requireAuthenticatedUser()
  return navDb.getExistingOutboundHeaderPssNos(supabaseAdmin, shipmentNos)
}

export async function insertOutboundHeaderRows(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  return navDb.insertOutboundHeaderRows(supabaseAdmin, rows)
}

export async function syncOutboundHeadersWithExistingDetails(pssNos: string[]) {
  await requireAuthenticatedUser()
  return navDb.syncOutboundHeadersWithExistingDetails(supabaseAdmin, pssNos)
}

export async function getOutboundHeadersByPssNos(pssNos: string[]) {
  await requireAuthenticatedUser()
  return navDb.getOutboundHeadersByPssNos(supabaseAdmin, pssNos)
}

export async function getOutboundHeadersForPaoMatching() {
  await requireAuthenticatedUser()
  return navDb.getOutboundHeadersForPaoMatching(supabaseAdmin)
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
  return navDb.insertOutboundDetailRows(supabaseAdmin, rows)
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
  return navDb.updateOutboundHeaderCreatedTimes(supabaseAdmin, rows)
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
