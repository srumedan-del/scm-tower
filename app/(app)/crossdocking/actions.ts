'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type CrossdockingHeader = {
  id: number
  crossdocking_no: string
  pts_id: number | null
  customer_code: string | null
  customer_name: string | null
  destination_address: string | null
  destination_city: string | null
  pss_no: string | null
  psi_no: string | null
  document_created_at: string | null
  document_date: string | null
  hq_reference_no: string | null
  received_from_hq_date: string
  promised_delivery_date: string
  status: 'Draft' | 'Ready' | 'Dispatched' | 'In Transit' | 'Delivered'
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
  item_name?: string | null
}

export type SkuOption = { sku_code: string; item_name: string; uom: string | null }
export type CustomerOption = {
  customer_name: string
  destination_city: string | null
  destination_address: string | null
}

export type PtsRecord = {
  id: number
  pts_no: string
  document_date: string | null
  document_created_at: string | null
  transfer_order_no: string | null
  customer_name: string | null
  destination_city: string | null
  destination_address: string | null
  status: 'Menunggu Crossdocking' | 'Terhubung Crossdocking' | 'Realokasi'
  realokasi_by?: string | null
  realokasi_at?: string | null
  crossdocking_id: number | null
  source_file_name: string | null
  uploaded_at: string | null
}

/* ── Header ─────────────────────────────────────────────── */

function getNextMonthFirstDay(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return next
}

export async function getCrossdockingAvailableMonths() {
  await requireAuthenticatedUser()
  const [{ data: cdData }, { data: ptsData }] = await Promise.all([
    supabaseAdmin
      .from('crossdocking_header')
      .select('received_from_hq_date')
      .order('received_from_hq_date', { ascending: true })
      .limit(1),
    supabaseAdmin
      .from('crossdocking_pts')
      .select('document_date')
      .order('document_date', { ascending: true })
      .limit(1),
  ])

  const cdMin = cdData?.[0]?.received_from_hq_date?.slice(0, 7)
  const ptsMin = ptsData?.[0]?.document_date?.slice(0, 7)
  const minDate = [cdMin, ptsMin].filter(Boolean).sort()[0] ?? '2026-10'
  const [minYear, minMonth] = minDate.split('-').map(Number)

  const now = new Date()
  const maxYear = Math.max(now.getFullYear(), 2026)
  const maxMonth = now.getFullYear() === maxYear ? Math.max(now.getMonth() + 1, 11) : 12

  const months: string[] = []
  for (let y = minYear; y <= maxYear; y++) {
    const startM = y === minYear ? minMonth : 1
    const endM = y === maxYear ? maxMonth : 12
    for (let m = startM; m <= endM; m++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
    }
  }
  return months.sort().reverse()
}

export async function getCrossdockings(month?: string) {
  await requireAuthenticatedUser()
  let query = supabaseAdmin
    .from('crossdocking_header')
    .select('*')
    .order('promised_delivery_date', { ascending: false })

  if (month && month !== 'all') {
    const nextMonth = getNextMonthFirstDay(month)
    query = query
      .gte('received_from_hq_date', `${month}-01`)
      .lt('received_from_hq_date', nextMonth)
  }

  const { data, error } = await query.limit(200)
  if (error) throw error
  const headers = (data ?? []) as CrossdockingHeader[]
  if (!headers.length) return headers

  // Status mengikuti shipment yang terhubung: punya PSS dan Trip (atau resi retail) = In Transit.
  const { data: shipments } = await supabaseAdmin
    .from('shipment_tracking')
    .select('crossdocking_id, status')
    .in('crossdocking_id', headers.map(header => header.id))
  const statusesById = new Map<number, string[]>()
  for (const shipment of shipments ?? []) {
    const id = Number(shipment.crossdocking_id)
    statusesById.set(id, [...(statusesById.get(id) ?? []), String(shipment.status)])
  }
  return headers.map(header => {
    const statuses = statusesById.get(header.id) ?? []
    const status: CrossdockingHeader['status'] =
      statuses.some(s => s === 'Delivered' || s === 'Closed') ? 'Delivered'
      : statuses.includes('In Transit') ? 'In Transit'
      : statuses.includes('Dispatched') && header.status !== 'Delivered' ? 'Dispatched'
      : header.status
    return { ...header, status }
  })
}

export async function getCrossdockingById(id: number) {
  await requireAuthenticatedUser()
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
  header: Omit<CrossdockingHeader, 'id' | 'crossdocking_no' | 'created_at' | 'updated_at'> & { pts_ids?: number[] },
  details: Omit<CrossdockingDetail, 'id' | 'crossdocking_id' | 'created_at' | 'item_name'>[]
) {
  await requireAuthenticatedUser()
  const { pts_ids: ptsIds = [], ...headerPayload } = header
  const { data: newHeader, error: hErr } = await supabaseAdmin
    .from('crossdocking_header')
    .insert(headerPayload)
    .select('id, crossdocking_no')
    .single()
  if (hErr) throw hErr

  const linkedPtsIds = [...new Set(ptsIds.filter(id => Number.isInteger(id) && id > 0))]
  if (linkedPtsIds.length) {
    const { error: linkError } = await supabaseAdmin
      .from('crossdocking_header_pts')
      .insert(linkedPtsIds.map(ptsId => ({ crossdocking_id: newHeader.id, pts_id: ptsId })))
    if (linkError) throw linkError

    const { error: ptsError } = await supabaseAdmin
      .from('crossdocking_pts')
      .update({ crossdocking_id: newHeader.id, status: 'Terhubung Crossdocking' })
      .in('id', linkedPtsIds)
    if (ptsError) throw ptsError
  }

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
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin
    .from('crossdocking_header')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCrossdocking(id: number) {
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('crossdocking_detail').delete().eq('id', id)
  if (error) throw error
}

/* ── PTS staging ─────────────────────────────────────────── */

export async function getPtsRecords(month?: string) {
  await requireAuthenticatedUser()
  let query = supabaseAdmin
    .from('crossdocking_pts')
    .select('*')
    .order('document_date', { ascending: false, nullsFirst: false })
    .order('pts_no', { ascending: false })

  if (month && month !== 'all') {
    const nextMonth = getNextMonthFirstDay(month)
    query = query
      .gte('document_date', `${month}-01`)
      .lt('document_date', nextMonth)
  }

  const { data, error } = await query.limit(500)
  if (error) throw error

  const records = (data ?? []) as PtsRecord[]
  const linkedHeaderIds = [...new Set(
    records
      .map(record => record.crossdocking_id)
      .filter((id): id is number => id !== null)
  )]

  const ptsIds = records.map(record => record.id)
  const { data: relationRows, error: relationError } = ptsIds.length
    ? await supabaseAdmin
      .from('crossdocking_header_pts')
      .select('crossdocking_id, pts_id')
      .in('pts_id', ptsIds)
    : { data: [], error: null }
  if (relationError) throw relationError

  for (const relation of relationRows ?? []) {
    if (!linkedHeaderIds.includes(Number(relation.crossdocking_id))) {
      linkedHeaderIds.push(Number(relation.crossdocking_id))
    }
  }

  const ptsStatus = (record: PtsRecord, linked: boolean): PtsRecord['status'] =>
    linked ? 'Terhubung Crossdocking' : record.status === 'Realokasi' ? 'Realokasi' : 'Menunggu Crossdocking'

  if (!linkedHeaderIds.length) return records.map(record => ({
    ...record,
    status: ptsStatus(record, false),
  }))

  const { data: headers, error: headersError } = await supabaseAdmin
    .from('crossdocking_header')
    .select('id, customer_name, destination_city, destination_address')
    .in('id', linkedHeaderIds)
  if (headersError) throw headersError

  const headerById = new Map((headers ?? []).map(header => [header.id, header]))
  const headerIdByPtsId = new Map(
    (relationRows ?? []).map(relation => [Number(relation.pts_id), Number(relation.crossdocking_id)])
  )
  return records.map(record => {
    const headerId = record.crossdocking_id ?? headerIdByPtsId.get(record.id) ?? null
    const header = headerId ? headerById.get(headerId) : null
    const customerName = record.customer_name?.trim() || header?.customer_name?.trim() || null
    const destinationCity = record.destination_city?.trim() || header?.destination_city?.trim() || null
    const destinationAddress = record.destination_address?.trim() || header?.destination_address?.trim() || null
    return {
      ...record,
      customer_name: customerName,
      destination_city: destinationCity,
      destination_address: destinationAddress,
      status: ptsStatus(record, Boolean(header)),
    }
  })
}

export type PtsUploadRow = {
  pts_no: string
  document_date?: string | null
  document_created_at?: string | null
  transfer_order_no?: string | null
  details: Array<{
    nav_entry_no?: number | null
    document_line_no?: number | null
    item_no?: string | null
    variant_code?: string | null
    description?: string | null
    quantity?: number | null
    lot_no?: string | null
    expiration_date?: string | null
    source_location_code?: string | null
  }>
}

// File ILE berisi satu baris per item/lot, jadi satu PTS bisa muncul berkali-kali.
function mergePtsUploadRows(rows: PtsUploadRow[]) {
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

export async function uploadPtsRecords(rows: PtsUploadRow[], sourceFileName: string) {
  await requireAuthenticatedUser()
  const uniqueRows = mergePtsUploadRows(rows)

  if (uniqueRows.length === 0) throw new Error('Tidak ditemukan nomor PTS pada file.')

  const ptsNos = uniqueRows.map(row => row.pts_no)
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('crossdocking_pts')
    .select('pts_no')
    .in('pts_no', ptsNos)
  if (existingError) throw existingError
  const existingNos = new Set((existing ?? []).map(row => row.pts_no))
  const newRows = uniqueRows.filter(row => !existingNos.has(row.pts_no))
  if (newRows.length === 0) return { inserted: 0, total: uniqueRows.length }

  const { data, error } = await supabaseAdmin
    .from('crossdocking_pts')
    .insert(newRows.map(({ details: _details, ...row }) => ({ ...row, source_file_name: sourceFileName })))
    .select('id, pts_no')
  if (error) throw error
  const idByPts = new Map((data ?? []).map(row => [row.pts_no, row.id]))
  const detailRows = newRows.flatMap(row => row.details.map(detail => ({
    ...detail,
    crossdocking_pts_id: idByPts.get(row.pts_no),
  }))).filter(row => row.crossdocking_pts_id)
  if (detailRows.length) {
    const { error: detailError } = await supabaseAdmin.from('crossdocking_pts_detail').insert(detailRows)
    if (detailError) throw detailError
  }
  return { inserted: data?.length ?? 0, total: uniqueRows.length }
}

export async function updatePtsDestination(
  id: number,
  destination: { customer_name: string; destination_city?: string | null; destination_address: string; promised_delivery_date: string }
) {
  await requireAuthenticatedUser()
  const customerName = destination.customer_name.trim()
  const address = destination.destination_address.trim()
  if (!customerName) throw new Error('Customer wajib diisi.')
  if (!address) throw new Error('Alamat kirim wajib diisi.')
  if (!destination.promised_delivery_date) throw new Error('Promised delivery date wajib diisi.')

  const { data: pts, error: ptsError } = await supabaseAdmin
    .from('crossdocking_pts')
    .select('*')
    .eq('id', id)
    .single()
  if (ptsError) throw ptsError

  if (pts.crossdocking_id) {
    const { error: headerError } = await supabaseAdmin.from('crossdocking_header').update({
      customer_name: customerName,
      destination_city: destination.destination_city?.trim() || null,
      destination_address: address,
      promised_delivery_date: destination.promised_delivery_date,
    }).eq('id', pts.crossdocking_id)
    if (headerError) throw headerError
  } else {
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('crossdocking_pts_detail')
      .select('*')
      .eq('crossdocking_pts_id', id)
      .order('document_line_no')
    if (detailsError) throw detailsError

    const { data: crossdocking, error: headerError } = await supabaseAdmin
      .from('crossdocking_header')
      .insert({
        customer_name: customerName,
        destination_city: destination.destination_city?.trim() || null,
        destination_address: address,
        hq_reference_no: pts.pts_no,
        document_date: pts.document_date,
        document_created_at: pts.document_created_at,
        received_from_hq_date: pts.document_date ?? new Date().toISOString().slice(0, 10),
        promised_delivery_date: destination.promised_delivery_date,
        status: 'Draft',
        notes: `Dibuat otomatis dari PTS ${pts.pts_no}`,
      })
      .select('id')
      .single()
    if (headerError) throw headerError

    const crossdockingDetails = (details ?? []).map(detail => ({
      crossdocking_id: crossdocking.id,
      item_no: detail.item_no,
      description: detail.description || detail.item_no,
      quantity: Math.abs(Number(detail.quantity) || 0),
      lot_no: detail.lot_no,
      expiration_date: detail.expiration_date,
      notes: [detail.variant_code && `Variant: ${detail.variant_code}`, detail.source_location_code && `Source: ${detail.source_location_code}`].filter(Boolean).join(' | ') || null,
    }))
    if (crossdockingDetails.length) {
      const { error: detailInsertError } = await supabaseAdmin.from('crossdocking_detail').insert(crossdockingDetails)
      if (detailInsertError) throw detailInsertError
    }

    const { error: ptsLinkError } = await supabaseAdmin.from('crossdocking_pts').update({ crossdocking_id: crossdocking.id }).eq('id', id)
    if (ptsLinkError) throw ptsLinkError
  }

  const { error } = await supabaseAdmin
    .from('crossdocking_pts')
    .update({
      customer_name: customerName,
      destination_city: destination.destination_city?.trim() || null,
      destination_address: address,
      status: 'Crossdocking Dibuat',
    })
    .eq('id', id)
  if (error) throw error
}

/* ── Options ─────────────────────────────────────────────── */

export async function getCrossdockingOptions(referenceMonth?: string) {
  await requireAuthenticatedUser()
  // Hitung rentang tanggal: hanya muat PTS bulan saat proses dan 1 bulan sebelumnya agar loading cepat
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth() + 1
  if (referenceMonth && referenceMonth !== 'all') {
    const parts = referenceMonth.split('-').map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      y = parts[0]
      m = parts[1]
    }
  }

  const prevDate = new Date(y, m - 2, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth() + 1
  const minDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`

  const [{ data: skus, error: skuError }, { data: customers, error: customerError }, { data: pts, error: ptsError }, { data: linkedPts, error: linkedPtsError }] = await Promise.all([
    supabaseAdmin
      .from('master_sku')
      .select('sku_code, item_name, uom')
      .eq('is_active', true)
      .order('sku_code'),
    supabaseAdmin
      .from('crossdocking_customer')
      .select('customer_name, destination_city, destination_address')
      .order('customer_name'),
    supabaseAdmin
      .from('crossdocking_pts')
      .select('id, pts_no, document_date')
      .neq('status', 'Realokasi')
      .gte('document_date', minDateStr)
      .order('document_date', { ascending: false }),
    supabaseAdmin.from('crossdocking_header_pts').select('pts_id'),
  ])
  if (skuError) throw skuError
  if (customerError) throw customerError
  if (ptsError) throw ptsError
  if (linkedPtsError) throw linkedPtsError
  const linkedIds = new Set((linkedPts ?? []).map(row => Number(row.pts_id)))
  return {
    skus:      (skus ?? []) as SkuOption[],
    customers: (customers ?? []) as CustomerOption[],
    pts:       (pts ?? []).filter(row => !linkedIds.has(Number(row.id))) as Array<{ id: number; pts_no: string; document_date: string | null }>,
  }
}

/** Tandai PTS sebagai Realokasi MDN-PAR ke JKT-JP12 (tanpa crossdocking, tanpa biaya), atau batalkan. */
export async function setPtsRealokasi(id: number, realokasi: boolean) {
  const user = await requireAuthenticatedUser()
  const by = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'unknown')
  const now = new Date().toISOString()
  const { data: linked } = await supabaseAdmin
    .from('crossdocking_header_pts').select('pts_id').eq('pts_id', id).limit(1)
  if (realokasi && linked?.length) throw new Error('PTS ini sudah terhubung ke Crossdocking.')
  const { error } = await supabaseAdmin
    .from('crossdocking_pts')
    .update({
      status: realokasi ? 'Realokasi' : 'Menunggu Crossdocking',
      realokasi_by: realokasi ? by : null,
      realokasi_at: realokasi ? now : null,
      updated_at: now,
    })
    .eq('id', id)
    .is('crossdocking_id', null)
  if (error) {
    if (error.message.includes('status_check')) throw new Error('Jalankan dulu supabase/migration_v43_pts_realokasi_cd_in_transit.sql di Supabase.')
    if (error.message.includes('realokasi_')) throw new Error('Jalankan dulu supabase/migration_v44_pts_realokasi_audit.sql di Supabase.')
    throw new Error(error.message)
  }
  return { realokasi_by: realokasi ? by : null, realokasi_at: realokasi ? now : null }
}

/** PTS yang belum diputuskan (belum Crossdocking, belum Realokasi) sejak tanggal tertentu. */
export async function getPendingPts(sinceDate: string) {
  await requireAuthenticatedUser()
  const [{ data: pts, error }, { data: linked }] = await Promise.all([
    supabaseAdmin
      .from('crossdocking_pts')
      .select('id, pts_no, document_date, status, crossdocking_id')
      .is('crossdocking_id', null)
      .neq('status', 'Realokasi')
      .gte('document_date', sinceDate)
      .order('document_date', { ascending: true })
      .limit(500),
    supabaseAdmin.from('crossdocking_header_pts').select('pts_id'),
  ])
  if (error) throw error
  const linkedIds = new Set((linked ?? []).map(row => Number(row.pts_id)))
  return (pts ?? [])
    .filter(row => !linkedIds.has(Number(row.id)) && row.document_date)
    .map(row => ({ id: Number(row.id), pts_no: String(row.pts_no), document_date: String(row.document_date) }))
}

export async function getPtsDetailsForCrossdocking(ptsId: number) {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('crossdocking_pts_detail')
    .select('item_no, description, quantity, lot_no, expiration_date, variant_code, source_location_code')
    .eq('crossdocking_pts_id', ptsId)
    .order('document_line_no')
  if (error) throw error
  return (data ?? []).map((detail: any) => ({
    item_no: detail.item_no,
    description: detail.description || detail.item_no,
    quantity: Math.abs(Number(detail.quantity) || 0),
    uom: null,
    lot_no: detail.lot_no,
    expiration_date: detail.expiration_date,
    notes: [detail.variant_code && `Variant: ${detail.variant_code}`, detail.source_location_code && `Source: ${detail.source_location_code}`].filter(Boolean).join(' | ') || null,
  }))
}
