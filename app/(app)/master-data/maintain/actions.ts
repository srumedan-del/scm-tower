'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import { inferDkLk } from '@/lib/dklk-rule'

const blank = (value: unknown) => value == null || String(value).trim() === ''
const nameKey = (value: unknown) => String(value ?? '').trim().toUpperCase()
/** Nama dipakai sebagai pola ilike: % dan _ harus diperlakukan sebagai huruf biasa. */
const likeExact = (value: unknown) => String(value ?? '').trim().replace(/[\\%_]/g, char => `\\${char}`)

function cleanCity(city: string) {
  const value = city.trim().replace(/\s+/g, ' ').toUpperCase()
  if (value.length < 3 || value.length > 60) throw new Error('Nama kota 3–60 karakter.')
  return value
}

export type MissingCityShipment = {
  id: number
  pss_no: string | null
  trip_id: string | null
  customer_code: string | null
  customer_name: string | null
  document_date: string | null
  status: string | null
  cost_model: string | null
  /** Kota di Master Customer (dicocokkan lewat kode, lalu nama). */
  master_city: string | null
  master_customer_id: number | null
}

export type CustomerWithoutCity = {
  id: number
  customer_code: string | null
  customer_name: string | null
  address: string | null
  province: string | null
  shipments: number
}

export type RetailGap = {
  id: number
  pss_no: string | null
  customer_name: string | null
  document_date: string | null
  transporter: string | null
  missing: string[]
}

export type MaintainOverview = {
  missingCity: MissingCityShipment[]
  customersWithoutCity: CustomerWithoutCity[]
  retailGaps: RetailGap[]
  cityOptions: string[]
}

/** Data yang perlu dirapikan agar Shipment Tracking dan Shipment Cost lengkap. */
export async function getMaintainOverview(): Promise<MaintainOverview> {
  await requireAuthenticatedUser()

  const [shipmentsResult, customersResult, retailResult, transportersResult] = await Promise.all([
    supabaseAdmin
      .from('shipment_tracking')
      .select('id, pss_no, trip_id, customer_code, customer_name, document_date, status, cost_model, destination_city')
      .or('destination_city.is.null,destination_city.eq.')
      .order('document_date', { ascending: false })
      .limit(500),
    supabaseAdmin.from('customers').select('id, customer_code, customer_name, city, address, province, is_active').limit(5000),
    supabaseAdmin
      .from('shipment_tracking')
      .select('id, pss_no, customer_name, document_date, transporter_id, notes, no_resi, total_biaya_eksternal, resi_image_path')
      .eq('cost_model', 'Retail')
      .eq('status', 'In Transit')
      .order('document_date', { ascending: false })
      .limit(500),
    supabaseAdmin.from('master_transporter').select('id, name'),
  ])
  for (const result of [shipmentsResult, customersResult, retailResult]) if (result.error) throw new Error(result.error.message)

  const customers = customersResult.data ?? []
  const byCode = new Map(customers.filter(c => !blank(c.customer_code)).map(c => [nameKey(c.customer_code), c]))
  const byName = new Map(customers.filter(c => !blank(c.customer_name)).map(c => [nameKey(c.customer_name), c]))
  const findCustomer = (code: unknown, name: unknown) => (!blank(code) && byCode.get(nameKey(code))) || byName.get(nameKey(name)) || null

  const missingCity: MissingCityShipment[] = (shipmentsResult.data ?? []).map(row => {
    const customer = findCustomer(row.customer_code, row.customer_name)
    return {
      id: row.id,
      pss_no: row.pss_no,
      trip_id: row.trip_id,
      customer_code: row.customer_code,
      customer_name: row.customer_name,
      document_date: row.document_date,
      status: row.status,
      cost_model: row.cost_model,
      master_city: customer && !blank(customer.city) ? String(customer.city) : null,
      master_customer_id: customer?.id ?? null,
    }
  })

  // Jumlah shipment per customer membantu memprioritaskan customer yang sering dikirim.
  const { data: shipmentNames } = await supabaseAdmin.from('shipment_tracking').select('customer_name').limit(10000)
  const shipmentCount = new Map<string, number>()
  for (const row of shipmentNames ?? []) shipmentCount.set(nameKey(row.customer_name), (shipmentCount.get(nameKey(row.customer_name)) ?? 0) + 1)

  const customersWithoutCity: CustomerWithoutCity[] = customers
    .filter(c => blank(c.city) && c.is_active !== false)
    .map(c => ({
      id: c.id,
      customer_code: c.customer_code,
      customer_name: c.customer_name,
      address: c.address,
      province: c.province,
      shipments: shipmentCount.get(nameKey(c.customer_name)) ?? 0,
    }))
    .sort((a, b) => b.shipments - a.shipments || nameKey(a.customer_name).localeCompare(nameKey(b.customer_name)))

  const transporterName = new Map((transportersResult.data ?? []).map(t => [Number(t.id), String(t.name)]))
  const retailGaps: RetailGap[] = (retailResult.data ?? [])
    .map(row => {
      const missing = [
        blank(row.no_resi) && 'Nomor resi',
        !(Number(row.total_biaya_eksternal) > 0) && 'Biaya pengiriman',
        blank(row.resi_image_path) && 'Gambar resi',
      ].filter(Boolean) as string[]
      return {
        id: row.id,
        pss_no: row.pss_no,
        customer_name: row.customer_name,
        document_date: row.document_date,
        transporter: (row.transporter_id != null ? transporterName.get(Number(row.transporter_id)) : null)
          ?? row.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? null,
        missing,
      }
    })
    .filter(row => row.missing.length > 0)

  const cityOptions = [...new Set(customers.map(c => String(c.city ?? '').trim().toUpperCase()).filter(Boolean))].sort()
  return { missingCity, customersWithoutCity, retailGaps, cityOptions }
}

/**
 * Isi kota tujuan shipment. Bila diminta, kota juga disimpan ke Master Customer yang kotanya
 * masih kosong, supaya PSS berikutnya untuk customer itu langsung lengkap.
 */
export async function applyShipmentCities(items: { id: number; city: string }[], saveToMaster: boolean) {
  await requireAuthenticatedUser()
  if (!items.length) throw new Error('Tidak ada shipment yang dipilih.')
  if (items.length > 500) throw new Error('Maksimal 500 shipment sekali simpan.')

  const ids = items.map(item => Number(item.id))
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error('ID shipment tidak valid.')
  const { data: rows, error } = await supabaseAdmin.from('shipment_tracking').select('id, customer_code, customer_name, dk_lk').in('id', ids)
  if (error) throw new Error(error.message)
  const rowById = new Map((rows ?? []).map(row => [row.id, row]))

  let updated = 0
  const masterUpdates = new Map<string, { code: string | null; name: string | null; city: string }>()
  for (const item of items) {
    const row = rowById.get(Number(item.id))
    if (!row) continue
    const city = cleanCity(item.city)
    const patch: Record<string, string> = { destination_city: city }
    if (blank(row.dk_lk)) patch.dk_lk = inferDkLk(city) ?? 'LK'
    const { error: updateError } = await supabaseAdmin.from('shipment_tracking').update(patch).eq('id', row.id)
    if (updateError) throw new Error(updateError.message)
    updated++
    if (saveToMaster) masterUpdates.set(nameKey(row.customer_code) || nameKey(row.customer_name), { code: row.customer_code, name: row.customer_name, city })
  }

  let mastersUpdated = 0
  for (const target of masterUpdates.values()) mastersUpdated += await fillCustomerCity(target.code, target.name, target.city)
  return { updated, mastersUpdated }
}

/** Isi kota customer yang masih kosong (tidak menimpa kota yang sudah ada). */
async function fillCustomerCity(code: string | null, name: string | null, city: string) {
  let query = supabaseAdmin.from('customers').select('id, dk_lk, city')
  query = !blank(code) ? query.eq('customer_code', String(code).trim()) : query.ilike('customer_name', likeExact(name))
  const { data, error } = await query.limit(5)
  if (error) throw new Error(error.message)
  let count = 0
  for (const customer of data ?? []) {
    if (!blank(customer.city)) continue
    const patch: Record<string, string> = { city }
    if (blank(customer.dk_lk)) patch.dk_lk = inferDkLk(city) ?? 'LK'
    const { error: updateError } = await supabaseAdmin.from('customers').update(patch).eq('id', customer.id)
    if (updateError) throw new Error(updateError.message)
    count++
  }
  return count
}

/** Isi kota di Master Customer, lalu lengkapi shipment customer itu yang kotanya masih kosong. */
export async function updateCustomerCity(customerId: number, cityInput: string) {
  await requireAuthenticatedUser()
  const city = cleanCity(cityInput)
  const { data: customer, error } = await supabaseAdmin.from('customers').select('id, customer_code, customer_name, dk_lk').eq('id', customerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!customer) throw new Error('Customer tidak ditemukan.')

  const patch: Record<string, string> = { city }
  if (blank(customer.dk_lk)) patch.dk_lk = inferDkLk(city) ?? 'LK'
  const { error: updateError } = await supabaseAdmin.from('customers').update(patch).eq('id', customer.id)
  if (updateError) throw new Error(updateError.message)

  const { data: shipments } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, customer_code, customer_name')
    .or('destination_city.is.null,destination_city.eq.')
    .ilike('customer_name', likeExact(customer.customer_name))
  const matching = (shipments ?? []).filter(row => blank(row.customer_code) || nameKey(row.customer_code) === nameKey(customer.customer_code))
  if (matching.length) await applyShipmentCities(matching.map(row => ({ id: row.id, city })), false)
  return { shipmentsUpdated: matching.length }
}
