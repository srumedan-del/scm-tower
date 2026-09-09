'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type TripRow = {
  id: number
  trip_no: string
  status: 'Assigned' | 'Dispatched' | 'In Transit' | 'Completed' | 'Cancelled'
  dispatch_time: string | null
  completed_at: string | null
  vendor_name: string | null
  vehicle_no: string | null
  driver_name: string | null
  stop_count: number
  total_expense: number
}

export type ShipmentOption = {
  id: number
  source_type: 'PSS' | 'Crossdocking'
  reference_no: string
  customer_name: string | null
  destination_city: string | null
  promised_delivery_date: string | null
}

export type VendorOption = { id: number; vendor_name: string }

export async function getTrips(): Promise<TripRow[]> {
  await requireAuthenticatedUser()

  const { data, error } = await supabaseAdmin
    .from('trip')
    .select(`
      id, trip_no, status, dispatch_time, completed_at,
      vendors(vendor_name),
      transport_fleet(vehicle_no),
      master_driver!trip_driver_id_fkey(driver_name),
      trip_stop(id),
      trip_expense(amount)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    trip_no: row.trip_no,
    status: row.status,
    dispatch_time: row.dispatch_time,
    completed_at: row.completed_at,
    vendor_name: row.vendors?.vendor_name ?? null,
    vehicle_no: row.transport_fleet?.vehicle_no ?? null,
    driver_name: row.master_driver?.driver_name ?? null,
    stop_count: row.trip_stop?.length ?? 0,
    total_expense: (row.trip_expense ?? []).reduce(
      (sum: number, expense: { amount: number | null }) => sum + Number(expense.amount ?? 0),
      0,
    ),
  }))
}

export async function getTripCreationOptions(): Promise<{
  vendors: VendorOption[]
  shipments: ShipmentOption[]
}> {
  await requireAuthenticatedUser()

  const [{ data: vendors, error: vendorError }, { data: shipments, error: shipmentError }, { data: assigned, error: assignedError }] = await Promise.all([
    supabaseAdmin.from('vendors').select('id, vendor_name').eq('is_active', true).order('vendor_name'),
    supabaseAdmin
      .from('shipment_tracking')
      .select('id, source_type, pss_no, crossdocking_id, customer_name, destination_city, promised_delivery_date')
      .eq('status', 'Draft')
      .order('promised_delivery_date', { ascending: true })
      .limit(300),
    supabaseAdmin.from('trip_stop').select('shipment_tracking_id').not('shipment_tracking_id', 'is', null),
  ])

  if (vendorError) throw new Error(vendorError.message)
  if (shipmentError) throw new Error(shipmentError.message)
  if (assignedError) throw new Error(assignedError.message)

  const assignedIds = new Set((assigned ?? []).map((row: any) => Number(row.shipment_tracking_id)))
  return {
    vendors: (vendors ?? []) as VendorOption[],
    shipments: (shipments ?? [])
      .filter((shipment: any) => !assignedIds.has(Number(shipment.id)))
      .map((shipment: any) => ({
        id: shipment.id,
        source_type: shipment.source_type,
        reference_no: shipment.pss_no ?? `CD-${shipment.crossdocking_id}`,
        customer_name: shipment.customer_name,
        destination_city: shipment.destination_city,
        promised_delivery_date: shipment.promised_delivery_date,
      })) as ShipmentOption[],
  }
}

export async function createTripFromShipments(input: {
  vendorId: number
  shipmentIds: number[]
  notes?: string
}) {
  const user = await requireAuthenticatedUser()

  if (!Number.isInteger(input.vendorId) || input.vendorId <= 0) {
    throw new Error('Transporter wajib dipilih')
  }
  if (!input.shipmentIds.length || input.shipmentIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('Pilih minimal satu shipment yang valid')
  }

  const { data, error } = await supabaseAdmin.rpc('create_trip_from_shipments', {
    p_vendor_id: input.vendorId,
    p_shipment_ids: input.shipmentIds,
    p_actor_id: user.id,
    p_notes: input.notes?.trim() || null,
  })

  if (error) throw new Error(error.message)
  return (data ?? [])[0] as { trip_id: number; trip_no: string }
}
