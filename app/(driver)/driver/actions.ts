'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  DRIVER_SESSION_MAX_AGE_SECONDS,
  decodeDriverSession,
  encodeDriverSession,
  type DriverSession,
} from '@/lib/driverAuth'
import * as service from '@/lib/driver-service'

export type { DriverSession } from '@/lib/driverAuth'

const COOKIE_NAME = 'scm_driver_session'
const LOGIN_FAILED = 'Username atau PIN salah'

async function startDriverSession(session: DriverSession) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, encodeDriverSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DRIVER_SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
  return session
}

async function requireDriverSession() {
  const session = await getDriverSession()
  if (!session) throw new Error('Sesi driver berakhir, silakan login ulang')
  return session
}

/** Pesan service aman ditampilkan; error lain disamarkan dari driver. */
function failure(error: unknown) {
  const known = error instanceof service.DriverInputError || error instanceof service.DriverAccessError
  if (!known) console.error('[driver action]', error)
  return { success: false as const, error: known ? (error as Error).message : 'Terjadi kesalahan, silakan coba lagi' }
}

export async function driverLogin(username: string, pin: string) {
  if (!username || !username.trim()) {
    return { success: false as const, error: 'Username wajib diisi' }
  }
  if (!pin || !pin.trim()) {
    return { success: false, error: 'PIN wajib diisi' }
  }

  const result = await service.authenticateDriver(username, pin)
  if (result.status === 'ok') return { success: true as const, error: undefined, driver: await startDriverSession(result.session) }
  if (result.status === 'must_change_pin') return { success: false, mustChangePin: true, error: 'Buat PIN baru untuk melanjutkan' }
  if (result.status === 'inactive') return { success: false, error: 'Akun driver ini sedang dinonaktifkan' }
  if (result.status === 'locked') return { success: false, error: service.pinLockedMessage(result.minutes) }
  return { success: false, error: LOGIN_FAILED }
}

export async function driverChangeDefaultPin(username: string, currentPin: string, newPin: string) {
  try {
    return { success: true as const, error: undefined, driver: await startDriverSession(await service.changeDefaultPin(username, currentPin, newPin)) }
  } catch (error) {
    return failure(error)
  }
}

export async function getDriverSession(): Promise<DriverSession | null> {
  const cookieStore = await cookies()
  return decodeDriverSession(cookieStore.get(COOKIE_NAME)?.value)
}

export async function driverLogout() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  return { success: true as const, error: undefined }
}

export async function getDriverActiveTrips() {
  const { id: driverId } = await requireDriverSession()
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const currentMonthStart = `${y}-${m}-01`

  // Hanya ambil pengiriman bulan aktif untuk driver ini yang BELUM Selesai (bukan Delivered / Failed)
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select(`
      id, trip_id, pss_no, customer_name, destination_city, destination_address,
      dk_lk, document_date, status, dispatch_time, delivery_time, notes,
      bbm_liter, bbm_rupiah, delivery_sequence, failure_reason, receiver_type
    `)
    .eq('driver_id', driverId)
    .neq('status', 'Delivered')
    .neq('status', 'Failed Delivery')
    .neq('status', 'Closed')
    .gte('document_date', currentMonthStart)
    .order('delivery_sequence', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('getDriverActiveTrips error:', error)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  // Ambil trip aktif terbaru yang memiliki pengiriman pending
  const activeTripId = data[0].trip_id
  if (!activeTripId) return []

  const activeShipments = data.filter(d => d.trip_id === activeTripId)

  // Ambil koordinat master customers untuk geofencing
  const customerNames = Array.from(new Set(activeShipments.map(s => s.customer_name).filter(Boolean)))
  const customerLocMap: Record<string, { lat: number; lng: number }> = {}

  if (customerNames.length > 0) {
    const { data: custLocs } = await supabaseAdmin
      .from('customers')
      .select('customer_name, latitude, longitude')
      .in('customer_name', customerNames)

    if (custLocs) {
      for (const c of custLocs) {
        if (c.latitude != null && c.longitude != null) {
          customerLocMap[c.customer_name.trim().toLowerCase()] = {
            lat: Number(c.latitude),
            lng: Number(c.longitude),
          }
        }
      }
    }
  }

  return activeShipments.map(s => {
    const cleanName = (s.customer_name ?? '').trim().toLowerCase()
    const loc = customerLocMap[cleanName]
    return {
      ...s,
      target_lat: loc?.lat ?? null,
      target_lng: loc?.lng ?? null,
    }
  })
}

export async function startDriverTrip(tripId: string, odometerStart: number) {
  try {
    const session = await requireDriverSession()
    await service.startTrip(session.id, tripId, odometerStart)
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function finishDriverTrip(tripId: string, odometerEnd: number) {
  try {
    const session = await requireDriverSession()
    return { success: true as const, error: undefined, summary: await service.finishTrip(session.id, tripId, odometerEnd) }
  } catch (error) {
    return failure(error)
  }
}

export async function saveDriverLocation(payload: {
  trip_id: string
  driver_id?: number
  latitude: number
  longitude: number
  speed_kmh?: number
  distance_from_last_meters?: number
}) {
  try {
    const session = await requireDriverSession()
    await service.saveLocations(session.id, [payload])
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function logDriverFuel(payload: service.FuelInput & { driver_id?: number }) {
  try {
    const session = await requireDriverSession()
    await service.recordFuel(session.id, payload)
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function submitDriverPod(payload: {
  shipment_id: number
  pss_no: string
  recipient_name: string
  receiver_type?: string
  notes?: string
  photo_receipt_url?: string
  signature_url?: string
  distance_meters?: number
  lat?: number
  lng?: number
}) {
  try {
    const session = await requireDriverSession()
    const { photo_receipt_url, ...pod } = payload
    await service.submitPod(session.id, session.driver_name, { ...pod, photo_url: photo_receipt_url })
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function submitDriverFailedPod(payload: {
  shipment_id: number
  pss_no: string
  failure_reason: string
  notes?: string
  photo_url?: string
  lat?: number
  lng?: number
}) {
  try {
    const session = await requireDriverSession()
    await service.submitFailedDelivery(session.id, payload)
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function logDriverAdhocExpense(payload: service.ExpenseInput & { driver_id?: number }) {
  try {
    const session = await requireDriverSession()
    await service.recordExpense(session.id, payload)
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function getDriverAdhocExpenses(tripId: string) {
  try {
    const session = await requireDriverSession()
    await service.assertTripOwned(tripId, session.id)
    const { data, error } = await supabaseAdmin
      .from('trip_adhoc_expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: false })

    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

export async function updateDeliverySequence(updates: { id: number; delivery_sequence: number }[]) {
  try {
    const session = await requireDriverSession()
    await service.updateDeliverySequence(session.id, updates)
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function getTripClosingSummary(tripId: string) {
  try {
    const session = await requireDriverSession()
    return { success: true as const, error: undefined, summary: await service.getTripClosingSummary(session.id, tripId) }
  } catch (error) {
    return failure(error)
  }
}

// ── Dipakai portal versi baru (tampilan sama dengan aplikasi Android) ─────────

export type DriverTrip = Awaited<ReturnType<typeof service.listDriverTrips>>[number]
export type DriverHistoryTrip = Awaited<ReturnType<typeof service.listDriverTripHistory>>[number]

/** Semua trip aktif driver, sama dengan GET /api/driver/trips. */
export async function getDriverTrips() {
  const session = await getDriverSession()
  if (!session || !(await service.isDriverActive(session.id))) return { success: false as const, expired: true, error: 'Sesi berakhir, silakan login ulang' }
  try {
    return { success: true as const, error: undefined, trips: await service.listDriverTrips(session.id) }
  } catch (error) {
    return failure(error)
  }
}

export async function getDriverTripHistory() {
  try {
    const session = await requireDriverSession()
    return { success: true as const, error: undefined, trips: await service.listDriverTripHistory(session.id) }
  } catch (error) {
    return failure(error)
  }
}

export async function driverChangePin(currentPin: string, newPin: string) {
  try {
    const session = await requireDriverSession()
    await service.changeDriverPin(session.id, currentPin, newPin)
    return { success: true as const, error: undefined }
  } catch (error) {
    return failure(error)
  }
}
