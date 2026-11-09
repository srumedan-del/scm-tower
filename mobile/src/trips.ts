import { apiGet } from './api'
import { getKv, setKv } from './db'
import { getQueue } from './queue'

export type StopItem = { item_no: string; description: string; quantity: number; lot_no: string | null }

export type Stop = {
  id: number
  reference_no: string
  customer_name: string | null
  destination_city: string | null
  destination_address: string | null
  dk_lk: string | null
  status: string
  delivery_time: string | null
  failure_reason: string | null
  target_lat: number | null
  target_lng: number | null
  items: StopItem[]
}

export type Trip = {
  trip_no: string
  started_at: string | null
  odometer_start: number | null
  stops: Stop[]
}

const CACHE_KEY = 'trips'

export const isStopDone = (stop: Stop) => ['Delivered', 'Failed Delivery', 'Closed'].includes(stop.status)

/** Terapkan data yang masih di antrean agar layar sesuai dengan kerja driver. */
function withPendingChanges(trips: Trip[]) {
  const pending = getQueue().map(item => ({ kind: item.kind, payload: JSON.parse(item.payload) }))
  return trips
    .filter(trip => !pending.some(item => item.kind === 'trip-finish' && item.payload.trip_id === trip.trip_no))
    .map(trip => {
      const start = pending.find(item => item.kind === 'trip-start' && item.payload.trip_id === trip.trip_no)
      return {
        ...trip,
        started_at: trip.started_at ?? (start ? new Date().toISOString() : null),
        odometer_start: trip.odometer_start ?? (start?.payload.odometer_start as number | undefined) ?? null,
        stops: trip.stops.map(stop => {
          if (pending.some(item => item.kind === 'pod' && item.payload.shipment_id === stop.id)) return { ...stop, status: 'Delivered' }
          if (pending.some(item => item.kind === 'failed' && item.payload.shipment_id === stop.id)) return { ...stop, status: 'Failed Delivery' }
          return stop
        }),
      }
    })
}

export function getCachedTrips() {
  return withPendingChanges(getKv<Trip[]>(CACHE_KEY) ?? [])
}

export async function refreshTrips() {
  const { trips } = await apiGet<{ trips: Trip[] }>('trips')
  setKv(CACHE_KEY, trips)
  return withPendingChanges(trips)
}

export function findStop(id: number) {
  for (const trip of getCachedTrips()) {
    const stop = trip.stops.find(row => row.id === id)
    if (stop) return { trip, stop }
  }
  return null
}

export function activeTrip() {
  const trips = getCachedTrips()
  return trips.find(trip => trip.started_at) ?? trips[0] ?? null
}
