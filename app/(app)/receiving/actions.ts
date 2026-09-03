'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getExistingReceivingHeaderPtrs(ptrs: string[]) {
  if (!ptrs.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .select('ptr_no')
    .in('ptr_no', ptrs)

  return { data: data ?? [], error }
}

export async function insertReceivingHeaderRows(rows: Record<string, any>[]) {
  if (!rows.length) return { inserted: 0 }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .insert(rows)
    .select()

  if (error) {
    throw error
  }

  return { inserted: data?.length ?? 0 }
}

/* ── PTR Detail helpers ─────────────────────────────────── */

export async function getReceivingHeadersByPtrs(ptrs: string[]) {
  if (!ptrs.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .select('id, ptr_no')
    .in('ptr_no', ptrs)

  return { data: data ?? [], error }
}

export async function getExistingReceivingDetailKeys(docNos: string[]) {
  if (!docNos.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_detail')
    .select('document_no, item_no, variant_code, lot_no, serial_no')
    .in('document_no', docNos)

  return { data: data ?? [], error }
}

export async function insertReceivingDetailRows(rows: Record<string, any>[]) {
  if (!rows.length) return { inserted: 0 }

  const { data, error } = await supabaseAdmin
    .from('receiving_detail')
    .insert(rows)
    .select()

  if (error) {
    throw error
  }

  return { inserted: data?.length ?? 0 }
}

export async function verifyReceivingData() {
  const { data: headers, error: headerError } = await supabaseAdmin
    .from('receiving_header')
    .select('id, ptr_no')
    .order('ptr_no')

  if (headerError) {
    throw headerError
  }

  const headerPtrs = new Set(
    (headers ?? []).map((h: any) => String(h.ptr_no ?? '').trim())
  )

  const { data: allDetails, error: detailsError } = await supabaseAdmin
    .from('receiving_detail')
    .select('id, document_no, item_no, description')

  if (detailsError) {
    throw detailsError
  }

  const orphanedDetails: { id: number | string; document_no: string; item_no: string; description: string }[] = []
  const detailDocNoSet = new Set<string>()

  for (const d of allDetails ?? []) {
    const docNo = String(d.document_no ?? '').trim()
    detailDocNoSet.add(docNo)
    if (!headerPtrs.has(docNo)) {
      orphanedDetails.push({
        id: d.id,
        document_no: docNo,
        item_no: String(d.item_no ?? ''),
        description: String(d.description ?? ''),
      })
    }
  }

  const emptyHeaders: { id: string | number; ptr_no: string }[] = []
  for (const h of headers ?? []) {
    const ptrNo = String(h.ptr_no ?? '').trim()
    if (!detailDocNoSet.has(ptrNo)) {
      emptyHeaders.push({ id: h.id, ptr_no: ptrNo })
    }
  }

  return {
    orphanedDetails,
    orphanedCount: orphanedDetails.length,
    emptyHeaders,
    emptyHeadersCount: emptyHeaders.length,
    totalHeaders: headers?.length ?? 0,
    totalDetails: allDetails?.length ?? 0,
  }
}

export async function getItemMasterNames(itemNos: string[]) {
  if (!itemNos.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('master_sku')
    .select('sku_code, item_name')
    .in('sku_code', itemNos)

  return { data: data ?? [], error }
}

export async function getReceivingFullData(ptrNo: string) {
  if (!ptrNo) return { header: null, details: [], error: null }

  const { data: header, error: headerError } = await supabaseAdmin
    .from('receiving_header')
    .select('*')
    .eq('ptr_no', ptrNo)
    .single()

  if (headerError) {
    return { header: null, details: [], error: headerError }
  }

  const { data: details, error: detailsError } = await supabaseAdmin
    .from('receiving_detail')
    .select('id, document_no, document_line_no, item_no, description, quantity, lot_no, expiration_date, entry_no')
    .eq('document_no', ptrNo)
    .order('id')

  if (detailsError) {
    return { header, details: [], error: detailsError }
  }

  const itemNos = [...new Set((details ?? []).map((d) => String(d.item_no ?? '').trim()).filter(Boolean))]
  const { data: itemMasters } = await getItemMasterNames(itemNos)
  const itemNameMap = new Map(
    (itemMasters ?? []).map((m: any) => [String(m.sku_code ?? '').trim(), m.item_name ?? ''])
  )

  const enrichedDetails = (details ?? []).map((d) => ({
    ...d,
    item_name: itemNameMap.get(String(d.item_no ?? '').trim()) ?? d.description ?? '',
  }))

   return { header, details: enrichedDetails, error: null }
}

export async function updateShipmentDate(headerId: string | number, newDate: string) {
  const { error } = await supabaseAdmin
    .from('receiving_header')
    .update({ shipment_date: newDate, updated_at: new Date().toISOString() })
    .eq('id', headerId)

  if (error) {
    throw error
  }
}

