'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type CrossdockingHeader = {
  id: number
  crossdocking_no: string
  customer_code: string | null
  customer_name: string | null
  destination_address: string | null
  hq_reference_no: string | null
  received_from_hq_date: string
  promised_delivery_date: string
  status: 'Draft' | 'Ready' | 'Dispatched' | 'Delivered'
  notes: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type CrossdockingDetail = {
  id: number
  crossdocking_id: number
  item_no: string | null
  description: string | null
  quantity: number
  uom: string | null
  lot_no: string | null
  expiration_date: string | null
  notes: string | null
  created_at: string | null
  // enriched
  item_name?: string | null
}

export type SkuOption = { sku_code: string; item_name: string; uom: string | null }
export type CustomerOption = { customer_code: string; customer_name: string; city: string | null }

/* ── Header ─────────────────────────────────────────────── */

export async function getCrossdockings() {
  const { data, error } = await supabaseAdmin
    .from('crossdocking_header')
    .select('*')
    .order('promised_delivery_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as CrossdockingHeader[]
}

export async function getCrossdockingById(id: number) {
  const { data: header, error: hErr } = await supabaseAdmin
    .from('crossdocking_header')
    .select('*')
    .eq('id', id)
    .single()
  if (hErr) throw hErr

  const { data: details, error: dErr } = await supabaseAdmin
    .from('crossdocking_detail')
    .select('*')
    .eq('crossdocking_id', id)
    .order('id')
  if (dErr) throw dErr

  // Enrich item_name dari master_sku
  const itemNos = [...new Set((details ?? []).map((d: any) => d.item_no).filter(Boolean))]
  let skuMap = new Map<string, string>()
  if (itemNos.length > 0) {
    const { data: skus } = await supabaseAdmin
      .from('master_sku')
      .select('sku_code, item_name')
      .in('sku_code', itemNos)
    for (const s of skus ?? []) skuMap.set(s.sku_code, s.item_name)
  }

  const enrichedDetails = (details ?? []).map((d: any) => ({
    ...d,
    item_name: skuMap.get(d.item_no ?? '') || d.description || null,
  })) as CrossdockingDetail[]

  return { header: header as CrossdockingHeader, details: enrichedDetails }
}

export async function insertCrossdocking(
  header: Omit<CrossdockingHeader, 'id' | 'crossdocking_no' | 'created_at' | 'updated_at'>,
  details: Omit<CrossdockingDetail, 'id' | 'crossdocking_id' | 'created_at' | 'item_name'>[]
) {
  // Insert header
  const { data: newHeader, error: hErr } = await supabaseAdmin
    .from('crossdocking_header')
    .insert(header)
    .select('id, crossdocking_no')
    .single()
  if (hErr) throw hErr

  // Insert details kalau ada
  if (details.length > 0) {
    const detailRows = details.map(d => ({ ...d, crossdocking_id: newHeader.id }))
    const { error: dErr } = await supabaseAdmin
      .from('crossdocking_detail')
      .insert(detailRows)
    if (dErr) throw dErr
  }

  return newHeader
}

export async function updateCrossdockingHeader(
  id: number,
  data: Partial<Omit<CrossdockingHeader, 'id' | 'crossdocking_no' | 'created_at' | 'updated_at'>>
) {
  const { error } = await supabaseAdmin
    .from('crossdocking_header')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCrossdocking(id: number) {
  // Detail terhapus otomatis via ON DELETE CASCADE
  const { error } = await supabaseAdmin
    .from('crossdocking_header')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/* ── Detail ─────────────────────────────────────────────── */

export async function upsertCrossdockingDetail(
  detail: Omit<CrossdockingDetail, 'created_at' | 'item_name'>
) {
  const { id, ...payload } = detail
  if (id) {
    const { error } = await supabaseAdmin.from('crossdocking_detail').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('crossdocking_detail').insert(payload)
    if (error) throw error
  }
}

export async function deleteCrossdockingDetail(id: number) {
  const { error } = await supabaseAdmin.from('crossdocking_detail').delete().eq('id', id)
  if (error) throw error
}

/* ── Options ─────────────────────────────────────────────── */

export async function getCrossdockingOptions() {
  const [skus, customers] = await Promise.all([
    supabaseAdmin
      .from('master_sku')
      .select('sku_code, item_name, uom')
      .eq('is_active', true)
      .order('sku_code'),
    supabaseAdmin
      .from('customers')
      .select('customer_code, customer_name, city')
      .eq('is_active', true)
      .order('customer_name'),
  ])
  return {
    skus:      (skus.data      ?? []) as SkuOption[],
    customers: (customers.data ?? []) as CustomerOption[],
  }
}
