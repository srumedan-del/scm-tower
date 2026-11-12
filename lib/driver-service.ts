import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getLatestVehicleOdometers } from '@/lib/vehicle-odometer'
import { isPersonalVehicleType } from '@/lib/personal-vehicle'
import { DEFAULT_DRIVER_PIN, hashPin, isDefaultPin, isHashedPin, isValidNewPin, verifyPin } from '@/lib/driverAuth'

/**
 * Logika bisnis driver, dipakai portal web (Server Actions) dan aplikasi Android
 * (/api/driver). Semua fungsi menerima driverId dari sesi terverifikasi, bukan
 * dari input client.
 */

const POD_BUCKET = 'pod-documents'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ACTIVE_WINDOW_DAYS = 45
const FINISHED_STATUSES = ['Delivered', 'Failed Delivery', 'Closed']

export class DriverAccessError extends Error {}
export class DriverInputError extends Error {}

// ── Akun ──────────────────────────────────────────────────────────────────────

async function findDriver(username: string) {
  const cleanUser = username.trim().toLowerCase()
  // Nilai ini masuk ke filter PostgREST, jadi karakter sintaks filter ditolak.
  if (!/^[a-z0-9._-]+$/.test(cleanUser)) return null

  const { data, error } = await supabaseAdmin
    .from('master_driver')
    .select('*')
    .or(`username.eq.${cleanUser},driver_code.ilike.${cleanUser}`)
    .limit(1)

  if (error || !data?.length) return null
  return data[0]
}

function toSession(driver: any) {
  return {
    id: Number(driver.id),
    driver_code: String(driver.driver_code),
    driver_name: String(driver.driver_name),
    role: String(driver.role ?? 'Driver'),
  }
}

export type LoginResult =
  | { status: 'ok'; session: ReturnType<typeof toSession> }
  | { status: 'must_change_pin' }
  | { status: 'inactive' }
  | { status: 'locked'; minutes: number }
  | { status: 'failed' }

const MAX_PIN_ATTEMPTS = 5
const PIN_LOCK_MINUTES = 15

export function pinLockedMessage(minutes: number) {
  return `Terlalu banyak percobaan PIN. Coba lagi dalam ${minutes} menit.`
}

function pinLockMinutesLeft(driver: any) {
  const remaining = driver.pin_locked_until ? new Date(driver.pin_locked_until).getTime() - Date.now() : 0
  return remaining > 0 ? Math.ceil(remaining / 60_000) : 0
}

async function recordPinFailure(driverId: number) {
  const { error } = await supabaseAdmin.rpc('record_driver_pin_failure', {
    p_driver_id: driverId,
    p_max_attempts: MAX_PIN_ATTEMPTS,
    p_lock_minutes: PIN_LOCK_MINUTES,
  })
  if (error) console.warn('driver pin failure not recorded:', error.message)
}

export async function authenticateDriver(username: string, pin: string): Promise<LoginResult> {
  const cleanPin = pin.trim()
  const driver = await findDriver(username)
  if (!driver) return { status: 'failed' }
  if (!driver.is_active) return { status: 'inactive' }

  const lockedMinutes = pinLockMinutesLeft(driver)
  if (lockedMinutes > 0) return { status: 'locked', minutes: lockedMinutes }

  // PIN default tidak boleh dipakai masuk: driver wajib membuat PIN sendiri.
  if (isDefaultPin(driver.pin)) {
    return cleanPin === DEFAULT_DRIVER_PIN ? { status: 'must_change_pin' } : { status: 'failed' }
  }

  if (!verifyPin(cleanPin, driver.pin)) {
    await recordPinFailure(Number(driver.id))
    return { status: 'failed' }
  }

  // Login berhasil: hitungan salah direset dan PIN teks biasa peninggalan lama di-hash.
  const updates: Record<string, unknown> = {}
  if (driver.pin_failed_attempts || driver.pin_locked_until) Object.assign(updates, { pin_failed_attempts: 0, pin_locked_until: null })
  if (!isHashedPin(driver.pin)) updates.pin = hashPin(cleanPin)
  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from('master_driver').update(updates).eq('id', driver.id)
    if (error) console.warn('driver login update failed:', error.message)
  }

  return { status: 'ok', session: toSession(driver) }
}

export async function changeDefaultPin(username: string, currentPin: string, newPin: string) {
  const driver = await findDriver(username)
  if (!driver || !driver.is_active || !isDefaultPin(driver.pin) || currentPin.trim() !== DEFAULT_DRIVER_PIN) {
    throw new DriverAccessError('Username atau PIN salah')
  }

  const cleanNewPin = newPin.trim()
  if (!isValidNewPin(cleanNewPin)) throw new DriverInputError('PIN baru harus 6 angka dan tidak boleh 123456')

  const { error } = await supabaseAdmin.from('master_driver').update({ pin: hashPin(cleanNewPin) }).eq('id', driver.id)
  if (error) throw error
  return toSession(driver)
}

/** Ganti PIN oleh driver yang sudah login. PIN lama wajib benar. */
export async function changeDriverPin(driverId: number, currentPin: string, newPin: string) {
  const { data: driver, error } = await supabaseAdmin.from('master_driver').select('id, pin, is_active').eq('id', driverId).maybeSingle()
  if (error) throw error
  if (!driver?.is_active) throw new DriverAccessError('Sesi berakhir, silakan login ulang')
  if (!verifyPin(currentPin.trim(), driver.pin)) throw new DriverInputError('PIN lama salah')

  const cleanNewPin = newPin.trim()
  if (!isValidNewPin(cleanNewPin)) throw new DriverInputError('PIN baru harus 6 angka dan tidak boleh 123456')
  if (cleanNewPin === currentPin.trim()) throw new DriverInputError('PIN baru harus berbeda dari PIN lama')

  const { error: updateError } = await supabaseAdmin.from('master_driver').update({ pin: hashPin(cleanNewPin) }).eq('id', driverId)
  if (updateError) throw updateError
}

export async function isDriverActive(driverId: number) {
  const { data, error } = await supabaseAdmin.from('master_driver').select('is_active').eq('id', driverId).maybeSingle()
  if (error) throw error
  return data?.is_active === true
}

// ── Kepemilikan ───────────────────────────────────────────────────────────────

export async function assertTripOwned(tripNo: string, driverId: number) {
  const { count, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripNo)
    .eq('driver_id', driverId)
  if (error) throw error
  if (!count) throw new DriverAccessError('Trip ini bukan milik driver yang login')
}

async function getOwnedShipment(shipmentId: number, driverId: number) {
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, status, trip_id, pss_no, source_type, crossdocking_id')
    .eq('id', shipmentId)
    .eq('driver_id', driverId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new DriverAccessError('Pengiriman ini bukan milik driver yang login')
  return data
}

// ── Foto ──────────────────────────────────────────────────────────────────────

export async function storeDriverImage(bytes: Uint8Array, contentType: string, driverId: number) {
  if (!contentType.startsWith('image/')) throw new DriverInputError('File harus berupa gambar')
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new DriverInputError('Ukuran foto maksimal 8 MB')

  const extension = contentType === 'image/png' ? 'png' : 'jpg'
  const path = `driver/${driverId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`
  const { error } = await supabaseAdmin.storage.from(POD_BUCKET).upload(path, bytes, { contentType })
  if (error) throw error
  return path
}

/** Portal web mengirim foto base64; simpan ke Storage dan pakai path-nya. */
async function resolveImage(value: string | null | undefined, driverId: number) {
  if (!value) return null
  const match = value.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  if (match) return storeDriverImage(Buffer.from(match[2], 'base64'), match[1], driverId)
  if (!value.startsWith(`driver/${driverId}/`)) throw new DriverInputError('Referensi foto tidak valid')
  return value
}

// ── Trip ──────────────────────────────────────────────────────────────────────

export async function listDriverTrips(driverId: number) {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select(`
      id, trip_id, pss_no, source_type, crossdocking_id, customer_name, destination_city,
      destination_address, dk_lk, document_date, status, dispatch_time, delivery_time,
      delivery_sequence, failure_reason, vehicle_id
    `)
    .eq('driver_id', driverId)
    .not('trip_id', 'is', null)
    .gte('document_date', since)
    .order('delivery_sequence', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
  if (error) throw error

  const openTripNos = [...new Set((data ?? []).filter(row => !FINISHED_STATUSES.includes(row.status)).map(row => String(row.trip_id)))]
  if (!openTripNos.length) return []

  const stops = (data ?? []).filter(row => openTripNos.includes(String(row.trip_id)))
  const pssNos = stops.filter(row => row.source_type === 'PSS' && row.pss_no).map(row => String(row.pss_no))
  const crossdockingIds = stops.filter(row => row.crossdocking_id).map(row => Number(row.crossdocking_id))
  const customerNames = [...new Set(stops.map(row => row.customer_name).filter(Boolean))] as string[]

  const [trips, outboundItems, crossdockingItems, customers] = await Promise.all([
    supabaseAdmin.from('trip').select('trip_no, started_at, odometer_start').in('trip_no', openTripNos),
    pssNos.length
      ? supabaseAdmin.from('outbound_detail').select('document_no, item_no, description, quantity, qty_out, lot_no').in('document_no', pssNos)
      : Promise.resolve({ data: [] as any[], error: null }),
    crossdockingIds.length
      ? supabaseAdmin.from('crossdocking_detail').select('crossdocking_id, item_no, description, quantity, lot_no').in('crossdocking_id', crossdockingIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    customerNames.length
      ? supabaseAdmin.from('customers').select('customer_name, latitude, longitude').in('customer_name', customerNames)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])
  for (const result of [trips, outboundItems, crossdockingItems, customers]) if (result.error) throw result.error

  const vehicleIds = [...new Set(stops.map(row => row.vehicle_id).filter((id): id is number => id != null).map(Number))]
  const [odometers, fleet] = await Promise.all([
    getLatestVehicleOdometers(vehicleIds),
    vehicleIds.length
      ? supabaseAdmin.from('transport_fleet').select('id, vehicle_no, vehicle_type').in('id', vehicleIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])
  if (fleet.error) throw fleet.error
  const vehicleById = new Map((fleet.data ?? []).map((row: any) => [Number(row.id), row]))
  const tripByNo = new Map((trips.data ?? []).map(row => [row.trip_no, row]))
  const customerByName = new Map((customers.data ?? []).map((row: any) => [String(row.customer_name).trim().toLowerCase(), row]))
  const itemsFor = (stop: (typeof stops)[number]) => {
    const rows = stop.source_type === 'PSS'
      ? (outboundItems.data ?? []).filter((row: any) => row.document_no === stop.pss_no && !/^HD[\s-]*SET/i.test(String(row.item_no ?? '')))
      : (crossdockingItems.data ?? []).filter((row: any) => Number(row.crossdocking_id) === Number(stop.crossdocking_id))
    return rows.map((row: any) => ({
      item_no: row.item_no,
      description: row.description ?? row.item_no,
      quantity: Number(row.qty_out || Math.abs(Number(row.quantity ?? 0))) || 0,
      lot_no: row.lot_no ?? null,
    }))
  }

  return openTripNos.map(tripNo => {
    const trip = tripByNo.get(tripNo)
    const vehicleId = stops.find(row => row.trip_id === tripNo && row.vehicle_id != null)?.vehicle_id
    return {
      trip_no: tripNo,
      started_at: trip?.started_at ?? null,
      odometer_start: trip?.odometer_start ?? null,
      last_odometer: vehicleId != null ? odometers.get(Number(vehicleId))?.km ?? null : null,
      personal_vehicle: vehicleId != null && isPersonalVehicleType(vehicleById.get(Number(vehicleId))?.vehicle_type),
      vehicle: vehicleId != null && vehicleById.has(Number(vehicleId))
        ? {
            vehicle_no: String(vehicleById.get(Number(vehicleId)).vehicle_no ?? '').trim().toUpperCase(),
            vehicle_type: vehicleById.get(Number(vehicleId)).vehicle_type ?? null,
          }
        : null,
      stops: stops.filter(row => row.trip_id === tripNo).map(stop => {
        const customer = customerByName.get(String(stop.customer_name ?? '').trim().toLowerCase())
        return {
          id: stop.id,
          reference_no: stop.pss_no ?? `CD-${stop.crossdocking_id}`,
          customer_name: stop.customer_name,
          destination_city: stop.destination_city,
          destination_address: stop.destination_address,
          dk_lk: stop.dk_lk,
          status: stop.status,
          delivery_time: stop.delivery_time,
          failure_reason: stop.failure_reason ?? null,
          target_lat: customer?.latitude ?? null,
          target_lng: customer?.longitude ?? null,
          items: itemsFor(stop),
        }
      }),
    }
  })
}

const HISTORY_WINDOW_DAYS = 30

/** Trip yang semua tujuannya sudah selesai, terbaru dulu. Tanpa daftar barang agar ringan. */
export async function listDriverTripHistory(driverId: number) {
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, trip_id, pss_no, crossdocking_id, customer_name, destination_city, document_date, status, delivery_time, failure_reason')
    .eq('driver_id', driverId)
    .not('trip_id', 'is', null)
    .gte('document_date', since)
    .order('id', { ascending: true })
  if (error) throw error

  const byTrip = new Map<string, NonNullable<typeof data>>()
  for (const row of data ?? []) {
    const key = String(row.trip_id)
    byTrip.set(key, [...(byTrip.get(key) ?? []), row])
  }
  const finishedTripNos = [...byTrip.entries()]
    .filter(([, rows]) => rows.every(row => FINISHED_STATUSES.includes(row.status)))
    .map(([tripNo]) => tripNo)
  if (!finishedTripNos.length) return []

  const { data: trips, error: tripError } = await supabaseAdmin
    .from('trip')
    .select('trip_no, started_at, completed_at, odometer_start, odometer_end')
    .in('trip_no', finishedTripNos)
  if (tripError) throw tripError
  const tripByNo = new Map((trips ?? []).map(row => [row.trip_no, row]))

  return finishedTripNos
    .map(tripNo => {
      const rows = byTrip.get(tripNo) ?? []
      const trip = tripByNo.get(tripNo)
      const lastDelivery = rows.map(row => row.delivery_time).filter(Boolean).sort().at(-1) ?? null
      return {
        trip_no: tripNo,
        document_date: rows.map(row => row.document_date).filter(Boolean).sort()[0] ?? null,
        started_at: trip?.started_at ?? null,
        completed_at: trip?.completed_at ?? lastDelivery,
        distance_km: trip?.odometer_start != null && trip?.odometer_end != null ? trip.odometer_end - trip.odometer_start : null,
        stops: rows.map(row => ({
          id: row.id,
          reference_no: row.pss_no ?? `CD-${row.crossdocking_id}`,
          customer_name: row.customer_name,
          destination_city: row.destination_city,
          status: row.status,
          delivery_time: row.delivery_time,
          failure_reason: row.failure_reason ?? null,
        })),
      }
    })
    .sort((a, b) => String(b.completed_at ?? b.document_date ?? '').localeCompare(String(a.completed_at ?? a.document_date ?? '')))
}

async function ensureTripRecord(tripNo: string, driverId: number) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('trip')
    .select('id, started_at, odometer_start, odometer_end, completed_at')
    .eq('trip_no', tripNo)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing

  const { data: shipments, error: shipmentError } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, source_type, pss_no, crossdocking_id, customer_code, customer_name, destination_address, destination_city, promised_delivery_date, vendor_id, vehicle_id, helper_id, route_id, delivery_sequence')
    .eq('trip_id', tripNo)
    .eq('driver_id', driverId)
    .order('delivery_sequence', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
  if (shipmentError) throw shipmentError
  if (!shipments?.length) throw new DriverAccessError('Trip ini bukan milik driver yang login')

  const first = shipments[0]
  const { data: trip, error: tripError } = await supabaseAdmin
    .from('trip')
    .insert({
      trip_no: tripNo,
      vendor_id: first.vendor_id,
      vehicle_id: first.vehicle_id,
      driver_id: driverId,
      helper_id: first.helper_id,
      route_id: first.route_id,
    })
    .select('id, started_at, odometer_start, odometer_end, completed_at')
    .single()
  if (tripError) throw tripError

  const { error: stopError } = await supabaseAdmin.from('trip_stop').upsert(
    shipments.map((shipment, index) => ({
      trip_id: trip.id,
      shipment_tracking_id: shipment.id,
      stop_sequence: index + 1,
      source_type: shipment.source_type,
      pss_no: shipment.source_type === 'PSS' ? shipment.pss_no : null,
      crossdocking_id: shipment.source_type === 'Crossdocking' ? shipment.crossdocking_id : null,
      customer_code: shipment.customer_code,
      customer_name: shipment.customer_name,
      destination_address: shipment.destination_address,
      destination_city: shipment.destination_city,
      promised_delivery_date: shipment.promised_delivery_date,
    })),
    { onConflict: 'shipment_tracking_id', ignoreDuplicates: true },
  )
  if (stopError) throw stopError
  return trip
}

/** Trip dengan kendaraan pribadi driver tidak mencatat KM. */
async function isPersonalVehicleTrip(tripNo: string) {
  const { data } = await supabaseAdmin.from('shipment_tracking').select('vehicle_id').eq('trip_id', tripNo).not('vehicle_id', 'is', null).limit(1)
  const vehicleId = data?.[0]?.vehicle_id
  if (vehicleId == null) return false
  const { data: vehicle } = await supabaseAdmin.from('transport_fleet').select('vehicle_type').eq('id', vehicleId).maybeSingle()
  return isPersonalVehicleType(vehicle?.vehicle_type)
}

export async function startTrip(driverId: number, tripNo: string, odometerStartInput: number | null) {
  const personal = await isPersonalVehicleTrip(tripNo)
  const odometerStart = personal ? null : odometerStartInput
  if (!personal && (!Number.isInteger(odometerStart) || (odometerStart as number) < 0)) throw new DriverInputError('Odometer awal tidak valid')
  await assertTripOwned(tripNo, driverId)
  const trip = await ensureTripRecord(tripNo, driverId)
  if (trip.started_at) return { started_at: trip.started_at }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('trip')
    .update({ status: 'In Transit', started_at: now, dispatch_time: now, odometer_start: odometerStart })
    .eq('id', trip.id)
  if (error) throw error

  // Waktu keluar gudang yang sebenarnya, untuk lead time dispatch-to-delivery.
  const { error: shipmentError } = await supabaseAdmin
    .from('shipment_tracking')
    .update({ status: 'In Transit', dispatch_time: now })
    .eq('trip_id', tripNo)
    .eq('driver_id', driverId)
    .not('status', 'in', `(${FINISHED_STATUSES.map(status => `"${status}"`).join(',')})`)
  if (shipmentError) throw shipmentError

  return { started_at: now }
}

export async function finishTrip(driverId: number, tripNo: string, odometerEndInput: number | null) {
  const personal = await isPersonalVehicleTrip(tripNo)
  const odometerEnd = personal ? null : odometerEndInput
  if (!personal && (!Number.isInteger(odometerEnd) || (odometerEnd as number) < 0)) throw new DriverInputError('Odometer akhir tidak valid')
  await assertTripOwned(tripNo, driverId)
  const trip = await ensureTripRecord(tripNo, driverId)
  if (trip.completed_at) return getTripClosingSummary(driverId, tripNo)
  if (odometerEnd != null && trip.odometer_start != null && odometerEnd < trip.odometer_start) {
    throw new DriverInputError('Odometer akhir lebih kecil dari odometer awal')
  }

  const summary = await getTripClosingSummary(driverId, tripNo)
  if (summary.totalPending > 0) throw new DriverInputError('Masih ada pengiriman yang belum diselesaikan')

  const { error } = await supabaseAdmin
    .from('trip')
    .update({ status: 'Completed', completed_at: new Date().toISOString(), odometer_end: odometerEnd })
    .eq('id', trip.id)
  if (error) throw error
  return summary
}

export async function getTripClosingSummary(driverId: number, tripNo: string) {
  await assertTripOwned(tripNo, driverId)
  const [shipments, fuel, expenses] = await Promise.all([
    supabaseAdmin.from('shipment_tracking').select('status').eq('trip_id', tripNo),
    supabaseAdmin.from('trip_fuel_logs').select('liters, amount_rupiah').eq('trip_id', tripNo),
    supabaseAdmin.from('trip_adhoc_expenses').select('amount_rupiah').eq('trip_id', tripNo),
  ])
  for (const result of [shipments, fuel, expenses]) if (result.error) throw result.error

  const rows = shipments.data ?? []
  return {
    totalDelivered: rows.filter(row => row.status === 'Delivered').length,
    totalFailed: rows.filter(row => row.status === 'Failed Delivery').length,
    totalPending: rows.filter(row => !FINISHED_STATUSES.includes(row.status)).length,
    totalBbmLiters: (fuel.data ?? []).reduce((sum, row) => sum + (Number(row.liters) || 0), 0),
    totalBbmRp: (fuel.data ?? []).reduce((sum, row) => sum + (Number(row.amount_rupiah) || 0), 0),
    totalAdhocRp: (expenses.data ?? []).reduce((sum, row) => sum + (Number(row.amount_rupiah) || 0), 0),
  }
}

export async function updateDeliverySequence(driverId: number, updates: { id: number; delivery_sequence: number }[]) {
  for (const update of updates) {
    const { error } = await supabaseAdmin
      .from('shipment_tracking')
      .update({ delivery_sequence: update.delivery_sequence })
      .eq('id', update.id)
      .eq('driver_id', driverId)
    if (error) throw error
  }
}

// ── BBM dan biaya ─────────────────────────────────────────────────────────────

async function firstShipmentOfTrip(tripNo: string) {
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id')
    .eq('trip_id', tripNo)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Biaya trip dihitung ulang dari log, jadi kirim ulang tidak menggandakan total. */
async function syncFuelCost(tripNo: string) {
  const { data, error } = await supabaseAdmin.from('trip_fuel_logs').select('liters, amount_rupiah').eq('trip_id', tripNo)
  if (error) throw error
  const shipment = await firstShipmentOfTrip(tripNo)
  if (!shipment) return
  const { error: updateError } = await supabaseAdmin
    .from('shipment_tracking')
    .update({
      bbm_liter: (data ?? []).reduce((sum, row) => sum + (Number(row.liters) || 0), 0),
      bbm_rupiah: (data ?? []).reduce((sum, row) => sum + (Number(row.amount_rupiah) || 0), 0),
    })
    .eq('id', shipment.id)
  if (updateError) throw updateError
}

/** Jenis biaya driver, sama dengan komponen form Shipment Cost. */
export const DRIVER_EXPENSE_TYPES = ['TKBM / SPSI', 'Hotel', 'Tol', 'Makan Driver', 'Makan Helper', 'Parkir', 'Lainnya'] as const
const TRIP_COST_FIELD: Record<string, string> = {
  Hotel: 'hotel_cost',
  Tol: 'toll_cost',
  'Makan Driver': 'uang_makan_driver',
  'Makan Helper': 'uang_makan_helper',
  Parkir: 'parkir_cost',
}

async function syncExpenseCost(tripNo: string) {
  const { data, error } = await supabaseAdmin.from('trip_adhoc_expenses').select('*').eq('trip_id', tripNo)
  if (error) throw error
  const rows = data ?? []
  const amountOf = (row: any) => Number(row.amount_rupiah) || 0

  // TKBM / SPSI ditulis ke PSS masing-masing.
  const tkbmByShipment = new Map<number, number>()
  for (const row of rows) {
    if (row.expense_type !== 'TKBM / SPSI' || !row.shipment_id) continue
    tkbmByShipment.set(Number(row.shipment_id), (tkbmByShipment.get(Number(row.shipment_id)) ?? 0) + amountOf(row))
  }
  for (const [shipmentId, amount] of tkbmByShipment) {
    const { error: tkbmError } = await supabaseAdmin.from('shipment_tracking').update({ bongkar_muat_cost: amount }).eq('id', shipmentId).eq('trip_id', tripNo)
    if (tkbmError) throw tkbmError
  }

  // Biaya lain berlaku untuk satu trip, ditulis ke shipment pertama trip.
  const shipment = await firstShipmentOfTrip(tripNo)
  if (!shipment) return
  const costs: Record<string, number> = {}
  for (const row of rows) {
    if (row.expense_type === 'TKBM / SPSI' && row.shipment_id) continue
    const field = TRIP_COST_FIELD[String(row.expense_type)] ?? 'misc_cost'
    costs[field] = (costs[field] ?? 0) + amountOf(row)
  }
  // Hanya jenis yang punya catatan driver yang ditulis, agar input admin lain tetap utuh.
  const update = Object.fromEntries(Object.entries(costs).filter(([, amount]) => amount > 0))
  if (!Object.keys(update).length) return
  const { error: updateError } = await supabaseAdmin.from('shipment_tracking').update(update).eq('id', shipment.id)
  if (updateError) throw updateError
}

/** Rincian BBM dan biaya satu trip untuk ditampilkan dan dicetak di aplikasi driver. */
export async function getTripCostDetails(driverId: number, tripNo: string) {
  await assertTripOwned(tripNo, driverId)
  const [fuel, expenses, shipments, trip] = await Promise.all([
    supabaseAdmin.from('trip_fuel_logs').select('id, spbu_name_location, fuel_type, liters, amount_rupiah, odometer_after, logged_at').eq('trip_id', tripNo).order('logged_at'),
    supabaseAdmin.from('trip_adhoc_expenses').select('*').eq('trip_id', tripNo).order('recorded_at'),
    supabaseAdmin.from('shipment_tracking').select('id, pss_no, customer_name, destination_city').eq('trip_id', tripNo).order('id'),
    supabaseAdmin.from('trip').select('trip_no, odometer_start, odometer_end, started_at, completed_at').eq('trip_no', tripNo).maybeSingle(),
  ])
  for (const result of [fuel, expenses, shipments]) if (result.error) throw result.error
  const pssById = new Map((shipments.data ?? []).map(row => [Number(row.id), row.pss_no as string | null]))
  return {
    trip: trip.data ?? null,
    shipments: shipments.data ?? [],
    fuel: (fuel.data ?? []).map(row => ({ ...row, liters: Number(row.liters), amount_rupiah: Number(row.amount_rupiah) })),
    expenses: (expenses.data ?? []).map((row: any) => ({
      id: row.id,
      expense_type: row.expense_type,
      amount_rupiah: Number(row.amount_rupiah),
      notes: row.notes ?? '',
      recorded_at: row.recorded_at,
      pss_no: row.shipment_id ? pssById.get(Number(row.shipment_id)) ?? null : null,
    })),
  }
}

async function clientRefExists(table: string, clientRef: string | undefined) {
  if (!clientRef) return false
  const { data, error } = await supabaseAdmin.from(table).select('id').eq('client_ref', clientRef).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export type FuelInput = {
  trip_id: string
  spbu_name_location?: string
  spbu_latitude?: number
  spbu_longitude?: number
  fuel_type?: string
  liters: number
  amount_rupiah: number
  odometer_before?: number
  odometer_after?: number
  photo_odometer_before_url?: string
  photo_odometer_after_url?: string
  photo_receipt_url?: string
  logged_at?: string
  client_ref?: string
}

export async function recordFuel(driverId: number, input: FuelInput) {
  const liters = Number(input.liters)
  const amount = Number(input.amount_rupiah)
  if (!(liters > 0) || !(amount > 0)) throw new DriverInputError('Liter dan nominal BBM wajib diisi')
  await assertTripOwned(input.trip_id, driverId)
  if (await clientRefExists('trip_fuel_logs', input.client_ref)) return

  const { error } = await supabaseAdmin.from('trip_fuel_logs').insert({
    trip_id: input.trip_id,
    driver_id: driverId,
    spbu_name_location: input.spbu_name_location || 'SPBU',
    spbu_latitude: input.spbu_latitude,
    spbu_longitude: input.spbu_longitude,
    fuel_type: input.fuel_type || 'Bio Solar',
    liters,
    amount_rupiah: amount,
    odometer_before: input.odometer_before,
    odometer_after: input.odometer_after,
    photo_odometer_before_url: await resolveImage(input.photo_odometer_before_url, driverId),
    photo_odometer_after_url: await resolveImage(input.photo_odometer_after_url, driverId),
    photo_receipt_url: await resolveImage(input.photo_receipt_url, driverId),
    logged_at: input.logged_at ?? new Date().toISOString(),
    client_ref: input.client_ref ?? null,
  })
  if (error) throw error
  await syncFuelCost(input.trip_id)
}

export type ExpenseInput = {
  trip_id: string
  expense_type: string
  amount_rupiah: number
  notes?: string
  receipt_photo_url?: string
  lat?: number
  lng?: number
  recorded_at?: string
  client_ref?: string
  shipment_id?: number
}

export async function recordExpense(driverId: number, input: ExpenseInput) {
  const amount = Number(input.amount_rupiah)
  if (!input.expense_type || !(amount > 0)) throw new DriverInputError('Jenis dan nominal biaya wajib diisi')
  if (input.expense_type === 'Lainnya' && !String(input.notes ?? '').trim()) throw new DriverInputError('Tulis keterangan untuk biaya lainnya')
  await assertTripOwned(input.trip_id, driverId)
  if (input.shipment_id) {
    const { data: shipment } = await supabaseAdmin.from('shipment_tracking').select('id').eq('id', input.shipment_id).eq('trip_id', input.trip_id).maybeSingle()
    if (!shipment) throw new DriverInputError('PSS tidak ada di trip ini')
  }
  if (await clientRefExists('trip_adhoc_expenses', input.client_ref)) return

  const { error } = await supabaseAdmin.from('trip_adhoc_expenses').insert({
    trip_id: input.trip_id,
    driver_id: driverId,
    expense_type: input.expense_type,
    amount_rupiah: amount,
    notes: input.notes ?? '',
    receipt_photo_url: (await resolveImage(input.receipt_photo_url, driverId)) ?? '',
    latitude: input.lat,
    longitude: input.lng,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    client_ref: input.client_ref ?? null,
    ...(input.shipment_id ? { shipment_id: input.shipment_id } : {}),
  })
  if (error) throw error
  await syncExpenseCost(input.trip_id)
}

// ── POD ───────────────────────────────────────────────────────────────────────

export type PodInput = {
  shipment_id: number
  recipient_name: string
  receiver_type?: string
  notes?: string
  photo_url?: string
  signature_url?: string
  distance_meters?: number
  lat?: number
  lng?: number
  received_at?: string
  client_ref?: string
}

export async function submitPod(driverId: number, driverName: string, input: PodInput) {
  const recipient = input.recipient_name?.trim()
  if (!recipient) throw new DriverInputError('Nama penerima wajib diisi')
  const shipment = await getOwnedShipment(input.shipment_id, driverId)
  if (await clientRefExists('delivery_pod', input.client_ref)) return

  const receivedAt = input.received_at ?? new Date().toISOString()
  const pod = {
    tracking_id: shipment.id,
    receiver_name: recipient,
    received_at: receivedAt,
    photo_url: await resolveImage(input.photo_url, driverId),
    signature_url: await resolveImage(input.signature_url, driverId),
    notes: input.notes?.trim() || null,
    input_by: `Driver: ${driverName}`,
    receiver_type: input.receiver_type ?? null,
    distance_meters: input.distance_meters ?? null,
    arrival_lat: input.lat ?? null,
    arrival_lng: input.lng ?? null,
    client_ref: input.client_ref ?? null,
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('delivery_pod').select('id').eq('tracking_id', shipment.id).maybeSingle()
  if (existingError) throw existingError
  const { data: saved, error: podError } = existing
    ? await supabaseAdmin.from('delivery_pod').update(pod).eq('id', existing.id).select('id').single()
    : await supabaseAdmin.from('delivery_pod').insert(pod).select('id').single()
  if (podError) throw podError

  // Status berubah hanya setelah POD benar-benar tersimpan.
  const { error: statusError } = await supabaseAdmin
    .from('shipment_tracking')
    .update({ status: 'Delivered', delivery_time: receivedAt, receiver_type: input.receiver_type ?? null })
    .eq('id', shipment.id)
  if (statusError) throw statusError

  const { error: stopError } = await supabaseAdmin
    .from('trip_stop')
    .update({ status: 'Delivered', delivery_time: receivedAt, receiver_name: recipient, pod_id: saved.id })
    .eq('shipment_tracking_id', shipment.id)
  if (stopError) throw stopError

  if (shipment.source_type === 'Crossdocking' && shipment.crossdocking_id) {
    const { error } = await supabaseAdmin.from('crossdocking_header').update({ status: 'Delivered' }).eq('id', shipment.crossdocking_id)
    if (error) throw error
  }
}

export type FailedDeliveryInput = {
  shipment_id: number
  failure_reason: string
  notes?: string
  photo_url?: string
  failed_at?: string
}

export async function submitFailedDelivery(driverId: number, input: FailedDeliveryInput) {
  const reason = input.failure_reason?.trim()
  if (!reason) throw new DriverInputError('Alasan gagal kirim wajib dipilih')
  const shipment = await getOwnedShipment(input.shipment_id, driverId)
  if (shipment.status === 'Delivered') return

  const failedAt = input.failed_at ?? new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('shipment_tracking')
    .update({
      status: 'Failed Delivery',
      failed_at: failedAt,
      failure_reason: reason,
      failure_photo_url: await resolveImage(input.photo_url, driverId),
      notes: input.notes?.trim() ? `[GAGAL: ${reason}] ${input.notes.trim()}` : `[GAGAL: ${reason}]`,
    })
    .eq('id', shipment.id)
  if (error) throw error

  const { error: stopError } = await supabaseAdmin
    .from('trip_stop')
    .update({ status: 'Delivery Attempt Failed' })
    .eq('shipment_tracking_id', shipment.id)
  if (stopError) throw stopError
}

// ── Lokasi ────────────────────────────────────────────────────────────────────

export type LocationPoint = {
  trip_id: string
  latitude: number
  longitude: number
  speed_kmh?: number
  distance_from_last_meters?: number
  recorded_at?: string
}

export async function saveLocations(driverId: number, points: LocationPoint[]) {
  const tripNos = [...new Set(points.map(point => point.trip_id))]
  for (const tripNo of tripNos) await assertTripOwned(tripNo, driverId)

  const { error } = await supabaseAdmin.from('driver_location_logs').upsert(
    points.map(point => ({
      trip_id: point.trip_id,
      driver_id: driverId,
      latitude: point.latitude,
      longitude: point.longitude,
      speed_kmh: point.speed_kmh ?? 0,
      distance_from_last_meters: point.distance_from_last_meters ?? 0,
      recorded_at: point.recorded_at ?? new Date().toISOString(),
    })),
    { onConflict: 'trip_id,driver_id,recorded_at', ignoreDuplicates: true },
  )
  if (error) throw error
}
