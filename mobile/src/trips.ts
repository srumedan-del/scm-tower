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
  last_odometer?: number | null
  vehicle?: { vehicle_no: string; vehicle_type: string | null } | null
  personal_vehicle?: boolean
  stops: Stop[]
}

/** Gudang SRU Medan (sama dengan lib/sru-depot.ts di server). End trip hanya dalam radius ini. */
export const SRU_DEPOT = { lat: 3.60357, lng: 98.62717, radiusMeters: 500 }
// Jarak jalan biasanya ±30% lebih jauh dari garis lurus antar titik.
const ROAD_FACTOR = 1.3

export type DropPoint = { key: string; customer_name: string | null; destination_city: string | null; lat: number | null; lng: number | null; stops: Stop[] }

/** Kelompokkan stop per titik tujuan (drop point) sesuai urutan pengiriman. */
export function dropPoints(stops: Stop[]): DropPoint[] {
  const groups = new Map<string, DropPoint>()
  for (const stop of stops) {
    const key = (stop.customer_name ?? stop.reference_no).trim().toLowerCase()
    const group = groups.get(key)
    if (group) group.stops.push(stop)
    else groups.set(key, { key, customer_name: stop.customer_name, destination_city: stop.destination_city, lat: stop.target_lat, lng: stop.target_lng, stops: [stop] })
  }
  return [...groups.values()]
}

function straightKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Perkiraan jarak rute gudang → drop point berurutan → gudang. Drop point tanpa koordinat dilewati. */
export function planDistance(points: DropPoint[]) {
  const located = points.filter((point): point is DropPoint & { lat: number; lng: number } => point.lat != null && point.lng != null)
  const path = [SRU_DEPOT, ...located, SRU_DEPOT]
  let km = 0
  for (let i = 1; i < path.length; i++) km += straightKm(path[i - 1], path[i])
  return { km: Math.round(km * ROAD_FACTOR), missing: points.length - located.length }
}

const CACHE_KEY = 'trips'

export const isStopDone = (stop: Stop) => ['Delivered', 'Failed Delivery', 'Closed'].includes(stop.status)

export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

let greetingPending = true

/** Dipanggil setelah login agar pop-up salam muncul lagi. */
export function requestGreeting() {
  greetingPending = true
}

export function consumeGreeting() {
  const pending = greetingPending
  greetingPending = false
  return pending
}

export function taskSummary(trips: Trip[]) {
  if (!trips.length) return 'Belum ada tugas pengiriman untuk Anda saat ini.'
  const blocks = trips.map(trip => {
    const open = trip.stops.filter(stop => !isStopDone(stop))
    const vehicle = vehicleLabel(trip)
    const head = vehicle ? `${trip.trip_no} · ${vehicle}` : trip.trip_no
    const state = trip.started_at
      ? `Sedang berjalan: ${trip.stops.length - open.length} dari ${trip.stops.length} tujuan selesai.`
      : `Belum dimulai: ${trip.stops.length} tujuan.`
    const names = open.slice(0, 3).map(stop => stop.customer_name ?? stop.reference_no).join(', ')
    const more = open.length > 3 ? ` dan ${open.length - 3} lainnya` : ''
    const next = open.length ? `\n${trip.started_at ? 'Berikutnya' : 'Tujuan'}: ${names}${more}` : ''
    return `${head}\n${state}${next}`
  })
  return `${blocks.join('\n\n')}\n\nUtamakan keselamatan di jalan.`
}

/** Tujuan pertama yang belum selesai, sesuai urutan pengiriman. */
export function nextStop(trip: Trip) {
  return trip.stops.find(stop => !isStopDone(stop)) ?? null
}

/** True jika stop ini adalah tujuan terakhir yang belum selesai di trip-nya. */
export function isLastOpenStop(trip: Trip, stopId: number) {
  return trip.stops.every(stop => stop.id === stopId || isStopDone(stop))
}

export function vehicleLabel(trip: Trip) {
  if (!trip.vehicle?.vehicle_no) return null
  return [trip.vehicle.vehicle_no, trip.vehicle.vehicle_type].filter(Boolean).join(' · ')
}

/** Koordinat customer bila ada; jika tidak, cari dengan nama dan alamat. */
export function mapsUrl(stop: Stop) {
  const destination = stop.target_lat != null && stop.target_lng != null
    ? `${stop.target_lat},${stop.target_lng}`
    : [stop.customer_name, stop.destination_address, stop.destination_city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`
}

/** Terapkan data yang masih di antrean agar layar sesuai dengan kerja driver. */
function withPendingChanges(trips: Trip[]) {
  const pending = getQueue().map(item => ({ kind: item.kind, payload: JSON.parse(item.payload) }))
  return trips
    .filter(trip => !pending.some(item => item.kind === 'trip-finish' && item.payload.trip_id === trip.trip_no))
    .map(trip => {
      const start = pending.find(item => item.kind === 'trip-start' && item.payload.trip_id === trip.trip_no)
      // Urutan yang diatur driver tapi belum terkirim ke server.
      const sequence = [...pending].reverse().find(item => item.kind === 'sequence' && item.payload.trip_id === trip.trip_no)
      const rank = new Map<number, number>(((sequence?.payload.updates ?? []) as { id: number; delivery_sequence: number }[]).map(update => [update.id, update.delivery_sequence]))
      const ordered = rank.size ? [...trip.stops].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)) : trip.stops
      return {
        ...trip,
        started_at: trip.started_at ?? (start ? new Date().toISOString() : null),
        odometer_start: trip.odometer_start ?? (start?.payload.odometer_start as number | undefined) ?? null,
        stops: ordered.map(stop => {
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
