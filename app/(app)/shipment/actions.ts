'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ShipmentTrackingRow = {
  id: number
  source_type: 'PSS' | 'Crossdocking'
  pss_no: string | null
  crossdocking_id: number | null
  outbound_header_id: number | null
  trip_id: string | null
  transporter_id: number | null
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
  // Biaya Eksternal
  invoice_no_eksternal: string | null
  total_biaya_eksternal: number | null
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

export type TransporterOption = { id: number; name: string; type: string; service_model: string | null }
export type VehicleOption     = { id: number; vehicle_no: string; vehicle_type: string | null }
export type DriverOption      = { id: number; driver_name: string; phone: string | null; role: string }
export type RouteOption       = { id: number; route_code: string; origin: string; destination: string }

export async function getShipmentTrackings(filters?: { status?: string }) {
  let q = supabaseAdmin
    .from('vw_shipment_tms')
    .select('*')
    .order('promised_delivery_date', { ascending: false })
    .limit(200)

  if (filters?.status && filters.status !== 'all') {
    q = q.eq('status', filters.status)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ShipmentTrackingRow[]
}

export async function upsertShipmentTracking(row: Partial<ShipmentTrackingRow> & { id?: number }) {
  // Kolom joined (dari view) — jangan di-insert ke tabel
  // is_on_time, total_biaya, cost_ratio — dihitung otomatis via trigger, boleh dilewat
  const {
    id,
    transporter_name, transporter_type, transporter_service_model,
    vehicle_no, driver_name, helper_name, route_code,
    is_on_time, total_biaya, cost_ratio,
    ...payload
  } = row

  if (id) {
    const { error } = await supabaseAdmin.from('shipment_tracking').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('shipment_tracking').insert(payload)
    if (error) throw error
  }
}

export async function deleteShipmentTracking(id: number) {
  const { error } = await supabaseAdmin.from('shipment_tracking').delete().eq('id', id)
  if (error) throw error
}

export async function getShipmentTMSOptions() {
  const [tr, veh, drv, rt, pss] = await Promise.all([
    supabaseAdmin.from('master_transporter').select('id, name, type, service_model').eq('is_active', true).order('type').order('name'),
    supabaseAdmin.from('transport_fleet').select('id, vehicle_no, vehicle_type').order('vehicle_no'),
    supabaseAdmin.from('master_driver').select('id, driver_name, phone, role').eq('is_active', true).order('role').order('driver_name'),
    supabaseAdmin.from('routes').select('id, route_code, origin, destination').order('route_code'),
    // PSS yang belum punya shipment_tracking
    supabaseAdmin.from('outbound_header')
      .select('id, pss_no, customer_name, destination_city: ship_to_city, promised_delivery_date, document_date')
      .order('document_date', { ascending: false })
      .limit(500),
  ])
  return {
    transporters: (tr.data ?? []) as TransporterOption[],
    vehicles:     (veh.data ?? []) as VehicleOption[],
    drivers:      (drv.data ?? []) as DriverOption[],
    routes:       (rt.data ?? []) as RouteOption[],
    pssOptions:   (pss.data ?? []) as any[],
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
  const { error } = await supabaseAdmin.from('delivery_pod').delete().eq('id', id)
  if (error) throw error
}

// Setelah POD disimpan, otomatis update status shipment → Delivered + set delivery_time
export async function confirmDelivery(trackingId: number, deliveryTime: string) {
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
