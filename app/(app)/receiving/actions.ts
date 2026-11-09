'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export async function getExistingReceivingHeaderPtrs(ptrs: string[]) {
  await requireAuthenticatedUser()
  if (!ptrs.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .select('ptr_no')
    .in('ptr_no', ptrs)

  return { data: data ?? [], error }
}

export async function insertReceivingHeaderRows(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
  if (!ptrs.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .select('id, ptr_no')
    .in('ptr_no', ptrs)

  return { data: data ?? [], error }
}

export async function getExistingReceivingDetailKeys(docNos: string[]) {
  await requireAuthenticatedUser()
  if (!docNos.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_detail')
    .select('document_no, item_no, variant_code, lot_no, serial_no')
    .in('document_no', docNos)

  return { data: data ?? [], error }
}

export async function insertReceivingDetailRows(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
  if (!itemNos.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('master_sku')
    .select('sku_code, item_name')
    .in('sku_code', itemNos)

  return { data: data ?? [], error }
}

export async function getReceivingFullData(ptrNo: string) {
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin
    .from('receiving_header')
    .update({ shipment_date: newDate, updated_at: new Date().toISOString() })
    .eq('id', headerId)

  if (error) {
    throw error
  }
}

export async function updateReceivingTransportDetails(
  headerId: string | number,
  payload: {
    transport_mode: 'DARAT' | 'LAUT' | 'UDARA' | null
    land_vendor_code: string | null
    sea_vendor_code: string | null
    air_vendor_code: string | null
    container_no: string | null
  }
) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin
    .from('receiving_header')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', headerId)

  if (error) throw error
}

export async function getReceivingVendorHistory(): Promise<string[]> {
  await requireAuthenticatedUser()
  try {
    const { data: receivingData } = await supabaseAdmin
      .from('receiving_header')
      .select('sea_vendor_code, land_vendor_code, air_vendor_code, shipping_agent_code')
      .limit(1000)

    const vendors = new Set<string>()

    for (const r of receivingData ?? []) {
      for (const val of [r.sea_vendor_code, r.land_vendor_code, r.air_vendor_code, r.shipping_agent_code]) {
        if (typeof val === 'string' && val.trim()) {
          vendors.add(val.trim().toUpperCase())
        }
      }
    }

    const { data: vData } = await supabaseAdmin
      .from('vendors')
      .select('name')
      .limit(100)

    for (const v of vData ?? []) {
      if (typeof v?.name === 'string' && v.name.trim()) {
        vendors.add(v.name.trim().toUpperCase())
      }
    }

    return Array.from(vendors).sort()
  } catch (error) {
    console.error('Error fetching vendor history:', error)
    return []
  }
}
