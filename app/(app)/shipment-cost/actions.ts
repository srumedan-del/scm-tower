'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
}

export async function getShipmentCosts(filters?: {
  status?: string
  cost_model?: string
  dk_lk?: string
  from_date?: string
  to_date?: string
}): Promise<ShipmentCostRow[]> {
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

  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters?.cost_model && filters.cost_model !== 'all') q = q.eq('cost_model', filters.cost_model)
  if (filters?.dk_lk && filters.dk_lk !== 'all') q = q.eq('dk_lk', filters.dk_lk)
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
        ?? null,
      transporter_name: transporterName,
      transporter_type: isSruVendor ? 'Internal' : (transporterType ?? null),
      cost_model: isSruVendor || transporterType === 'Internal'
        ? 'Internal'
        : row.transporter_service_model || row.cost_model,
      vehicle_type: row.vehicle_type ?? notesVehicleType,
    }
  }) as ShipmentCostRow[]
}

function normalizeRateText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

export async function getTruckingRate(destination: string | null, vehicleType: string | null, transporterName: string | null) {
  const normalizedDestination = normalizeRateText(destination)
  const normalizedVehicleType = normalizeRateText(vehicleType)
  const normalizedTransporter = normalizeRateText(transporterName)
  if (!normalizedDestination || !normalizedVehicleType || !normalizedTransporter) return null

  const { data: rates, error: rateError } = await supabaseAdmin
    .from('transport_rate_card')
    .select('price, destination, vehicle_type, vendor_id, status')
  if (rateError) throw new Error(rateError.message)

  const vendorIds = [...new Set((rates ?? []).map(rate => rate.vendor_id).filter(Boolean))]
  const { data: vendors, error: vendorError } = vendorIds.length
    ? await supabaseAdmin.from('vendors').select('id, vendor_name').in('id', vendorIds)
    : { data: [], error: null }
  if (vendorError) throw new Error(vendorError.message)
  const transporterIds = new Set((vendors ?? [])
    .filter(vendor => {
      const vendorName = normalizeRateText(vendor.vendor_name)
      return vendorName === normalizedTransporter ||
        vendorName.includes(normalizedTransporter) ||
        normalizedTransporter.includes(vendorName)
    })
    .map(vendor => Number(vendor.id)))

  const matches = (rates ?? []).filter(rate =>
    transporterIds.has(Number(rate.vendor_id)) &&
    normalizeRateText(rate.destination) === normalizedDestination &&
    normalizeRateText(rate.vehicle_type) === normalizedVehicleType &&
    ['AKTIF', 'ACTIVE'].includes(normalizeRateText(rate.status)) &&
    Number.isFinite(Number(rate.price))
  )
  if (!matches.length) return null
  return Number(matches[0].price)
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
}

export async function upsertShipmentCost(payload: UpsertCostPayload) {
  const { id, ...data } = payload
  const normalizedData = (!payload.cost_model || payload.cost_model === 'Internal')
    ? {
        ...data,
        invoice_value: null,
        no_resi: null,
        invoice_no_eksternal: null,
        total_biaya_eksternal: null,
        biaya_trucking: null,
        biaya_tkbm: null,
      }
    : data
  const { error } = await supabaseAdmin
    .from('shipment_tracking')
    .update(normalizedData)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
