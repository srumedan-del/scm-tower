import { decodeDriverSession, encodeDriverSession, type DriverSession } from '@/lib/driverAuth'
import {
  DriverAccessError, DriverInputError, authenticateDriver, changeDefaultPin, changeDriverPin, finishTrip,
  getTripClosingSummary, getTripCostDetails, isDriverActive, listDriverTripHistory, listDriverTrips, pinLockedMessage, recordExpense, recordFuel, saveLocations,
  startTrip, storeDriverImage, submitFailedDelivery, submitPod, updateDeliverySequence,
} from '@/lib/driver-service'

type Context = { params: Promise<{ action: string }> }

const json = (body: unknown, status = 200) => Response.json(body, { status })

async function requireSession(request: Request): Promise<DriverSession> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const session = decodeDriverSession(token)
  if (!session || !(await isDriverActive(session.id))) {
    throw new DriverAccessError('Sesi berakhir, silakan login ulang')
  }
  return session
}

function toResponse(error: unknown) {
  if (error instanceof DriverInputError) return json({ error: error.message }, 400)
  if (error instanceof DriverAccessError) {
    return json({ error: error.message }, error.message.startsWith('Sesi') ? 401 : 403)
  }
  console.error('[api/driver]', error)
  return json({ error: 'Terjadi kesalahan pada server' }, 500)
}

export async function GET(request: Request, context: Context) {
  try {
    const { action } = await context.params
    const session = await requireSession(request)
    if (action === 'trips') return json({ trips: await listDriverTrips(session.id) })
    if (action === 'history') return json({ trips: await listDriverTripHistory(session.id) })
    if (action === 'summary') {
      const tripNo = new URL(request.url).searchParams.get('trip_id') ?? ''
      return json({ summary: await getTripClosingSummary(session.id, tripNo) })
    }
    if (action === 'costs') {
      const tripNo = new URL(request.url).searchParams.get('trip_id') ?? ''
      return json(await getTripCostDetails(session.id, tripNo))
    }
    return json({ error: 'Tidak ditemukan' }, 404)
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { action } = await context.params

    if (action === 'login') {
      const { username, pin } = await request.json()
      const result = await authenticateDriver(String(username ?? ''), String(pin ?? ''))
      if (result.status === 'ok') return json({ token: encodeDriverSession(result.session), driver: result.session })
      if (result.status === 'must_change_pin') return json({ mustChangePin: true })
      if (result.status === 'inactive') return json({ error: 'Akun driver ini sedang dinonaktifkan' }, 403)
      if (result.status === 'locked') return json({ error: pinLockedMessage(result.minutes) }, 429)
      return json({ error: 'Username atau PIN salah' }, 401)
    }

    if (action === 'change-pin') {
      const { username, pin, newPin } = await request.json()
      const session = await changeDefaultPin(String(username ?? ''), String(pin ?? ''), String(newPin ?? ''))
      return json({ token: encodeDriverSession(session), driver: session })
    }

    const session = await requireSession(request)

    if (action === 'upload') {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) throw new DriverInputError('File foto tidak ditemukan')
      // Sebagian klien tidak mengirim tipe file; foto dari aplikasi selalu JPEG.
      const untyped = !file.type || file.type === 'application/octet-stream'
      const contentType = untyped ? (/\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg') : file.type
      const path = await storeDriverImage(new Uint8Array(await file.arrayBuffer()), contentType, session.id)
      return json({ path })
    }

    const body = await request.json()
    if (action === 'pin') {
      await changeDriverPin(session.id, String(body.currentPin ?? ''), String(body.newPin ?? ''))
      return json({ ok: true })
    }
    switch (action) {
      case 'trip-start':
        return json(await startTrip(session.id, String(body.trip_id), Number(body.odometer_start)))
      case 'trip-finish':
        return json({ summary: await finishTrip(session.id, String(body.trip_id), Number(body.odometer_end)) })
      case 'fuel':
        await recordFuel(session.id, body)
        return json({ ok: true })
      case 'expense':
        await recordExpense(session.id, body)
        return json({ ok: true })
      case 'pod':
        await submitPod(session.id, session.driver_name, body)
        return json({ ok: true })
      case 'failed':
        await submitFailedDelivery(session.id, body)
        return json({ ok: true })
      case 'locations':
        await saveLocations(session.id, Array.isArray(body.points) ? body.points : [])
        return json({ ok: true })
      case 'sequence':
        await updateDeliverySequence(session.id, Array.isArray(body.updates) ? body.updates : [])
        return json({ ok: true })
      default:
        return json({ error: 'Tidak ditemukan' }, 404)
    }
  } catch (error) {
    return toResponse(error)
  }
}
