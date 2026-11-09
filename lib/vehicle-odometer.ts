import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type VehicleOdometer = { km: number; trip_no: string; recorded_at: string | null }

/** KM terakhir tiap kendaraan, dari trip terakhir yang sudah dimulai driver. */
export async function getLatestVehicleOdometers(vehicleIds?: number[]) {
  const result = new Map<number, VehicleOdometer>()
  if (vehicleIds && !vehicleIds.length) return result

  let query = supabaseAdmin
    .from('trip')
    .select('vehicle_id, trip_no, started_at, completed_at, odometer_start, odometer_end')
    .not('vehicle_id', 'is', null)
    .not('odometer_start', 'is', null)
    .order('started_at', { ascending: false, nullsFirst: false })
  if (vehicleIds) query = query.in('vehicle_id', vehicleIds)

  const { data, error } = await query
  if (error) throw error

  for (const trip of data ?? []) {
    const vehicleId = Number(trip.vehicle_id)
    if (result.has(vehicleId)) continue
    result.set(vehicleId, {
      km: Number(trip.odometer_end ?? trip.odometer_start),
      trip_no: String(trip.trip_no),
      recorded_at: trip.completed_at ?? trip.started_at ?? null,
    })
  }
  return result
}
