'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { inferDkLk } from '@/lib/dklk'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type ShipmentCostRow = {
  id: number
  source_type: string
  pss_no: string | null
  crossdocking_id: number | null
  trip_id: string | null
  customer_name: string | null
  customer_code: string | null
  destination_city: string | null
  dk_lk: string | null
  document_date: string | null
  promised_delivery_date: string | null
  status: string
  dispatch_time: string | null
  delivery_time: string | null
  is_on_time: boolean | null
  cost_model: string | null
  // Internal
  payment_voucher_no: string | null
  bbm_liter: number | null
  bbm_rupiah: number | null
  bongkar_muat_cost: number | null
  hotel_cost: number | null
  uang_makan_driver: number | null
  uang_makan_helper: number | null
  toll_cost: number | null
  parkir_cost: number | null
  kirim_paket_cost: number | null
  // Retail (Indah Logistik)
  no_resi: string | null
  invoice_no_eksternal: string | null
  total_biaya_eksternal: number | null
  // Trucking (ASSA)
  biaya_trucking: number | null
  biaya_tkbm: number | null
  // Internal — tambahan
  misc_cost: number | null
  misc_cost_notes: string | null
  // Summary
  invoice_value: number | null
  total_biaya: number | null
  cost_ratio: number | null
  // Joined (dari notes jika vendor eksternal)
  transporter_name: string | null
  transporter_type: string | null
  transporter_service_model: string | null
  vehicle_type: string | null
  notes: string | null
  /** Vendor trucking all-in: TKBM sudah termasuk tarif. */
  tkbm_included?: boolean
}

function getNextMonthFirstDay(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return next
}

export async function getShipmentCostAvailableMonths() {
  await requireAuthenticatedUser()
  const { data } = await supabaseAdmin
    .from('shipment_tracking')
    .select('document_date')
    .eq('status', 'Delivered')
    .not('document_date', 'is', null)
    .order('document_date', { ascending: true })
    .limit(1)

  const minDate = data?.[0]?.document_date ?? '2026-01'
  const [minYear, minMonth] = minDate.slice(0, 7).split('-').map(Number)

  const now = new Date()
  const maxYear = now.getFullYear()
  const maxMonth = now.getMonth() + 1

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

export type TripSiblingItem = {
  id: number
  trip_id: string | null
  pss_no: string | null
  customer_name: string | null
  destination_city: string | null
  bongkar_muat_cost: number | null
  biaya_tkbm: number | null
}

export async function getShipmentCostTripItems(tripId: string): Promise<TripSiblingItem[]> {
  await requireAuthenticatedUser()
  if (!tripId) return []
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, trip_id, pss_no, customer_name, destination_city, bongkar_muat_cost, biaya_tkbm')
    .eq('trip_id', tripId)
    .order('id')
  if (error) {
    console.error('getShipmentCostTripItems error:', error)
    return []
  }
  return (data ?? []) as TripSiblingItem[]
}

export async function getShipmentCosts(filters?: {
  status?: string
  cost_model?: string
  dk_lk?: string
  from_date?: string
  to_date?: string
  month?: string
}): Promise<ShipmentCostRow[]> {
  await requireAuthenticatedUser()
  let q = supabaseAdmin
    .from('vw_shipment_tms')
    .select(`
      id, source_type, pss_no, crossdocking_id, trip_id,
      customer_code, customer_name, destination_city, dk_lk,
      document_date, promised_delivery_date, status,
      dispatch_time, delivery_time, is_on_time,
      cost_model, payment_voucher_no,
      bbm_liter, bbm_rupiah, bongkar_muat_cost, hotel_cost,
      uang_makan_driver, uang_makan_helper, toll_cost, parkir_cost, kirim_paket_cost,
      misc_cost, misc_cost_notes,
      no_resi, invoice_no_eksternal, total_biaya_eksternal,
      biaya_trucking, biaya_tkbm,
      invoice_value, total_biaya, cost_ratio,
      transporter_name, transporter_type, transporter_service_model, notes
      , vehicle_type
    `)
    .order('document_date', { ascending: false })
    .order('trip_id', { ascending: true })
    .limit(500)

  // Default menu Shipment Cost hanya menampilkan yang berstatus Delivered
  const targetStatus = filters?.status ?? 'Delivered'
  if (targetStatus !== 'all') {
    q = q.eq('status', targetStatus)
  }

  if (filters?.cost_model && filters.cost_model !== 'all') q = q.eq('cost_model', filters.cost_model)
  if (filters?.dk_lk && filters.dk_lk !== 'all') q = q.eq('dk_lk', filters.dk_lk)
  if (filters?.month && filters.month !== 'all') {
    const nextMonth = getNextMonthFirstDay(filters.month)
    q = q.gte('document_date', `${filters.month}-01`).lt('document_date', nextMonth)
  }
  if (filters?.from_date) q = q.gte('document_date', filters.from_date)
  if (filters?.to_date) q = q.lte('document_date', filters.to_date)

  const { data, error } = await q
  if (error) throw error

  const rows = (data ?? []) as any[]
  const customerCodes = [...new Set(rows.map(row => row.customer_code).filter(Boolean))]
  const customerDkLkByCode = new Map<string, string>()
  const customerDkLkByName = new Map<string, string>()
  if (customerCodes.length) {
    const { data: customers, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('customer_code, customer_name, dk_lk')
      .in('customer_code', customerCodes)
    if (customerError) throw new Error(customerError.message)
    for (const customer of customers ?? []) {
      if (customer.customer_code && customer.dk_lk) customerDkLkByCode.set(String(customer.customer_code), String(customer.dk_lk))
      if (customer.customer_name && customer.dk_lk) customerDkLkByName.set(normalizeRateText(customer.customer_name), String(customer.dk_lk))
    }
  }
  const customerNames = [...new Set(rows.map(row => row.customer_name).filter(Boolean))]
  if (customerNames.length) {
    const { data: customers, error: customerNameError } = await supabaseAdmin
      .from('customers')
      .select('customer_name, dk_lk')
      .in('customer_name', customerNames)
    if (customerNameError) throw new Error(customerNameError.message)
    for (const customer of customers ?? []) {
      if (customer.customer_name && customer.dk_lk) customerDkLkByName.set(normalizeRateText(customer.customer_name), String(customer.dk_lk))
    }
  }
  const tripNos = [...new Set(rows.map(row => row.trip_id).filter(Boolean))]
  const tripVendorByNo = new Map<string, { name: string | null; type: string | null }>()

  if (tripNos.length) {
    const { data: trips } = await supabaseAdmin
      .from('trip')
      .select('trip_no, vendors(vendor_name, vendor_type)')
      .in('trip_no', tripNos)

    for (const trip of trips ?? []) {
      const vendor = Array.isArray(trip.vendors) ? trip.vendors[0] : trip.vendors
      tripVendorByNo.set(trip.trip_no, {
        name: vendor?.vendor_name ?? null,
        type: vendor?.vendor_type ?? null,
      })
    }
  }

  // Vendor all-in TKBM (kolom dari migrasi v46; abaikan jika belum ada).
  const tkbmIncludedNames = new Set<string>()
  {
    const { data: allInVendors, error: allInError } = await supabaseAdmin
      .from('vendors')
      .select('vendor_name')
      .eq('tkbm_included', true)
    if (!allInError) for (const vendor of allInVendors ?? []) tkbmIncludedNames.add(normalizeRateText(vendor.vendor_name))
  }

  // Transporter type is authoritative for legacy rows whose cost_model was
  // saved before the current Internal/External transporter flow existed. The
  // trip vendor is the fallback when the legacy view has no transporter join.
  return rows.map(row => {
    const tripVendor = tripVendorByNo.get(row.trip_id)
    const notesVendor = row.notes?.match(/(?:^|\|\s*)Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? null
    const notesVehicleType = row.notes?.match(/(?:^|\|\s*)Tipe:\s*([^|]+)/i)?.[1]?.trim() ?? null
    const transporterName = row.transporter_name ?? tripVendor?.name ?? notesVendor
    const transporterType = row.transporter_type ?? tripVendor?.type
    const isSruVendor = /\bsru\b/i.test(transporterName ?? '')
    return {
      ...row,
      dk_lk: customerDkLkByCode.get(String(row.customer_code))
        ?? customerDkLkByName.get(normalizeRateText(row.customer_name))
        ?? (row.dk_lk as string | null)
        ?? inferDkLk(row.destination_city)
        ?? null,
      transporter_name: transporterName,
      transporter_type: isSruVendor ? 'Internal' : (transporterType ?? null),
      cost_model: isSruVendor || transporterType === 'Internal'
        ? 'Internal'
        : row.transporter_service_model || row.cost_model,
      vehicle_type: row.vehicle_type ?? notesVehicleType,
      tkbm_included: tkbmIncludedNames.has(normalizeRateText(transporterName)),
    }
  }) as ShipmentCostRow[]
}

function normalizeRateText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

type RateCardMatch = {
  rate_code: string | null
  price: number
  lead_time_days: number | null
  route_notes: string | null
  source_document: string | null
}

type TruckingVendor = {
  id: number
  vendor_name: string
  multidrop_fee_in_city: number | null
  multidrop_fee_out_city: number | null
}

async function findTruckingVendor(transporterName: string | null): Promise<TruckingVendor | null> {
  const normalizedTransporter = normalizeRateText(transporterName)
  if (!normalizedTransporter) return null
  let { data, error } = await supabaseAdmin
    .from('vendors')
    .select('id, vendor_name, multidrop_fee_in_city, multidrop_fee_out_city')
  if (error) {
    // Kolom multidrop dari migrasi v47 belum ada.
    const fallback = await supabaseAdmin.from('vendors').select('id, vendor_name')
    data = (fallback.data ?? []).map(vendor => ({ ...vendor, multidrop_fee_in_city: null, multidrop_fee_out_city: null }))
  }
  const candidates = (data ?? []).filter(vendor => {
    const vendorName = normalizeRateText(vendor.vendor_name)
    return vendorName === normalizedTransporter || vendorName.includes(normalizedTransporter) || normalizedTransporter.includes(vendorName)
  })
  const exact = candidates.find(vendor => normalizeRateText(vendor.vendor_name) === normalizedTransporter)
  const vendor = exact ?? candidates[0]
  if (!vendor) return null
  return {
    id: Number(vendor.id),
    vendor_name: String(vendor.vendor_name),
    multidrop_fee_in_city: vendor.multidrop_fee_in_city == null ? null : Number(vendor.multidrop_fee_in_city),
    multidrop_fee_out_city: vendor.multidrop_fee_out_city == null ? null : Number(vendor.multidrop_fee_out_city),
  }
}

async function findRateCard(vendorId: number, destination: string | null, vehicleType: string | null): Promise<RateCardMatch | null> {
  const normalizedDestination = normalizeRateText(destination)
  const normalizedVehicleType = normalizeRateText(vehicleType)
  if (!normalizedDestination || !normalizedVehicleType) return null
  const { data, error } = await supabaseAdmin
    .from('transport_rate_card')
    .select('rate_code, price, destination, vehicle_type, status, lead_time_days, route_notes, source_document')
    .eq('vendor_id', vendorId)
  if (error) throw new Error(error.message)
  const match = (data ?? []).find(rate =>
    normalizeRateText(rate.destination) === normalizedDestination &&
    normalizeRateText(rate.vehicle_type) === normalizedVehicleType &&
    ['AKTIF', 'ACTIVE'].includes(normalizeRateText(rate.status)) &&
    Number.isFinite(Number(rate.price))
  )
  if (!match) return null
  return {
    rate_code: match.rate_code ?? null,
    price: Number(match.price),
    lead_time_days: match.lead_time_days == null ? null : Number(match.lead_time_days),
    route_notes: match.route_notes ?? null,
    source_document: match.source_document ?? null,
  }
}

export type TripTruckingCharge = {
  /** Biaya trucking untuk dokumen ini. null = tarif tidak ditemukan. */
  price: number | null
  role: 'charter' | 'multidrop_in_city' | 'multidrop_out_city' | 'same_drop' | 'no_rate'
  vendorName: string | null
  vehicleType: string | null
  /** Tujuan dan tarif charter utama Trip. */
  mainDestination: string | null
  mainPss: string | null
  rate: RateCardMatch | null
  multidropFeeInCity: number | null
  multidropFeeOutCity: number | null
  dropCount: number
}

/**
 * Charter dibayar sekali per Trip: titik antar dengan tarif tertinggi menanggung
 * tarif charter. Setiap titik antar tambahan (pelanggan berbeda) dikenai biaya
 * multidrop vendor: dalam kota bila sekota dengan tujuan utama, luar kota bila
 * di kota lain. PSS ke pelanggan yang sama dihitung satu titik.
 */
export async function getTripTruckingRate(input: {
  shipmentId: number
  tripId: string | null
  destination: string | null
  vehicleType: string | null
  transporterName: string | null
}): Promise<TripTruckingCharge> {
  await requireAuthenticatedUser()
  const vendor = await findTruckingVendor(input.transporterName)
  const base = {
    vendorName: vendor?.vendor_name ?? input.transporterName,
    vehicleType: input.vehicleType,
    multidropFeeInCity: vendor?.multidrop_fee_in_city ?? null,
    multidropFeeOutCity: vendor?.multidrop_fee_out_city ?? null,
  }
  if (!vendor) return { ...base, price: null, role: 'no_rate', mainDestination: input.destination, mainPss: null, rate: null, dropCount: 1 }

  const { data: tripRows } = input.tripId
    ? await supabaseAdmin
      .from('shipment_tracking')
      .select('id, pss_no, customer_name, destination_city, status')
      .eq('trip_id', input.tripId)
      .neq('status', 'Failed Delivery')
    : { data: [] as any[] }
  const rows = (tripRows?.length ? tripRows : [{ id: input.shipmentId, pss_no: null, customer_name: null, destination_city: input.destination }])
    .map(row => ({ ...row, id: Number(row.id) }))
    .sort((a, b) => a.id - b.id)

  // Satu titik antar = satu pelanggan (atau satu dokumen bila nama pelanggan kosong).
  const dropKey = (row: { id: number; customer_name: string | null; destination_city: string | null }) =>
    normalizeRateText(row.customer_name) ? `${normalizeRateText(row.customer_name)}|${normalizeRateText(row.destination_city)}` : `#${row.id}`
  const drops = new Map<string, typeof rows>()
  for (const row of rows) drops.set(dropKey(row), [...(drops.get(dropKey(row)) ?? []), row])

  const rateByCity = new Map<string, RateCardMatch | null>()
  for (const row of rows) {
    const city = normalizeRateText(row.destination_city)
    if (!rateByCity.has(city)) rateByCity.set(city, await findRateCard(vendor.id, row.destination_city, input.vehicleType))
  }

  let main: { row: (typeof rows)[number]; rate: RateCardMatch } | null = null
  for (const group of drops.values()) {
    const first = group[0]
    const rate = rateByCity.get(normalizeRateText(first.destination_city)) ?? null
    if (rate && (!main || rate.price > main.rate.price)) main = { row: first, rate }
  }
  const self = rows.find(row => row.id === input.shipmentId)
  const mainInfo = {
    mainDestination: main?.row.destination_city ?? input.destination,
    mainPss: main?.row.pss_no ?? null,
    rate: main?.rate ?? null,
    dropCount: drops.size,
  }
  if (!main || !self) return { ...base, ...mainInfo, price: null, role: 'no_rate' }

  const selfGroup = drops.get(dropKey(self))!
  if (selfGroup[0].id !== self.id) return { ...base, ...mainInfo, price: 0, role: 'same_drop' }
  if (dropKey(self) === dropKey(main.row)) return { ...base, ...mainInfo, price: main.rate.price, role: 'charter' }

  const sameCity = normalizeRateText(self.destination_city) === normalizeRateText(main.row.destination_city)
  return {
    ...base,
    ...mainInfo,
    price: sameCity ? base.multidropFeeInCity ?? 0 : base.multidropFeeOutCity ?? 0,
    role: sameCity ? 'multidrop_in_city' : 'multidrop_out_city',
  }
}

export async function getTruckingRate(destination: string | null, vehicleType: string | null, transporterName: string | null) {
  await requireAuthenticatedUser()
  const vendor = await findTruckingVendor(transporterName)
  if (!vendor) return null
  return (await findRateCard(vendor.id, destination, vehicleType))?.price ?? null
}

export type UpsertCostPayload = {
  id: number
  cost_model: string | null
  // Internal
  payment_voucher_no?: string | null
  bbm_liter?: number | null
  bbm_rupiah?: number | null
  bongkar_muat_cost?: number | null
  hotel_cost?: number | null
  uang_makan_driver?: number | null
  uang_makan_helper?: number | null
  toll_cost?: number | null
  parkir_cost?: number | null
  kirim_paket_cost?: number | null
  misc_cost?: number | null
  misc_cost_notes?: string | null
  // Retail — Indah Logistik
  no_resi?: string | null
  invoice_no_eksternal?: string | null
  total_biaya_eksternal?: number | null
  // Trucking — ASSA
  biaya_trucking?: number | null
  biaya_tkbm?: number | null
  // Common
  invoice_value?: number | null
  // Multi-PSS TKBM breakdown
  sibling_tkbm?: Array<{ id: number; tkbm: number }>
}

export async function upsertShipmentCost(payload: UpsertCostPayload) {
  await requireAuthenticatedUser()
  const { id, sibling_tkbm, ...data } = payload
  const costModel = payload.cost_model === 'Retail' || Boolean(payload.no_resi)
    ? 'Retail'
    : payload.cost_model === 'Trucking'
      ? 'Trucking'
      : 'Internal'

  const normalizedData = costModel === 'Internal'
    ? {
        ...data,
        cost_model: 'Internal',
        invoice_value: null,
        no_resi: null,
        invoice_no_eksternal: null,
        total_biaya_eksternal: null,
        biaya_trucking: null,
        biaya_tkbm: null,
      }
    : costModel === 'Trucking'
      ? {
          ...data,
          cost_model: 'Trucking',
          no_resi: null,
          invoice_no_eksternal: data.invoice_no_eksternal ?? null,
          total_biaya_eksternal: null,
        }
      : {
          ...data,
          cost_model: 'Retail',
          no_resi: data.no_resi ?? null,
          invoice_no_eksternal: data.invoice_no_eksternal ?? null,
          total_biaya_eksternal: data.total_biaya_eksternal ?? null,
          biaya_trucking: null,
          biaya_tkbm: null,
        }

  const { error } = await supabaseAdmin
    .from('shipment_tracking')
    .update(normalizedData)
    .eq('id', id)
  if (error) throw new Error(error.message)

  // Update TKBM untuk masing-masing PSS jika ada breakdown per Surat Jalan / PSS
  if (sibling_tkbm && sibling_tkbm.length > 0) {
    for (const item of sibling_tkbm) {
      if (item.id && item.id !== id) {
        await supabaseAdmin
          .from('shipment_tracking')
          .update({
            bongkar_muat_cost: item.tkbm,
            biaya_tkbm: item.tkbm,
          })
          .eq('id', item.id)
      }
    }
  }
}
