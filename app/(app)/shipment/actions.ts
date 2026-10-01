'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type ShipmentTrackingRow = {
  id: number
  source_type: 'PSS' | 'Crossdocking'
  pss_no: string | null
  crossdocking_id: number | null
  outbound_header_id: number | null
  trip_id: string | null
  transporter_id: number | null
  vendor_id: number | null
  vehicle_id: number | null
  driver_id: number | null
  helper_id: number | null         // Helper internal (baru - PRD v1.5)
  route_id: number | null
  customer_code: string | null
  customer_name: string | null
  destination_address: string | null
  destination_city: string | null
  dk_lk: string | null             // DK/LK dari customers.dk_lk (baru)
  document_date: string | null
  promised_delivery_date: string | null
  status: 'Draft' | 'Dispatched' | 'In Transit' | 'Delivered'
  dispatch_time: string | null
  delivery_time: string | null
  is_on_time: boolean | null
  weight_kg: number | null
  cost_model: 'Internal' | 'Retail' | 'Trucking' | null
  fleet_type: 'Internal' | 'Eksternal' | null
  // Biaya Internal (rinci)
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
  // Biaya Eksternal — Retail (Indah Logistik)
  no_resi: string | null
  invoice_no_eksternal: string | null
  total_biaya_eksternal: number | null
  // Biaya Eksternal — Trucking (ASSA)
  biaya_trucking: number | null
  biaya_tkbm: number | null
  // Biaya Internal — tambahan
  misc_cost: number | null
  misc_cost_notes: string | null
  // GENERATED (read-only)
  total_biaya: number | null
  invoice_value: number | null
  cost_ratio: number | null
  // Legacy (masih ada di tabel lama untuk compat)
  trip_cost: number | null
  notes: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  // joined fields (dari vw_shipment_tms)
  transporter_name?: string | null
  transporter_type?: string | null
  transporter_service_model?: string | null
  vehicle_no?: string | null
  driver_name?: string | null
  helper_name?: string | null
  route_code?: string | null
}

export type TransporterOption = { id: number; name: string; type: string; service_model: string | null; vendor_type: string | null }
export type VehicleOption     = { id: number; vehicle_no: string; vehicle_type: string | null }
export type DriverOption      = { id: number; driver_name: string; phone: string | null; role: string }
export type RouteOption       = { id: number; route_code: string; origin: string; destination: string; distance_km: number | null }

/** Strict normalized-name match only; ambiguity or no match stays null. */
export async function resolveTransporterFromVendor(vendorId: number | null): Promise<number | null> {
  if (!vendorId) return null
  const { data: vendor, error: vendorError } = await supabaseAdmin
    .from('vendors').select('vendor_name').eq('id', vendorId).maybeSingle()
  if (vendorError) throw vendorError
  const vendorName = normalizeText(vendor?.vendor_name)
  if (!vendorName) return null
  const { data: transporters, error } = await supabaseAdmin
    .from('master_transporter').select('id, name').eq('is_active', true)
  if (error) throw error
  const matches = (transporters ?? []).filter(row => normalizeText(row.name) === vendorName)
  return matches.length === 1 ? Number(matches[0].id) : null
}

async function resolveInternalTransporter(): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('master_transporter')
    .select('id, transporter_code, name, type, is_active')
    .order('name')
    .limit(50)
  if (error) throw error
  const preferred = [...(data ?? [])].sort((first, second) => Number(second.is_active === true) - Number(first.is_active === true)).find(row => {
    const code = normalizeText(row.transporter_code)
    const name = normalizeText(row.name)
    const type = normalizeText(row.type)
    return code === 'TRANS-INT-SRU'
      || (name.includes('SRU') && name.includes('MEDAN'))
      || (type === 'INTERNAL' && name.includes('SRU'))
  })
  if (!preferred) throw new Error('Transporter Internal SRU MEDAN belum tersedia atau belum aktif di master transporter')
  return Number(preferred.id)
}

export async function getShipmentTrackings(filters?: { status?: string }) {
  let q = supabaseAdmin
    .from('shipment_tracking')
    .select('*')
    .order('pss_no', { ascending: false, nullsFirst: false })
    .order('document_date', { ascending: false, nullsFirst: false })
    .limit(200)

  if (filters?.status && filters.status !== 'all') {
    q = q.eq('status', filters.status)
  }

  const { data, error } = await q
  if (error) throw error

  const shipments = (data ?? []) as ShipmentTrackingRow[]
  const transporterIds = [...new Set(shipments.map(row => row.transporter_id).filter((id): id is number => id != null))]
  const driverIds = [...new Set(shipments.map(row => row.driver_id).filter((id): id is number => id != null))]
  const routeIds = [...new Set(shipments.map(row => row.route_id).filter((id): id is number => id != null))]
  const transporterNames = new Map<number, string>()
  const driverNames = new Map<number, string>()
  const routeCodes = new Map<number, string>()

  if (transporterIds.length) {
    const { data: transporters, error: transporterError } = await supabaseAdmin
      .from('master_transporter')
      .select('id, name')
      .in('id', transporterIds)
    if (transporterError) throw transporterError
    for (const transporter of transporters ?? []) transporterNames.set(Number(transporter.id), String(transporter.name ?? '').trim())
  }

  if (driverIds.length) {
    const { data: drivers, error: driverError } = await supabaseAdmin
      .from('master_driver')
      .select('id, driver_name')
      .in('id', driverIds)
    if (driverError) throw driverError
    for (const driver of drivers ?? []) driverNames.set(Number(driver.id), String(driver.driver_name ?? '').trim())
  }

  if (routeIds.length) {
    const { data: routes, error: routeError } = await supabaseAdmin
      .from('routes')
      .select('id, route_code')
      .in('id', routeIds)
    if (routeError) throw routeError
    for (const route of routes ?? []) routeCodes.set(Number(route.id), String(route.route_code ?? '').trim())
  }

  const enrichedShipments = shipments.map(shipment => ({
    ...shipment,
    transporter_name: shipment.transporter_id != null ? transporterNames.get(Number(shipment.transporter_id)) ?? shipment.transporter_name ?? null : shipment.transporter_name ?? null,
    driver_name: shipment.driver_id != null ? driverNames.get(Number(shipment.driver_id)) ?? shipment.driver_name ?? null : shipment.driver_name ?? null,
    route_code: shipment.route_id != null ? routeCodes.get(Number(shipment.route_id)) ?? shipment.route_code ?? null : shipment.route_code ?? null,
  }))

  if (filters?.status === 'all') return enrichedShipments

  return enrichedShipments.filter(shipment => {
    const fallbackVendorName = shipment.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]
    return !isRetailCourier(shipment.transporter_name) && !isRetailCourier(fallbackVendorName)
  })
}

export type ServiceLevelShipmentRow = ShipmentTrackingRow & {
  document_created_at: string | null
  trip_created_at: string | null
}

/** Data ringkas untuk laporan service level pada periode document date tertentu. */
export async function getServiceLevelShipments(startDate: string, endDate: string): Promise<ServiceLevelShipmentRow[]> {
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('*')
    .order('document_date', { ascending: false })
    .limit(2000)

  if (error) throw error

  const shipments = (data ?? []) as ServiceLevelShipmentRow[]
  const transporterIds = [...new Set(shipments.map(row => row.transporter_id).filter((id): id is number => id != null))]
  const driverIds = [...new Set(shipments.map(row => row.driver_id).filter((id): id is number => id != null))]
  const routeIds = [...new Set(shipments.map(row => row.route_id).filter((id): id is number => id != null))]
  const transporterNames = new Map<number, string>()
  const driverNames = new Map<number, string>()
  const routeCodes = new Map<number, string>()

  if (transporterIds.length) {
    const { data: transporters, error: transporterError } = await supabaseAdmin
      .from('master_transporter')
      .select('id, name')
      .in('id', transporterIds)
    if (transporterError) throw transporterError
    for (const transporter of transporters ?? []) transporterNames.set(Number(transporter.id), String(transporter.name ?? '').trim())
  }

  if (driverIds.length) {
    const { data: drivers, error: driverError } = await supabaseAdmin
      .from('master_driver')
      .select('id, driver_name')
      .in('id', driverIds)
    if (driverError) throw driverError
    for (const driver of drivers ?? []) driverNames.set(Number(driver.id), String(driver.driver_name ?? '').trim())
  }

  if (routeIds.length) {
    const { data: routes, error: routeError } = await supabaseAdmin
      .from('routes')
      .select('id, route_code')
      .in('id', routeIds)
    if (routeError) throw routeError
    for (const route of routes ?? []) routeCodes.set(Number(route.id), String(route.route_code ?? '').trim())
  }

  const enrichedShipments = shipments.map(shipment => ({
    ...shipment,
    transporter_name: shipment.transporter_id != null ? transporterNames.get(Number(shipment.transporter_id)) ?? shipment.transporter_name ?? null : shipment.transporter_name ?? null,
    driver_name: shipment.driver_id != null ? driverNames.get(Number(shipment.driver_id)) ?? shipment.driver_name ?? null : shipment.driver_name ?? null,
    route_code: shipment.route_id != null ? routeCodes.get(Number(shipment.route_id)) ?? shipment.route_code ?? null : shipment.route_code ?? null,
  }))

  const shipmentIds = enrichedShipments.map(row => row.id)
  const tripCreatedAtByShipmentId = new Map<number, string>()
  const tripCreatedAtByNo = new Map<string, string>()
  const tripVendorIdByNo = new Map<string, number>()
  const tripNosForLookup = [...new Set(enrichedShipments.map(row => row.trip_id?.trim()).filter(Boolean))] as string[]

  if (tripNosForLookup.length) {
    const { data: tripsByNo, error: tripByNoError } = await supabaseAdmin
      .from('trip')
      .select('trip_no, created_at, vendor_id')
      .in('trip_no', tripNosForLookup)
    if (tripByNoError) throw tripByNoError
    for (const trip of tripsByNo ?? []) {
      const tripNo = String(trip.trip_no ?? '').trim()
      if (!tripNo) continue
      if (trip.created_at) tripCreatedAtByNo.set(tripNo, String(trip.created_at))
      if (trip.vendor_id != null) tripVendorIdByNo.set(tripNo, Number(trip.vendor_id))
    }
  }

  if (shipmentIds.length) {
    const { data: tripStops, error: tripStopError } = await supabaseAdmin
      .from('trip_stop')
      .select('shipment_tracking_id, trip_id')
      .in('shipment_tracking_id', shipmentIds)
    if (tripStopError) throw tripStopError

    const tripIds = [...new Set((tripStops ?? []).map(row => Number(row.trip_id)).filter(Number.isFinite))]
    if (tripIds.length) {
      const { data: trips, error: tripError } = await supabaseAdmin
        .from('trip')
        .select('id, created_at')
        .in('id', tripIds)
      if (tripError) throw tripError
      const tripCreatedAtById = new Map((trips ?? []).map(row => [Number(row.id), String(row.created_at)]))
      for (const tripStop of tripStops ?? []) {
        const createdAt = tripCreatedAtById.get(Number(tripStop.trip_id))
        if (createdAt) tripCreatedAtByShipmentId.set(Number(tripStop.shipment_tracking_id), createdAt)
      }
    }
  }

  const vendorIds = [...new Set(enrichedShipments.map(row => row.vendor_id).filter((id): id is number => id != null))]
  const tripVendorIds = [...new Set([...tripVendorIdByNo.values()].filter(Number.isFinite))]
  const allVendorIds = [...new Set([...vendorIds, ...tripVendorIds])]
  const vendorNames = new Map<number, string>()
  if (allVendorIds.length) {
    const { data: vendors, error: vendorError } = await supabaseAdmin.from('vendors').select('id, vendor_name').in('id', allVendorIds)
    if (vendorError) throw vendorError
    for (const vendor of vendors ?? []) vendorNames.set(Number(vendor.id), String(vendor.vendor_name).trim())
  }
  const pssNosForLookup = [...new Set(enrichedShipments.map(row => row.pss_no?.trim()).filter(Boolean))] as string[]
  const customerCodes = [...new Set(shipments.map(row => row.customer_code).filter(Boolean))]
  const destinationByPss = new Map<string, string>()
  const documentDateByPss = new Map<string, string>()
  const documentCreatedAtByPss = new Map<string, string>()

  if (pssNosForLookup.length) {
    const { data: headers, error: headerError } = await supabaseAdmin
      .from('outbound_header')
      .select('pss_no, shipment_no, document_date, document_created_at, ship_to_city')
      .in('pss_no', pssNosForLookup)
    if (headerError) throw headerError
    for (const header of headers ?? []) {
      const pssNo = String(header.pss_no ?? header.shipment_no ?? '').trim()
      if (pssNo && header.ship_to_city) destinationByPss.set(pssNo, String(header.ship_to_city).trim())
      if (pssNo && header.document_date) documentDateByPss.set(pssNo, String(header.document_date).trim())
      if (pssNo && header.document_created_at) documentCreatedAtByPss.set(pssNo, String(header.document_created_at).trim())
    }
  }

  if (customerCodes.length) {
    const { data: customers, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('customer_code, city')
      .in('customer_code', customerCodes)
    if (customerError) throw customerError
    const cityByCustomer = new Map((customers ?? []).map(customer => [String(customer.customer_code), String(customer.city ?? '').trim()]))
    for (const shipment of shipments) {
      const pssNo = shipment.pss_no?.trim()
      const city = cityByCustomer.get(String(shipment.customer_code))
      if (pssNo && city) destinationByPss.set(pssNo, city)
    }
  }

  const enrichedShipmentsFinal = enrichedShipments.map(shipment => ({
    ...shipment,
    transporter_name: (shipment.vendor_id != null ? vendorNames.get(Number(shipment.vendor_id)) : null)
      ?? (shipment.transporter_id != null ? transporterNames.get(Number(shipment.transporter_id)) : null)
      ?? (shipment.trip_id ? vendorNames.get(tripVendorIdByNo.get(shipment.trip_id.trim()) ?? -1) : null)
      ?? shipment.transporter_name,
    destination_city: shipment.destination_city?.trim() || destinationByPss.get(shipment.pss_no?.trim() ?? '') || null,
    document_date: shipment.document_date ?? documentDateByPss.get(shipment.pss_no?.trim() ?? '') ?? null,
  }))
  const pssNos = [...new Set(enrichedShipmentsFinal.map(row => row.pss_no?.trim()).filter(Boolean))] as string[]
  const crossdockingIds = [...new Set(enrichedShipmentsFinal.map(row => row.crossdocking_id).filter((id): id is number => id != null))]
  const crossdockingCreatedAtById = new Map<number, string>()
  const crossdockingDocumentDateById = new Map<number, string>()

  if (crossdockingIds.length) {
    const { data: crossdockings, error: crossdockingError } = await supabaseAdmin
      .from('crossdocking_header')
      .select('id, document_created_at, document_date')
      .in('id', crossdockingIds)
    if (crossdockingError) throw crossdockingError

    for (const row of crossdockings ?? []) {
      const documentCreatedAt = String(row.document_created_at ?? row.document_date ?? '').trim()
      if (documentCreatedAt) crossdockingCreatedAtById.set(Number(row.id), documentCreatedAt)
      const documentDate = String(row.document_date ?? '').trim()
      if (documentDate) crossdockingDocumentDateById.set(Number(row.id), documentDate)
    }
  }

  for (const shipment of enrichedShipmentsFinal) {
    if (!shipment.document_date && shipment.crossdocking_id != null) {
      shipment.document_date = crossdockingDocumentDateById.get(Number(shipment.crossdocking_id)) ?? null
    }
  }

  if (!pssNos.length) {
    return enrichedShipmentsFinal.filter(shipment => shipment.document_date && shipment.document_date >= startDate && shipment.document_date <= endDate).map(shipment => ({
      ...shipment,
      document_created_at: shipment.crossdocking_id
        ? crossdockingCreatedAtById.get(Number(shipment.crossdocking_id)) ?? shipment.document_date ?? null
        : shipment.document_date ?? null,
      trip_created_at: tripCreatedAtByShipmentId.get(shipment.id)
        ?? (shipment.trip_id ? tripCreatedAtByNo.get(shipment.trip_id.trim()) ?? shipment.created_at ?? null : null),
    }))
  }

  const { data: details, error: detailError } = await supabaseAdmin
    .from('outbound_detail')
    .select('document_no, entry_type, document_created_at')
    .in('document_no', pssNos)
    .not('document_created_at', 'is', null)

  if (detailError) throw detailError

  const createdAtByPss = new Map<string, { sale: string | null; fallback: string | null }>()
  for (const detail of details ?? []) {
    const pssNo = String(detail.document_no ?? '').trim()
    const createdAt = String(detail.document_created_at ?? '')
    if (!pssNo || !createdAt) continue
    const current = createdAtByPss.get(pssNo) ?? { sale: null, fallback: null }
    if (!current.fallback || createdAt < current.fallback) current.fallback = createdAt
    if (String(detail.entry_type ?? '').trim().toLowerCase() === 'sale' && (!current.sale || createdAt < current.sale)) current.sale = createdAt
    createdAtByPss.set(pssNo, current)
  }

  return enrichedShipmentsFinal.filter(shipment => shipment.document_date && shipment.document_date >= startDate && shipment.document_date <= endDate).map(shipment => {
    const created = shipment.pss_no ? createdAtByPss.get(shipment.pss_no.trim()) : undefined
    const crossdockingCreatedAt = shipment.crossdocking_id ? crossdockingCreatedAtById.get(Number(shipment.crossdocking_id)) ?? null : null
    return {
      ...shipment,
      document_created_at: crossdockingCreatedAt
        ?? (shipment.pss_no ? documentCreatedAtByPss.get(shipment.pss_no.trim()) : null)
        ?? created?.sale
        ?? created?.fallback
        ?? shipment.document_date
        ?? null,
      trip_created_at: tripCreatedAtByShipmentId.get(shipment.id)
        ?? (shipment.trip_id ? tripCreatedAtByNo.get(shipment.trip_id.trim()) ?? shipment.created_at ?? null : null),
    }
  })
}

/** Retail shipments handed to a vendor with a resi, but not yet received by customer. */
export async function getRetailInTransitShipments() {
  const rows = await getShipmentTrackings({ status: 'all' })
  return rows
    .filter(row =>
      row.status === 'In Transit'
      && Boolean(row.no_resi?.trim())
      && (row.cost_model === 'Retail' || isRetailCourier(row.transporter_name) || isRetailCourier(row.notes))
    )
    .sort((first, second) => String(second.document_date ?? '').localeCompare(String(first.document_date ?? '')))
    .slice(0, 200)
}

export async function upsertShipmentTracking(row: Partial<ShipmentTrackingRow> & { id?: number }) {
  await requireAuthenticatedUser()
  // Strip semua kolom joined dari view — tidak boleh masuk ke tabel
  const {
    id,
    transporter_name, transporter_type, transporter_service_model,
    vehicle_no, vehicle_type, driver_name, helper_name, route_code, fleet_type,
    is_on_time, total_biaya, cost_ratio,
    payment_voucher_no, bbm_liter, bbm_rupiah, bongkar_muat_cost,
    hotel_cost, uang_makan_driver, uang_makan_helper, toll_cost,
    parkir_cost, kirim_paket_cost, misc_cost, misc_cost_notes,
    invoice_no_eksternal,
    no_resi, total_biaya_eksternal,
    biaya_trucking, biaya_tkbm, invoice_value,
    // Kolom legacy/tidak ada di tabel baru
    trip_cost,
    // timestamps read-only
    created_at, updated_at, document_created_at,
    ...payload
  } = row as any

  payload.no_resi = no_resi == null ? null : String(no_resi).trim() || null
  payload.total_biaya_eksternal = total_biaya_eksternal == null || total_biaya_eksternal === ''
    ? null
    : Number(total_biaya_eksternal)

  // Crossdocking selalu diklasifikasikan sebagai Luar Kota, tanpa bergantung
  // pada pengaturan DK/LK customer master.
  if (payload.source_type === 'Crossdocking') payload.dk_lk = 'LK'

  if (payload.cost_model === 'Internal' && payload.transporter_id == null) {
    payload.transporter_id = await resolveInternalTransporter()
    payload.fleet_type = 'Internal'
  }

  // Resi Retail means the shipment has been handed to the vendor. It is in
  // transit until the customer receipt is confirmed through the POD form.
  const hasRetailResi = Boolean(String(payload.no_resi ?? '').trim())
  const isRetail = payload.cost_model === 'Retail' || /indah\s+logistik/i.test(String(payload.notes ?? '')) || hasRetailResi
  if (isRetail && payload.status !== 'Delivered') {
    payload.cost_model = 'Retail'
    payload.status = 'In Transit'
  }

  if (String(payload.trip_id ?? '').trim()) payload.status = 'In Transit'

  if (id) {
    const { error } = await supabaseAdmin.from('shipment_tracking').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('shipment_tracking').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function updateShipmentRetailCost(input: {
  id: number
  no_resi: string | null
  total_biaya_eksternal: number | null
}) {
  await requireAuthenticatedUser()
  const amount = input.total_biaya_eksternal == null ? null : Number(input.total_biaya_eksternal)
  if (amount !== null && !Number.isFinite(amount)) {
    throw new Error('Biaya kirim harus berupa angka yang valid')
  }

  const normalizedNoResi = input.no_resi?.trim() || null
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .update({
      no_resi: normalizedNoResi,
      total_biaya_eksternal: amount,
      cost_model: normalizedNoResi || amount != null ? 'Retail' : 'Retail',
      status: 'In Transit',
    })
    .eq('id', input.id)
    .select('id, no_resi, total_biaya_eksternal, cost_model, status')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(`Shipment dengan ID ${input.id} tidak ditemukan`)
}

export async function deleteShipmentTracking(id: number) {
  await requireAuthenticatedUser()
  // Hapus POD dulu jika ada (FK ON DELETE CASCADE harusnya handle ini,
  // tapi kalau constraint belum benar, hapus manual)
  await supabaseAdmin.from('delivery_pod').delete().eq('tracking_id', id)
  const { error } = await supabaseAdmin.from('shipment_tracking').delete().eq('id', id)
  if (error) throw error
}

export type UntrackedPssRow = {
  id: number
  source_type: 'PSS' | 'Crossdocking'
  pss_no: string
  customer_no: string | null
  customer_name: string | null
  dk_lk: 'DK' | 'LK' | null
  destination_city: string | null
  document_date: string | null
  document_created_at?: string | null
  promised_delivery_date: string | null
  is_late: boolean | null
  delivery_delay_days: number | null
  psi_no: string | null
  total_koli: number | null
  total_weight_kg: number | null
  total_tonnage: number | null
  total_volume_cbm: number | null
  total_volumetric_ground_kg: number | null
  total_volumetric_air_kg: number | null
  missing_sku_count: number
  incomplete_load_count: number
  products: PssProduct[]
}

export type PssProduct = {
  sku_code: string
  item_name: string | null
  quantity: number
  maintained: boolean
  missing_fields: string[]
}

type PssLoadSummary = Pick<UntrackedPssRow,
  'total_koli' | 'total_weight_kg' | 'total_tonnage' | 'total_volume_cbm' |
  'total_volumetric_ground_kg' | 'total_volumetric_air_kg' | 'missing_sku_count' | 'incomplete_load_count' | 'products'
>

const emptyLoadSummary: PssLoadSummary = {
  total_koli: null,
  total_weight_kg: null,
  total_tonnage: null,
  total_volume_cbm: null,
  total_volumetric_ground_kg: null,
  total_volumetric_air_kg: null,
  missing_sku_count: 0,
  incomplete_load_count: 0,
  products: [],
}

export type ExternalRateSuggestion = {
  id: number
  rate_code: string
  vendor_id: number | null
  vendor_name: string | null
  destination: string
  vehicle_type: string | null
  tonnage: number | null
  cbm: number | null
  price: number
  service_model: 'Retail' | 'Trucking' | null
}

export type InternalCostEstimate = {
  vehicle_type: string
  distance_km: number
  biaya_bbm_per_km: number
  biaya_overhead_flat: number
  estimated_bbm_rupiah: number
  estimated_total: number
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function isRetailCourier(value: unknown) {
  const text = normalizeText(value)
  return text.includes('INDAH LOGISTIK') || text.includes('JNE') || text.includes('RETAIL')
}

function positiveNumber(value: unknown) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.abs(number) : null
}

function normalizeLoadSummary(row: any): PssLoadSummary {
  return {
    total_koli: positiveNumber(row.total_koli),
    total_weight_kg: positiveNumber(row.total_weight_kg),
    total_tonnage: positiveNumber(row.total_tonnage),
    total_volume_cbm: positiveNumber(row.total_volume_cbm),
    total_volumetric_ground_kg: positiveNumber(row.total_volumetric_ground_kg),
    total_volumetric_air_kg: positiveNumber(row.total_volumetric_air_kg),
    missing_sku_count: Number(row.missing_sku_count ?? 0),
    incomplete_load_count: Number(row.incomplete_load_count ?? 0),
    products: [],
  }
}

function dedupeDetailRows(rows: any[] = []) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const entryNo = Number(row?.entry_no)
    const key = Number.isFinite(entryNo)
      ? `entry:${entryNo}`
      : [
          String(row?.document_no ?? '').trim(),
          String(row?.outbound_header_id ?? '').trim(),
          String(row?.item_no ?? '').trim(),
          String(row?.qty_out ?? row?.quantity ?? '').trim(),
        ].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Returns active external rate cards that can carry the selected load, cheapest first. */
export async function getExternalRateSuggestions(input: {
  destination: string | null
  totalTonnage: number
  totalVolumeCbM: number
}) {
  const destination = normalizeText(input.destination)
  if (!destination || input.totalTonnage < 0 || input.totalVolumeCbM < 0) return []

  const { data: rates, error } = await supabaseAdmin
    .from('transport_rate_card')
    .select('id, rate_code, vendor_id, destination, vehicle_type, tonnage, cbm, price, status')
    .order('price', { ascending: true })
  if (error) throw error

  const capacityCandidates = (rates ?? []).filter((rate: any) => {
    const active = ['aktif', 'active'].includes(normalizeText(rate.status).toLowerCase())
    const sameDestination = normalizeText(rate.destination) === destination
    const enoughTonnage = rate.tonnage != null && Number(rate.tonnage) >= input.totalTonnage
    // Some legacy external rate cards only define tonnage. Keep them eligible
    // and show the missing CBM as unknown rather than hiding a valid cheap rate.
    const enoughVolume = rate.cbm == null || Number(rate.cbm) >= input.totalVolumeCbM
    const price = Number(rate.price)
    return active && sameDestination && enoughTonnage && enoughVolume && Number.isFinite(price)
  })

  const vendorIds = [...new Set(capacityCandidates.map((rate: any) => rate.vendor_id).filter(Boolean))]
  const vendorById = new Map<number, { name: string; type: string | null }>()
  if (vendorIds.length) {
    const { data: vendors } = await supabaseAdmin
      .from('vendors')
      .select('id, vendor_name, vendor_type')
      .in('id', vendorIds)
    for (const vendor of vendors ?? []) vendorById.set(vendor.id, { name: vendor.vendor_name, type: vendor.vendor_type })
  }

  const candidates = capacityCandidates.filter((rate: any) => {
    const vendor = rate.vendor_id ? vendorById.get(Number(rate.vendor_id)) : null
    const vendorText = normalizeText(`${vendor?.type ?? ''} ${vendor?.name ?? ''}`)
    const serviceModel: 'Retail' | 'Trucking' = isRetailCourier(vendorText) ? 'Retail' : 'Trucking'
    if (serviceModel === 'Retail') return true

    const tonnageCapacity = Number(rate.tonnage)
    const volumeCapacity = rate.cbm == null ? null : Number(rate.cbm)
    const tonnageBelowHalf = input.totalTonnage < tonnageCapacity * 0.5
    const volumeBelowHalf = volumeCapacity != null && input.totalVolumeCbM < volumeCapacity * 0.5
    return !tonnageBelowHalf && !volumeBelowHalf
  }).slice(0, 10)

  return candidates.map((rate: any) => {
    const vendor = rate.vendor_id ? vendorById.get(Number(rate.vendor_id)) : null
    const vendorText = normalizeText(`${vendor?.type ?? ''} ${vendor?.name ?? ''}`)
    return {
    id: Number(rate.id),
    rate_code: String(rate.rate_code),
    vendor_id: rate.vendor_id == null ? null : Number(rate.vendor_id),
    vendor_name: vendor?.name ?? null,
    destination: String(rate.destination),
    vehicle_type: rate.vehicle_type ?? null,
    tonnage: rate.tonnage == null ? null : Number(rate.tonnage),
    cbm: rate.cbm == null ? null : Number(rate.cbm),
    price: Number(rate.price),
    service_model: isRetailCourier(vendorText) ? 'Retail' : 'Trucking',
  }
  }) as ExternalRateSuggestion[]
}

async function estimateInternalCost(vehicleType: string | null, routeId: number | null): Promise<InternalCostEstimate | null> {
  const normalizedVehicleType = normalizeText(vehicleType)
  if (!normalizedVehicleType || !routeId) return null

  const [{ data: route, error: routeError }, { data: models, error: modelError }] = await Promise.all([
    supabaseAdmin.from('routes').select('distance_km').eq('id', routeId).maybeSingle(),
    supabaseAdmin
      .from('internal_cost_model')
      .select('vehicle_type, biaya_bbm_per_km, biaya_overhead_flat')
      .eq('is_active', true),
  ])
  if (routeError) throw routeError
  if (modelError) throw modelError

  const distanceKm = Number((route as any)?.distance_km)
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null

  const model = (models ?? []).find(row => normalizeText(row.vehicle_type) === normalizedVehicleType)
  if (!model) return null

  const biayaBbmPerKm = Number(model.biaya_bbm_per_km)
  const biayaOverheadFlat = Number(model.biaya_overhead_flat ?? 0)
  if (!Number.isFinite(biayaBbmPerKm) || biayaBbmPerKm < 0 || !Number.isFinite(biayaOverheadFlat) || biayaOverheadFlat < 0) return null

  const estimatedBbmRupiah = Math.round(distanceKm * biayaBbmPerKm)
  return {
    vehicle_type: String(model.vehicle_type),
    distance_km: distanceKm,
    biaya_bbm_per_km: biayaBbmPerKm,
    biaya_overhead_flat: biayaOverheadFlat,
    estimated_bbm_rupiah: estimatedBbmRupiah,
    estimated_total: estimatedBbmRupiah + biayaOverheadFlat,
  }
}

export async function getInternalCostEstimate(input: {
  vehicleType: string | null
  routeId: number | null
}) {
  return estimateInternalCost(input.vehicleType, input.routeId)
}

/** PSS dan Crossdocking yang belum dibuatkan Shipment Tracking. */
export async function getUntrackedPss(): Promise<UntrackedPssRow[]> {
  const [{ data: pssRows, error: pssError }, { data: crossdockings, error: crossdockingError }, { data: tracked, error: trackedError }, { data: loadSummaries, error: loadError }] = await Promise.all([
    supabaseAdmin.from('vw_pss_untracked').select('*').eq('source_type', 'PSS').order('document_date', { ascending: false }).limit(300),
    supabaseAdmin.from('crossdocking_header').select('id, pss_no, customer_code, customer_name, destination_city, document_created_at, document_date, promised_delivery_date, psi_no').not('pss_no', 'is', null).order('document_date', { ascending: false }).limit(300),
    supabaseAdmin.from('shipment_tracking').select('crossdocking_id').eq('source_type', 'Crossdocking').not('crossdocking_id', 'is', null),
    supabaseAdmin.from('vw_pss_load_summary').select('pss_no, total_koli, total_weight_kg, total_tonnage, total_volume_cbm, total_volumetric_ground_kg, total_volumetric_air_kg, missing_sku_count, incomplete_load_count'),
  ])
  if (pssError) throw pssError
  if (crossdockingError) throw crossdockingError
  if (trackedError) throw trackedError

  // Keep transport planning usable before migration_v28 is applied.
  const summaryByPss = new Map<string, PssLoadSummary>(
    loadError ? [] : (loadSummaries ?? []).map(row => [String(row.pss_no).trim(), normalizeLoadSummary(row)])
  )

  const pssNos = (pssRows ?? []).map(row => String(row.pss_no).trim()).filter(Boolean)
  const documentCreatedAtByPss = new Map<string, string>()
  const documentDateByPss = new Map<string, string>()
  if (pssNos.length) {
    const [{ data: headersByPss, error: pssHeaderError }, { data: headersByShipment, error: shipmentHeaderError }] = await Promise.all([
      supabaseAdmin.from('outbound_header').select('id, pss_no, shipment_no, document_date, document_created_at').in('pss_no', pssNos),
      supabaseAdmin.from('outbound_header').select('id, pss_no, shipment_no, document_date, document_created_at').in('shipment_no', pssNos),
    ])
    if (pssHeaderError) throw pssHeaderError
    if (shipmentHeaderError) throw shipmentHeaderError
    const outboundHeaders = [...(headersByPss ?? []), ...(headersByShipment ?? [])]
    for (const header of outboundHeaders) {
      const pssNo = String(header.pss_no ?? header.shipment_no ?? '').trim()
      if (!pssNo) continue
      if (header.document_created_at) documentCreatedAtByPss.set(pssNo, String(header.document_created_at))
      if (header.document_date) documentDateByPss.set(pssNo, String(header.document_date))
    }

    const headerIds = [...new Set([
      ...(outboundHeaders ?? []).map(row => Number(row.id)),
      ...(pssRows ?? []).map(row => Number(row.id)),
    ].filter(Number.isFinite))]
    const headerPssById = new Map([
      ...(outboundHeaders ?? []).map(row => [Number(row.id), String(row.pss_no ?? row.shipment_no ?? '').trim()] as const),
      ...(pssRows ?? []).map(row => [Number(row.id), String(row.pss_no ?? '').trim()] as const),
    ])
    const [{ data: directDetailRows }, { data: linkedDetailRows }, { data: packagingRows }] = await Promise.all([
      supabaseAdmin.from('outbound_detail').select('document_no, outbound_header_id, item_no, quantity, qty_out').in('document_no', pssNos),
      headerIds.length
        ? supabaseAdmin.from('outbound_detail').select('document_no, outbound_header_id, item_no, quantity, qty_out').in('outbound_header_id', headerIds)
        : Promise.resolve({ data: [] }),
      supabaseAdmin.from('master_sku').select('sku_code, item_name, pcs_per_outer_box, outer_box_cbm, outer_box_weight_kg, outer_length_cm, outer_width_cm, outer_height_cm'),
    ])
    const detailRows = dedupeDetailRows([...(directDetailRows ?? []), ...(linkedDetailRows ?? [])])
    const packagingBySku = new Map((packagingRows ?? []).map(row => [String(row.sku_code).trim().toUpperCase(), row as any]))
    const detailsByPss = new Map<string, any[]>()
    for (const row of detailRows ?? []) {
      const key = String(row.document_no ?? '').trim() || headerPssById.get(Number(row.outbound_header_id)) || ''
      if (!key) continue
      const rows = detailsByPss.get(key) ?? []
      rows.push(row)
      detailsByPss.set(key, rows)
    }
    for (const pssNo of pssNos) {
      const rows = detailsByPss.get(pssNo) ?? []
      const productsBySku = new Map<string, PssProduct>()
      for (const detail of rows) {
        const skuCode = String(detail.item_no ?? '').trim()
        if (!skuCode) continue
        const sku = packagingBySku.get(skuCode.toUpperCase())
        const quantity = Number(detail.qty_out || Math.abs(Number(detail.quantity ?? 0))) || 0
        const current = productsBySku.get(skuCode.toUpperCase())
        const missingFields = [
          ['pcs_per_outer_box', 'PCS/KARTON'],
          ['outer_box_weight_kg', 'BERAT KARTON'],
          ['outer_box_cbm', 'KUBIKASI KARTON'],
          ['outer_length_cm', 'PANJANG KARTON'],
          ['outer_width_cm', 'LEBAR KARTON'],
          ['outer_height_cm', 'TINGGI KARTON'],
        ].filter(([field]) => sku?.[field] == null || Number(sku[field]) <= 0).map(([, label]) => label)
        productsBySku.set(skuCode.toUpperCase(), {
          sku_code: skuCode,
          item_name: sku?.item_name ?? null,
          quantity: (current?.quantity ?? 0) + quantity,
          maintained: missingFields.length === 0,
          missing_fields: missingFields,
        })
      }
      let totalQuantity = 0
      let totalKoli = 0
      let totalWeight = 0
      let totalVolume = 0
      let incomplete = 0
      let koliCalculated = 0
      for (const detail of rows) {
        const quantity = Number(detail.qty_out || Math.abs(Number(detail.quantity ?? 0))) || 0
        const sku = packagingBySku.get(String(detail.item_no ?? '').trim().toUpperCase())
        const pcsPerOuter = Number(sku?.pcs_per_outer_box)
        const outerBoxWeight = Number(sku?.outer_box_weight_kg)
        const outerBoxCbm = Number(sku?.outer_box_cbm)
        const rawDimensions = [sku?.outer_length_cm, sku?.outer_width_cm, sku?.outer_height_cm]
        const dimensions = rawDimensions.map(Number)
        if (Number.isFinite(pcsPerOuter) && pcsPerOuter > 0) {
          totalKoli += Math.ceil(quantity / pcsPerOuter)
          koliCalculated++
        }
        const complete = Number.isFinite(pcsPerOuter) && pcsPerOuter > 0 && Number.isFinite(outerBoxWeight) && Number.isFinite(outerBoxCbm) && rawDimensions.every(value => value != null && Number.isFinite(Number(value)))
        if (!complete) {
          incomplete++
          continue
        }
        const koli = Math.ceil(quantity / pcsPerOuter)
        totalQuantity += quantity
        totalWeight += outerBoxWeight / pcsPerOuter * quantity
        totalVolume += outerBoxCbm * koli
      }
      if (rows.length && incomplete === 0) {
        summaryByPss.set(pssNo, {
          total_koli: totalKoli,
          total_weight_kg: totalWeight,
          total_tonnage: totalWeight / 1000,
          total_volume_cbm: totalVolume,
          total_volumetric_ground_kg: null,
          total_volumetric_air_kg: null,
          missing_sku_count: 0,
          incomplete_load_count: 0,
          products: [...productsBySku.values()],
        })
      } else if (rows.length) {
        summaryByPss.set(pssNo, {
          total_koli: koliCalculated > 0 ? totalKoli : null,
          total_weight_kg: totalWeight || null,
          total_tonnage: totalWeight ? totalWeight / 1000 : null,
          total_volume_cbm: totalVolume || null,
          total_volumetric_ground_kg: null,
          total_volumetric_air_kg: null,
          missing_sku_count: incomplete,
          incomplete_load_count: incomplete,
          products: [...productsBySku.values()],
        })
      }
    }
  }

  const trackedCrossdockingIds = new Set((tracked ?? []).map(row => Number(row.crossdocking_id)))
  const crossdockingIds = (crossdockings ?? []).map(row => Number(row.id)).filter(Number.isFinite)
  const crossdockingLoadById = new Map<number, PssLoadSummary>()
  if (crossdockingIds.length) {
    const [{ data: crossdockingDetails }, { data: packagingRows }] = await Promise.all([
      supabaseAdmin
        .from('crossdocking_detail')
        .select('crossdocking_id, item_no, quantity')
        .in('crossdocking_id', crossdockingIds),
      supabaseAdmin
        .from('master_sku')
        .select('sku_code, item_name, pcs_per_outer_box, outer_box_cbm, outer_box_weight_kg, outer_length_cm, outer_width_cm, outer_height_cm'),
    ])
    const packagingBySku = new Map((packagingRows ?? []).map(row => [String(row.sku_code).trim().toUpperCase(), row as any]))
    const detailsByCrossdocking = new Map<number, any[]>()
    for (const detail of crossdockingDetails ?? []) {
      const id = Number(detail.crossdocking_id)
      const rows = detailsByCrossdocking.get(id) ?? []
      rows.push(detail)
      detailsByCrossdocking.set(id, rows)
    }

    for (const crossdockingId of crossdockingIds) {
      const rows = detailsByCrossdocking.get(crossdockingId) ?? []
      let totalKoli = 0
      let totalWeight = 0
      let totalVolume = 0
      let koliCalculated = 0
      let incomplete = 0
      const productsBySku = new Map<string, PssProduct>()

      for (const detail of rows) {
        const skuCode = String(detail.item_no ?? '').trim()
        const quantity = Math.abs(Number(detail.quantity ?? 0)) || 0
        const sku = packagingBySku.get(skuCode.toUpperCase())
        const pcsPerOuter = Number(sku?.pcs_per_outer_box)
        const outerBoxWeight = Number(sku?.outer_box_weight_kg)
        const outerBoxCbm = Number(sku?.outer_box_cbm)
        const dimensions = [sku?.outer_length_cm, sku?.outer_width_cm, sku?.outer_height_cm]
        const missingFields = [
          ['pcs_per_outer_box', 'PCS/KARTON'],
          ['outer_box_weight_kg', 'BERAT KARTON'],
          ['outer_box_cbm', 'KUBIKASI KARTON'],
          ['outer_length_cm', 'PANJANG KARTON'],
          ['outer_width_cm', 'LEBAR KARTON'],
          ['outer_height_cm', 'TINGGI KARTON'],
        ].filter(([field]) => sku?.[field] == null || Number(sku[field]) <= 0).map(([, label]) => label)
        if (skuCode) {
          const current = productsBySku.get(skuCode.toUpperCase())
          productsBySku.set(skuCode.toUpperCase(), {
            sku_code: skuCode,
            item_name: sku?.item_name ?? null,
            quantity: (current?.quantity ?? 0) + quantity,
            maintained: missingFields.length === 0,
            missing_fields: missingFields,
          })
        }
        if (Number.isFinite(pcsPerOuter) && pcsPerOuter > 0) {
          const koli = Math.ceil(quantity / pcsPerOuter)
          totalKoli += koli
          koliCalculated++
          if (Number.isFinite(outerBoxWeight) && Number.isFinite(outerBoxCbm) && dimensions.every(value => value != null && Number.isFinite(Number(value)))) {
            totalWeight += outerBoxWeight / pcsPerOuter * quantity
            totalVolume += outerBoxCbm * koli
          } else {
            incomplete++
          }
        } else {
          incomplete++
        }
      }

      if (rows.length) {
        crossdockingLoadById.set(crossdockingId, {
          total_koli: koliCalculated > 0 ? totalKoli : null,
          total_weight_kg: totalWeight || null,
          total_tonnage: totalWeight ? totalWeight / 1000 : null,
          total_volume_cbm: totalVolume || null,
          total_volumetric_ground_kg: null,
          total_volumetric_air_kg: null,
          missing_sku_count: rows.filter(row => !packagingBySku.has(String(row.item_no ?? '').trim().toUpperCase())).length,
          incomplete_load_count: incomplete,
          products: [...productsBySku.values()],
        })
      }
    }
  }

  const customerCodes = [...new Set((pssRows ?? []).map(row => row.customer_no).filter(Boolean))]
  const regionByCustomer = new Map<string, 'DK' | 'LK'>()
  if (customerCodes.length) {
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('customer_code, dk_lk')
      .in('customer_code', customerCodes)
    for (const customer of customers ?? []) {
      if (customer.customer_code && (customer.dk_lk === 'DK' || customer.dk_lk === 'LK')) {
        regionByCustomer.set(customer.customer_code, customer.dk_lk)
      }
    }
  }

  const untrackedCrossdockings = (crossdockings ?? [])
    .filter(row => !trackedCrossdockingIds.has(Number(row.id)))
    .map(row => ({
      id: Number(row.id), source_type: 'Crossdocking' as const, pss_no: String(row.pss_no),
      customer_no: row.customer_code ?? null, customer_name: row.customer_name ?? null,
      dk_lk: 'LK' as const,
      destination_city: row.destination_city ?? null, document_date: row.document_date ?? null,
      document_created_at: row.document_created_at ?? row.document_date ?? null,
      promised_delivery_date: row.promised_delivery_date ?? null, is_late: null,
      delivery_delay_days: null, psi_no: row.psi_no ?? null,
      ...(crossdockingLoadById.get(Number(row.id)) ?? emptyLoadSummary),
    }))

  const pssWithLoad = ((pssRows ?? []) as UntrackedPssRow[]).map(row => ({
    ...emptyLoadSummary,
    ...row,
    document_created_at: row.document_created_at
      ?? documentCreatedAtByPss.get(String(row.pss_no).trim())
      ?? documentDateByPss.get(String(row.pss_no).trim())
      ?? null,
    dk_lk: row.customer_no ? regionByCustomer.get(row.customer_no) ?? null : null,
    ...(summaryByPss.get(String(row.pss_no).trim()) ?? {}),
    products: summaryByPss.get(String(row.pss_no).trim())?.products ?? [],
  }))

  return [...pssWithLoad, ...untrackedCrossdockings]
    .sort((a, b) => {
      const pssOrder = String(b.pss_no ?? '').localeCompare(String(a.pss_no ?? ''), 'en', { numeric: true })
      if (pssOrder !== 0) return pssOrder
      return String(b.document_date ?? '').localeCompare(String(a.document_date ?? ''))
    })
    .slice(0, 300)
}

export async function getShipmentTMSOptions() {
  const [vend, veh, drv, rt, pss, tracked] = await Promise.all([
    supabaseAdmin.from('master_transporter').select('id, name, type, service_model, is_active').eq('is_active', true).order('name'),
    supabaseAdmin.from('transport_fleet').select('id, vehicle_no, vehicle_type').order('vehicle_no'),
    supabaseAdmin.from('master_driver').select('id, driver_name, phone, role').eq('is_active', true).order('role').order('driver_name'),
    supabaseAdmin.from('routes').select('id, route_code, origin, destination, distance_km').order('route_code'),
    // Semua PSS yang tersedia — join dk_lk dari customers via customer_no
    supabaseAdmin.from('outbound_header')
      .select('id, pss_no, customer_name, customer_no, destination_city: ship_to_city, promised_delivery_date, document_date')
      .order('document_date', { ascending: false })
      .limit(500),
    // PSS yang sudah punya tracking — untuk filter dropdown agar tidak duplikat
    supabaseAdmin.from('shipment_tracking')
      .select('pss_no')
      .not('pss_no', 'is', null),
  ])

  // Map master transporter ke TransporterOption
  const transporters: TransporterOption[] = (vend.data ?? []).map((v: any) => ({
    id:            v.id,
    name:          v.name,
    vendor_type:   v.type,
    type:          v.type,
    service_model: v.service_model ?? null,
  }))

  // Lookup dk_lk dari customers untuk PSS options
  const customerNos = [...new Set((pss.data ?? []).map((r: any) => r.customer_no).filter(Boolean))]
  let customerDkLkMap: Record<string, string> = {}
  if (customerNos.length > 0) {
    const { data: custData } = await supabaseAdmin
      .from('customers')
      .select('customer_code, dk_lk')
      .in('customer_code', customerNos)
    for (const c of custData ?? []) {
      if (c.customer_code && c.dk_lk) customerDkLkMap[c.customer_code] = c.dk_lk
    }
  }

  // Exclude PSS yang sudah punya tracking dari dropdown, inject dk_lk
  const trackedSet = new Set((tracked.data ?? []).map((r: any) => r.pss_no as string))
  const pssOptions = (pss.data ?? [])
    .filter((r: any) => !trackedSet.has(r.pss_no))
    .map((r: any) => ({ ...r, dk_lk: customerDkLkMap[r.customer_no] ?? null }))

  return {
    transporters,
    vehicles:   (veh.data ?? []) as VehicleOption[],
    drivers:    (drv.data ?? []) as DriverOption[],
    routes:     (rt.data ?? []) as RouteOption[],
    pssOptions: pssOptions as any[],
  }
}

// ─── POD (Proof of Delivery) ─────────────────────────────────────────────────

export type PodRow = {
  id: number
  tracking_id: number
  receiver_name: string
  received_at: string
  photo_url: string | null
  signature_url: string | null
  notes: string | null
  input_by: string | null
  created_at: string | null
}

export async function getPodByTrackingId(trackingId: number): Promise<PodRow | null> {
  const { data, error } = await supabaseAdmin
    .from('delivery_pod')
    .select('*')
    .eq('tracking_id', trackingId)
    .maybeSingle()
  if (error) throw error
  return data as PodRow | null
}

export async function upsertPod(pod: Omit<PodRow, 'id' | 'created_at'> & { id?: number }) {
  await requireAuthenticatedUser()
  const { id, ...payload } = pod
  if (id) {
    const { error } = await supabaseAdmin.from('delivery_pod').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('delivery_pod').insert(payload)
    if (error) throw error
  }
}

export async function deletePod(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('delivery_pod').delete().eq('id', id)
  if (error) throw error
}

// Setelah POD disimpan, otomatis update status shipment → Delivered + set delivery_time
export async function confirmDelivery(trackingId: number, deliveryTime: string) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin
    .from('shipment_tracking')
    .update({
      status: 'Delivered',
      delivery_time: deliveryTime,
    })
    .eq('id', trackingId)
  if (error) throw error
}

// ─── Assign Trip (multi-drop) ─────────────────────────────────────────────────

export type TripAssignment = {
  transporter_id: number | null
  vehicle_id:     number | null
  driver_id:      number | null
  helper_id:      number | null
  route_id:       number | null
  trip_id:        string | null
  dispatch_time:  string | null          // ISO string jika langsung dispatch
  status:         'Draft' | 'Dispatched' // setelah assign bisa langsung Dispatched
}

export async function assignTrip(shipmentIds: number[], assignment: TripAssignment) {
  await requireAuthenticatedUser()
  if (!shipmentIds.length) throw new Error('Pilih minimal 1 shipment')

  const payload: Record<string, any> = {
    transporter_id: assignment.transporter_id,
    vehicle_id:     assignment.vehicle_id,
    driver_id:      assignment.driver_id,
    helper_id:      assignment.helper_id,
    route_id:       assignment.route_id,
    trip_id:        assignment.trip_id,
    status:         assignment.status,
  }
  if (assignment.status === 'Dispatched' && assignment.dispatch_time) {
    payload.dispatch_time = assignment.dispatch_time
  }

  const { error } = await supabaseAdmin
    .from('shipment_tracking')
    .update(payload)
    .in('id', shipmentIds)
  if (error) throw error
  return shipmentIds.length
}

// ─── Bulk Create Shipment dari PSS Untracked ──────────────────────────────────

export type BulkShipmentPayload = {
  pssRows: UntrackedPssRow[]
  vendor_id:      number | null
  vendor_name:    string | null
  // Kendaraan (input manual untuk eksternal)
  vehicle_nopol:  string | null
  vehicle_type:   string | null
  // Driver (input manual untuk eksternal, atau dari master_driver untuk internal)
  driver_name_ext: string | null
  // Internal master refs (opsional)
  vehicle_id:     number | null
  driver_id:      number | null
  helper_id:      number | null
  route_id:       number | null
  trip_id:        string | null
  cost_model:     'Internal' | 'Retail' | 'Trucking' | null
  status:         'Draft' | 'Dispatched' | 'In Transit'
  dispatch_time:  string | null
}

export async function lookupCustomerDkLk(customerName: string): Promise<string | null> {
  if (!customerName) return null
  const { data } = await supabaseAdmin
    .from('customers')
    .select('dk_lk')
    .ilike('customer_name', customerName.trim())
    .not('dk_lk', 'is', null)
    .limit(1)
    .maybeSingle()
  return (data as any)?.dk_lk ?? null
}

export async function generateTripId(): Promise<string> {
  const now = new Date()
  const yy  = String(now.getFullYear()).slice(2)
  const mm  = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `TRIP-${yy}${mm}-`

  // Ambil semua trip_id bulan ini dan cari nomor urut tertinggi secara numerik
  const { data } = await supabaseAdmin
    .from('shipment_tracking')
    .select('trip_id')
    .like('trip_id', `${prefix}%`)
    .not('trip_id', 'is', null)

  let maxNum = 0
  for (const row of data ?? []) {
    const parts = (row.trip_id as string).split('-')
    const n = parseInt(parts.at(-1) ?? '0', 10)
    if (!isNaN(n) && n > maxNum) maxNum = n
  }
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
}

export async function bulkCreateShipments(payload: BulkShipmentPayload): Promise<number> {
  await requireAuthenticatedUser()
  if (!payload.pssRows.length) throw new Error('Pilih minimal 1 PSS')
  if (payload.cost_model === 'Internal') {
    if (!payload.vehicle_id) throw new Error('Armada internal wajib dipilih')
    if (!payload.driver_id) throw new Error('Driver wajib dipilih')
    if (!payload.route_id) throw new Error('Rute wajib dipilih')
  }
  if (payload.cost_model !== 'Internal') {
    if (!payload.vendor_id) throw new Error('Vendor wajib dipilih')
    if (!payload.vehicle_nopol?.trim()) throw new Error('Nomor Polisi kendaraan wajib diisi')
    if (!payload.vehicle_type?.trim()) throw new Error('Tipe kendaraan wajib diisi')
    if (!payload.driver_name_ext?.trim()) throw new Error('Nama Driver wajib diisi')
    if (!payload.route_id) throw new Error('Rute wajib dipilih')
  }

  const pssNos = payload.pssRows
    .filter(row => row.source_type === 'PSS')
    .map(row => row.pss_no.trim())
    .filter(Boolean)
  const uniquePssNos = [...new Set(pssNos)]
  if (uniquePssNos.length !== pssNos.length) {
    throw new Error('PSS yang sama tidak boleh dipilih lebih dari sekali')
  }

  if (uniquePssNos.length) {
    const { data: existingShipments, error: existingShipmentsError } = await supabaseAdmin
      .from('shipment_tracking')
      .select('pss_no, trip_id')
      .eq('source_type', 'PSS')
      .in('pss_no', uniquePssNos)
    if (existingShipmentsError) throw new Error(existingShipmentsError.message)
    if (existingShipments?.length) {
      const existingPss = existingShipments
        .map(shipment => shipment.trip_id ? `${shipment.pss_no} (${shipment.trip_id})` : shipment.pss_no)
        .join(', ')
      throw new Error(`Shipment untuk PSS berikut sudah ada: ${existingPss}`)
    }
  }

  const transporterId = payload.cost_model === 'Internal'
    ? await resolveInternalTransporter()
    : await resolveTransporterFromVendor(payload.vendor_id)
  const internalEstimate = payload.cost_model === 'Internal'
    ? await estimateInternalCost(payload.vehicle_type, payload.route_id)
    : null
  const internalRowCount = payload.pssRows.length || 1
  const estimatedBbmPerShipment = internalEstimate ? Math.round(internalEstimate.estimated_bbm_rupiah / internalRowCount) : null
  const estimatedOverheadPerShipment = internalEstimate ? Math.round(internalEstimate.biaya_overhead_flat / internalRowCount) : null
  const processTime = new Date().toISOString()

  const rows = payload.pssRows.map(pss => ({
    source_type:            pss.source_type,
    pss_no:                 pss.pss_no || null,
    crossdocking_id:        pss.source_type === 'Crossdocking' ? pss.id : null,
    outbound_header_id:     pss.source_type === 'PSS' ? pss.id : null,
    customer_name:          pss.customer_name,
    destination_city:       pss.destination_city,
    dk_lk:                  pss.source_type === 'Crossdocking' ? 'LK' : null,
    document_date:          pss.document_date,
    promised_delivery_date: pss.promised_delivery_date,
    status:                 'In Transit',
    created_at:             processTime,
    // vendor info (disimpan ke notes sementara, atau kolom baru)
    vendor_id:              payload.vendor_id,
    transporter_id:         transporterId,
    vehicle_id:             payload.vehicle_id,
    driver_id:              payload.driver_id,
    helper_id:              payload.helper_id,
    route_id:               payload.route_id,
    trip_id:                payload.trip_id,
    cost_model:             /indah\s+logistik/i.test(payload.vendor_name ?? '') ? 'Retail' : payload.cost_model,
    bbm_rupiah:             estimatedBbmPerShipment,
    misc_cost:              estimatedOverheadPerShipment,
    misc_cost_notes:        estimatedOverheadPerShipment ? `ESTIMASI OVERHEAD INTERNAL ${internalEstimate?.vehicle_type} ${internalEstimate?.distance_km} KM` : null,
    dispatch_time:          processTime,
    // Simpan info vendor & kendaraan eksternal di notes
    notes: [
      payload.vendor_name   ? `Vendor: ${payload.vendor_name}`      : null,
      payload.vehicle_nopol ? `Nopol: ${payload.vehicle_nopol}`     : null,
      payload.vehicle_type  ? `Tipe: ${payload.vehicle_type}`       : null,
      payload.driver_name_ext ? `Driver: ${payload.driver_name_ext}` : null,
    ].filter(Boolean).join(' | ') || null,
  }))

  const { error } = await supabaseAdmin.from('shipment_tracking').insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}
