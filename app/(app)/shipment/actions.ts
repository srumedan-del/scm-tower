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
  route_id: number | null
  customer_code: string | null
  customer_name: string | null
  destination_address: string | null
  destination_city: string | null
  document_date: string | null
  promised_delivery_date: string | null
  status: 'Draft' | 'Dispatched' | 'In Transit' | 'Delivered'
  dispatch_time: string | null
  delivery_time: string | null
  is_on_time: boolean | null
  weight_kg: number | null
  trip_cost: number | null
  cost_model: 'Internal' | 'Retail' | 'Trucking' | null
  notes: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  // joined fields
  transporter_name?: string | null
  transporter_type?: string | null
  transporter_service_model?: string | null
  vehicle_no?: string | null
  driver_name?: string | null
  route_code?: string | null
}

export type TransporterOption = { id: number; name: string; type: string; service_model: string | null }
export type VehicleOption     = { id: number; vehicle_no: string; vehicle_type: string | null }
export type DriverOption      = { id: number; driver_name: string; phone: string | null }
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
  const { id, transporter_name, transporter_type, transporter_service_model,
          vehicle_no, driver_name, route_code, is_on_time, ...payload } = row

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
    supabaseAdmin.from('master_driver').select('id, driver_name, phone').eq('is_active', true).order('driver_name'),
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
