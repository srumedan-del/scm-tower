import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { ApiError, apiPost } from './api'
import { db, deleteKv, getKv, setKv } from './db'

const TASK_NAME = 'driver-trip-location'
const TRIP_KEY = 'tracking_trip'
const LAST_POINT_KEY = 'tracking_last_point'
const BATCH_SIZE = 100
// Titik disimpan saat kendaraan bergerak, dan tetap tiap 5 menit saat diam,
// agar admin bisa membedakan kendaraan parkir dari HP yang berhenti melacak.
const MOVE_METERS = 40
const HEARTBEAT_MS = 5 * 60_000

type LastPoint = { lat: number; lng: number; at: number }

type TaskData = { locations: Location.LocationObject[] }

TaskManager.defineTask<TaskData>(TASK_NAME, async ({ data, error }) => {
  if (error || !data) return
  const tripNo = getKv<string>(TRIP_KEY)
  if (!tripNo) return
  let last = getKv<LastPoint>(LAST_POINT_KEY)
  for (const point of data.locations) {
    const here = { lat: point.coords.latitude, lng: point.coords.longitude }
    if (last && distanceMeters(last, here) < MOVE_METERS && point.timestamp - last.at < HEARTBEAT_MS) continue
    last = { ...here, at: point.timestamp }
    setKv(LAST_POINT_KEY, last)
    db.runSync(
      'INSERT INTO locations (trip_id, latitude, longitude, speed_kmh, recorded_at) VALUES (?, ?, ?, ?, ?)',
      tripNo,
      point.coords.latitude,
      point.coords.longitude,
      Math.max(0, (point.coords.speed ?? 0) * 3.6),
      new Date(point.timestamp).toISOString(),
    )
  }
  await flushLocations()
})

export async function flushLocations() {
  const points = db.getAllSync<{ id: number; trip_id: string; latitude: number; longitude: number; speed_kmh: number; recorded_at: string }>(
    'SELECT * FROM locations ORDER BY id LIMIT ?', BATCH_SIZE,
  )
  if (!points.length) return
  try {
    await apiPost('locations', { points: points.map(({ id: _id, ...point }) => point) })
    db.runSync('DELETE FROM locations WHERE id <= ?', points[points.length - 1].id)
  } catch (error) {
    // Titik yang ditolak server tidak akan pernah diterima, jadi jangan menumpuk.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
      db.runSync('DELETE FROM locations WHERE id <= ?', points[points.length - 1].id)
    }
  }
}

/** Mengembalikan false jika izin ditolak; pengiriman tetap bisa berjalan tanpa pelacakan. */
export async function startTracking(tripNo: string) {
  const foreground = await Location.requestForegroundPermissionsAsync()
  if (!foreground.granted) return false
  const background = await Location.requestBackgroundPermissionsAsync()
  if (!background.granted) return false

  setKv(TRIP_KEY, tripNo)
  deleteKv(LAST_POINT_KEY)
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    // GPS penuh tiap 15 detik; penyaringan jarak dan sinyal rutin dilakukan di atas.
    accuracy: Location.Accuracy.High,
    distanceInterval: 0,
    timeInterval: 15_000,
    deferredUpdatesInterval: 15_000,
    foregroundService: {
      notificationTitle: 'Trip sedang berjalan',
      notificationBody: 'Lokasi dicatat selama pengiriman',
      notificationColor: '#0D1C33',
    },
  })
  return true
}

export async function stopTracking() {
  deleteKv(TRIP_KEY)
  deleteKv(LAST_POINT_KEY)
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME)
  }
}

export async function currentPosition() {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync()
    if (!granted) return null
    const position = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { lat: position.coords.latitude, lng: position.coords.longitude }
  } catch {
    return null
  }
}

export function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}
