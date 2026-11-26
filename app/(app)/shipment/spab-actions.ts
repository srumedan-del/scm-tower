'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import { wibToday } from '@/lib/wib-time'
import { DEFAULT_SPAB_SIGNER } from '@/lib/spab'

// Nomor SPAB dipakai bersama sistem pusat (ada lompatan nomor). Bila tahun berjalan belum punya
// SPAB di aplikasi ini, nomor dilanjutkan dari nomor manual terakhir yang diketahui.
const LAST_MANUAL_SEQ: Record<number, number> = { 2026: 3651 }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function formatSpabNo(seq: number, date: string) {
  const [year, month] = date.split('-').map(Number)
  return `${String(seq).padStart(5, '0')}/SPAB/SRU/${ROMAN[month - 1]}/${year}`
}

export type SpabExisting = { id: number; spab_no: string; spab_date: string }

export type SpabDraft = {
  tracking_id: number
  pss_no: string
  trip_id: string | null
  customer_name: string | null
  customer_address: string | null
  destination_city: string | null
  recipient: string
  vehicle_no: string | null
  driver_name: string | null
  fleet_type: string
  existing: SpabExisting[]
}

const noteField = (notes: string | null | undefined, key: string) =>
  notes?.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'))?.[1]?.trim() || null

async function nextSeq(year: number) {
  const { data, error } = await supabaseAdmin.from('spab_document').select('seq').eq('year', year).order('seq', { ascending: false }).limit(1)
  if (error) throw error
  const last = data?.[0]?.seq ?? LAST_MANUAL_SEQ[year] ?? 0
  return Number(last) + 1
}

/** Data awal dialog SPAB untuk PSS yang dipilih (biasanya semua PSS di trip yang baru dibuat). */
export async function getSpabDrafts(pssNos: string[]): Promise<{ drafts: SpabDraft[]; nextSeq: number; today: string }> {
  await requireAuthenticatedUser()
  const today = wibToday()
  const list = [...new Set(pssNos.filter(Boolean))]
  if (!list.length) return { drafts: [], nextSeq: await nextSeq(Number(today.slice(0, 4))), today }

  const { data: rows, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, pss_no, trip_id, customer_name, destination_city, destination_address, transporter_id, vehicle_id, driver_id, cost_model, fleet_type, notes, status')
    .in('pss_no', list)
    .neq('status', 'Failed Delivery')
    .order('id', { ascending: false })
  if (error) throw error

  // PSS bisa punya shipment lama (gagal kirim); pakai yang terbaru.
  const latest = new Map<string, any>()
  for (const row of rows ?? []) if (row.pss_no && !latest.has(row.pss_no)) latest.set(row.pss_no, row)
  const shipments = list.map(pss => latest.get(pss)).filter(Boolean)

  const ids = (key: string) => [...new Set(shipments.map(row => row[key]).filter((id: unknown) => id != null))]
  const customerNames = [...new Set(shipments.map(row => String(row.customer_name ?? '').toUpperCase()).filter(Boolean))]
  const [transporters, vehicles, drivers, customers, existing] = await Promise.all([
    ids('transporter_id').length ? supabaseAdmin.from('master_transporter').select('id, name').in('id', ids('transporter_id')) : Promise.resolve({ data: [] as any[] }),
    ids('vehicle_id').length ? supabaseAdmin.from('transport_fleet').select('id, vehicle_no').in('id', ids('vehicle_id')) : Promise.resolve({ data: [] as any[] }),
    ids('driver_id').length ? supabaseAdmin.from('master_driver').select('id, driver_name').in('id', ids('driver_id')) : Promise.resolve({ data: [] as any[] }),
    customerNames.length ? supabaseAdmin.from('customers').select('customer_name, address').in('customer_name', customerNames) : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('spab_document').select('id, spab_no, spab_date, pss_no').in('pss_no', list).order('id'),
  ])
  const byId = (result: { data: any[] | null }, field: string) => new Map((result.data ?? []).map(row => [Number(row.id), row[field] as string]))
  const transporterName = byId(transporters, 'name')
  const vehicleNo = byId(vehicles, 'vehicle_no')
  const driverName = byId(drivers, 'driver_name')
  const address = new Map((customers.data ?? []).map((row: any) => [String(row.customer_name).toUpperCase(), row.address as string | null]))

  const drafts: SpabDraft[] = shipments.map(row => {
    const internal = row.cost_model === 'Internal' || row.fleet_type === 'Internal'
    const vendor = (row.transporter_id != null ? transporterName.get(Number(row.transporter_id)) : null) ?? noteField(row.notes, 'Vendor')
    return {
      tracking_id: row.id,
      pss_no: row.pss_no,
      trip_id: row.trip_id,
      customer_name: row.customer_name,
      customer_address: row.destination_address ?? address.get(String(row.customer_name ?? '').toUpperCase()) ?? null,
      destination_city: row.destination_city,
      recipient: internal || !vendor ? 'MOBIL SINAR RODA UTAMA' : vendor,
      vehicle_no: (row.vehicle_id != null ? vehicleNo.get(Number(row.vehicle_id)) : null) ?? noteField(row.notes, 'Nopol'),
      driver_name: (row.driver_id != null ? driverName.get(Number(row.driver_id)) : null) ?? noteField(row.notes, 'Driver'),
      fleet_type: internal ? 'INTERNAL' : 'EKSTERNAL',
      existing: ((existing.data ?? []) as any[]).filter(doc => doc.pss_no === row.pss_no).map(doc => ({ id: doc.id, spab_no: doc.spab_no, spab_date: doc.spab_date })),
    }
  })

  return { drafts, nextSeq: await nextSeq(Number(today.slice(0, 4))), today }
}

export type CreateSpabInput = {
  tracking_id: number
  seq: number
  spab_date: string
  pickup_date: string | null
  customer_address: string | null
  recipient: string | null
  signer: string | null
  notes: string | null
}

/** Simpan SPAB; nomor urut tidak boleh dipakai dua kali dalam satu tahun. */
export async function createSpabDocuments(inputs: CreateSpabInput[]) {
  const user = await requireAuthenticatedUser()
  if (!inputs.length) throw new Error('Pilih minimal satu PSS')

  const seen = new Set<string>()
  for (const input of inputs) {
    if (!Number.isInteger(input.seq) || input.seq <= 0 || input.seq > 99999) throw new Error('Nomor urut SPAB harus 1–99999')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spab_date)) throw new Error('Tanggal SPAB tidak valid')
    const key = `${input.spab_date.slice(0, 4)}-${input.seq}`
    if (seen.has(key)) throw new Error(`Nomor urut ${input.seq} dipakai lebih dari sekali`)
    seen.add(key)
  }

  const { data: shipments, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, pss_no, trip_id, customer_name, transporter_id, vehicle_id, driver_id, cost_model, fleet_type, notes')
    .in('id', inputs.map(input => input.tracking_id))
  if (error) throw error
  const drafts = (await getSpabDrafts((shipments ?? []).map(row => row.pss_no).filter(Boolean) as string[])).drafts
  const draftById = new Map(drafts.map(draft => [draft.tracking_id, draft]))

  const rows = inputs.map(input => {
    const draft = draftById.get(input.tracking_id)
    if (!draft) throw new Error('Shipment tidak ditemukan')
    return {
      spab_no: formatSpabNo(input.seq, input.spab_date),
      seq: input.seq,
      year: Number(input.spab_date.slice(0, 4)),
      spab_date: input.spab_date,
      tracking_id: input.tracking_id,
      pss_no: draft.pss_no,
      trip_id: draft.trip_id,
      customer_name: draft.customer_name,
      customer_address: input.customer_address?.trim() || draft.customer_address,
      recipient: input.recipient?.trim() || draft.recipient,
      vehicle_no: draft.vehicle_no,
      driver_name: draft.driver_name,
      fleet_type: draft.fleet_type,
      pickup_date: input.pickup_date || input.spab_date,
      signer: input.signer?.trim() || DEFAULT_SPAB_SIGNER,
      notes: input.notes?.trim() || null,
      created_by: user.email ?? null,
    }
  })

  const { data, error: insertError } = await supabaseAdmin.from('spab_document').insert(rows).select('id, spab_no, pss_no')
  if (insertError) {
    if (insertError.code === '23505') throw new Error('Nomor SPAB sudah dipakai. Ubah nomor urut lalu coba lagi.')
    throw insertError
  }
  return (data ?? []) as { id: number; spab_no: string; pss_no: string }[]
}

// ─── Cetak ───────────────────────────────────────────────────────────────────

export type SpabItem = {
  sku: string
  name: string | null
  qty: number
  per_box: number | null
  box_weight: number | null
  boxes: number | null
  total_kg: number | null
  box_cbm: number | null
  total_cbm: number | null
}

export async function getSpabForPrint(id: number) {
  await requireAuthenticatedUser()
  const { data: doc, error } = await supabaseAdmin.from('spab_document').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!doc) return null

  // Barang keluar PSS (qty_out > 0); baris rakitan/kit (qty masuk) tidak ikut.
  const { data: details, error: detailError } = doc.pss_no
    ? await supabaseAdmin.from('outbound_detail').select('item_no, description, qty_out, quantity').eq('document_no', doc.pss_no)
    : { data: [], error: null }
  if (detailError) throw detailError
  const qtyBySku = new Map<string, { qty: number; description: string | null }>()
  for (const row of details ?? []) {
    const qty = Number(row.qty_out) || 0
    if (qty <= 0 || !row.item_no) continue
    const sku = String(row.item_no).trim()
    const current = qtyBySku.get(sku)
    qtyBySku.set(sku, { qty: (current?.qty ?? 0) + qty, description: current?.description ?? row.description })
  }

  const skus = [...qtyBySku.keys()]
  const { data: master } = skus.length
    ? await supabaseAdmin.from('master_sku').select('sku_code, item_name, uom, pcs_per_outer_box, outer_box_weight_kg, outer_box_cbm').in('sku_code', skus)
    : { data: [] as any[] }
  const masterBySku = new Map((master ?? []).map((row: any) => [String(row.sku_code).toUpperCase(), row]))

  const items: SpabItem[] = skus.map(sku => {
    const { qty, description } = qtyBySku.get(sku)!
    const m = masterBySku.get(sku.toUpperCase())
    const perBox = m?.pcs_per_outer_box ? Number(m.pcs_per_outer_box) : null
    const boxes = perBox ? Math.ceil(qty / perBox) : null
    const boxWeight = m?.outer_box_weight_kg != null ? Number(m.outer_box_weight_kg) : null
    const boxCbm = m?.outer_box_cbm != null ? Number(m.outer_box_cbm) : null
    return {
      sku,
      name: m?.item_name ?? description ?? null,
      qty,
      per_box: perBox,
      box_weight: boxWeight,
      boxes,
      total_kg: boxes != null && boxWeight != null ? boxes * boxWeight : null,
      box_cbm: boxCbm,
      total_cbm: boxes != null && boxCbm != null ? boxes * boxCbm : null,
    }
  }).sort((a, b) => a.sku.localeCompare(b.sku))

  return { doc, items }
}
