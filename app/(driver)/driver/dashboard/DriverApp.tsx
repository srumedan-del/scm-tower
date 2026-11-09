'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Navigation, User, Wallet } from 'lucide-react'
import {
  driverChangePin, driverLogout, finishDriverTrip, getDriverTripHistory, getDriverTrips, getTripClosingSummary,
  logDriverAdhocExpense, logDriverFuel, saveDriverLocation, startDriverTrip, submitDriverFailedPod, submitDriverPod,
  type DriverHistoryTrip, type DriverSession, type DriverTrip,
} from '../actions'
import { BarcodeScannerModal } from '@/components/driver/BarcodeScannerModal'
import { SignatureCanvas } from '@/components/driver/SignatureCanvas'
import {
  Button, Card, ChoiceRow, ConfirmSheet, ErrorText, Field, Meta, PhotoField, StatusPill,
  currentPosition, distanceMeters, formatDistance, formatRupiah,
} from './ui'

type Stop = DriverTrip['stops'][number]
type Tab = 'trips' | 'money' | 'profile'
type Route =
  | { name: 'trip'; tripNo: string }
  | { name: 'stop'; id: number }
  | { name: 'pod'; id: number }
  | { name: 'failed'; id: number }
  | { name: 'fuel'; tripNo: string }
  | { name: 'expense'; tripNo: string }
  | { name: 'finish'; tripNo: string }
  | { name: 'history' }
  | { name: 'pin' }

const TITLES: Record<Route['name'] | Tab, string> = {
  trips: 'Trip', money: 'BBM & Biaya', profile: 'Profil',
  trip: 'Detail Trip', stop: 'Detail Pengiriman', pod: 'Bukti Terima (POD)', failed: 'Gagal Kirim',
  fuel: 'Catat BBM', expense: 'Catat Biaya', finish: 'Tutup Trip', history: 'Riwayat Trip', pin: 'Ganti PIN',
}

const FINISHED = ['Delivered', 'Failed Delivery', 'Closed']
const isStopDone = (stop: Stop) => FINISHED.includes(stop.status)
const RECEIVER_TYPES = ['Gudang Farmasi', 'Bagian Logistik', 'Perawat', 'Satpam', 'Lainnya']
const FAILURE_REASONS = ['Salah barang', 'Customer tutup', 'Alamat tidak ditemukan', 'Ditolak penerima', 'Lainnya']
const FUEL_TYPES = ['Bio Solar', 'Dexlite', 'Pertamina Dex', 'Pertalite', 'Pertamax']
const EXPENSE_TYPES = ['Tol', 'Parkir', 'Tambal Ban', 'Retribusi', 'Lainnya']
const NEAR_DESTINATION_METERS = 500
const LOCATION_MIN_METERS = 50

type Ctx = {
  trips: DriverTrip[]
  push: (route: Route) => void
  back: () => void
  backToRoot: () => void
  refresh: () => Promise<void>
  notify: (message: string, tone?: 'success' | 'error') => void
}

function findStop(trips: DriverTrip[], id: number) {
  for (const trip of trips) {
    const stop = trip.stops.find(row => row.id === id)
    if (stop) return { trip, stop }
  }
  return null
}

function activeTrip(trips: DriverTrip[]) {
  return trips.find(trip => trip.started_at && !trip.stops.every(isStopDone)) ?? trips[0] ?? null
}

// ── Kerangka: header, tab bawah, navigasi dengan tombol back browser ─────────

export function DriverApp({ driver }: { driver: DriverSession }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('trips')
  const [stack, setStack] = useState<Route[]>([])
  const [trips, setTrips] = useState<DriverTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)

  const refresh = useCallback(async () => {
    const result = await getDriverTrips()
    if (!result.success) {
      if ('expired' in result && result.expired) return router.replace('/driver/login')
      setLoadError(result.error)
    } else {
      setTrips(result.trips)
      setLoadError('')
    }
    setLoading(false)
  }, [router])

  useEffect(() => { void refresh() }, [refresh])

  // Tombol back Android/browser menutup layar teratas, bukan keluar dari portal.
  // Kedalaman disimpan di history.state karena go(-n) hanya memicu satu popstate.
  const depth = useRef(0)
  useEffect(() => {
    window.history.replaceState({ driverDepth: 0 }, '')
    const onPop = (event: PopStateEvent) => {
      const target = typeof event.state?.driverDepth === 'number' ? event.state.driverDepth : 0
      depth.current = target
      setStack(current => current.slice(0, target))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const push = useCallback((route: Route) => {
    depth.current += 1
    window.history.pushState({ driverDepth: depth.current }, '')
    setStack(current => [...current, route])
    window.scrollTo(0, 0)
  }, [])
  const back = useCallback(() => window.history.back(), [])
  const backToRoot = useCallback(() => {
    if (depth.current > 0) window.history.go(-depth.current)
  }, [])

  const notify = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  useLocationTracking(trips)

  const ctx: Ctx = { trips, push, back, backToRoot, refresh, notify }
  const route = stack.at(-1)
  const title = TITLES[route?.name ?? tab]

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5F0] text-[#111827]">
      <header className="sticky top-0 z-30 flex min-h-[56px] items-center gap-2 bg-[#0D1C33] px-2 text-white">
        {route
          ? <button type="button" onClick={back} aria-label="Kembali" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
          : <span className="w-3" />}
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>

      {toast && (
        <div role="status" className={`fixed left-4 right-4 top-16 z-40 mx-auto max-w-md rounded-[14px] px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.tone === 'success' ? 'bg-[#1F8A5B]' : 'bg-[#C8372D]'}`}>
          {toast.message}
        </div>
      )}

      <main className={`flex flex-1 flex-col gap-3 p-4 ${route ? 'pb-8' : 'pb-24'}`}>
        {loading ? <Meta>Memuat data trip...</Meta> : route ? <RouteView route={route} ctx={ctx} /> : (
          <>
            {tab === 'trips' && <TripsTab ctx={ctx} error={loadError} />}
            {tab === 'money' && <MoneyTab ctx={ctx} />}
            {tab === 'profile' && <ProfileTab ctx={ctx} driver={driver} onLogout={async () => { await driverLogout(); router.replace('/driver/login') }} />}
          </>
        )}
      </main>

      {!route && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex h-[62px] max-w-md border-t border-[#E0DACD] bg-white" aria-label="Menu utama">
          {([['trips', 'Trip', Navigation], ['money', 'BBM & Biaya', Wallet], ['profile', 'Profil', User]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${tab === key ? 'text-[#1F3F6E]' : 'text-[#6A6E76]'}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

function RouteView({ route, ctx }: { route: Route; ctx: Ctx }) {
  switch (route.name) {
    case 'trip': return <TripScreen tripNo={route.tripNo} ctx={ctx} />
    case 'stop': return <StopScreen id={route.id} ctx={ctx} />
    case 'pod': return <PodScreen id={route.id} ctx={ctx} />
    case 'failed': return <FailedScreen id={route.id} ctx={ctx} />
    case 'fuel': return <FuelScreen tripNo={route.tripNo} ctx={ctx} />
    case 'expense': return <ExpenseScreen tripNo={route.tripNo} ctx={ctx} />
    case 'finish': return <FinishScreen tripNo={route.tripNo} ctx={ctx} />
    case 'history': return <HistoryScreen />
    case 'pin': return <ChangePinScreen ctx={ctx} />
  }
}

/** Kirim posisi selama ada trip berjalan dan portal terbuka (browser tidak bisa melacak di latar belakang). */
function useLocationTracking(trips: DriverTrip[]) {
  const running = trips.find(trip => trip.started_at && !trip.stops.every(isStopDone))?.trip_no ?? null
  const last = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!running || !('geolocation' in navigator)) return
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude }
        const moved = last.current ? distanceMeters(last.current, point) : Infinity
        if (moved < LOCATION_MIN_METERS) return
        last.current = point
        void saveDriverLocation({
          trip_id: running,
          latitude: point.lat,
          longitude: point.lng,
          speed_kmh: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0,
          distance_from_last_meters: Number.isFinite(moved) ? moved : 0,
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [running])
}

/** Jalankan aksi server, tampilkan error, lalu muat ulang data trip. */
function useSubmit(ctx: Ctx) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<{ success: boolean; error?: string }>, onDone: () => void) {
    setBusy(true)
    setError('')
    try {
      const result = await action()
      if (!result.success) return setError(result.error ?? 'Gagal menyimpan, coba lagi')
      await ctx.refresh()
      onDone()
    } catch {
      setError('Koneksi terputus. Data belum tersimpan, coba lagi.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

// ── Tab ───────────────────────────────────────────────────────────────────────

function TripsTab({ ctx, error }: { ctx: Ctx; error: string }) {
  const stops = ctx.trips.flatMap(trip => trip.stops)
  const tiles = [
    { label: 'Menunggu', value: stops.filter(stop => !isStopDone(stop)).length, className: 'bg-[#FAF0E0] text-[#9A5F0F]' },
    { label: 'Terkirim', value: stops.filter(stop => stop.status === 'Delivered').length, className: 'bg-[#E5F4EC] text-[#1F8A5B]' },
    { label: 'Gagal', value: stops.filter(stop => stop.status === 'Failed Delivery').length, className: 'bg-[#FBECEA] text-[#C8372D]' },
  ]

  return (
    <>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <section className="flex flex-col gap-3 rounded-[18px] bg-[#0D1C33] p-4">
        <p className="text-[13px] font-semibold text-[#E8D5A3]">Tujuan di trip aktif</p>
        <div className="flex gap-2">
          {tiles.map(tile => (
            <div key={tile.label} className={`flex flex-1 flex-col items-center rounded-[10px] py-2.5 ${tile.className}`}>
              <span className="text-[22px] font-extrabold">{tile.value}</span>
              <span className="text-xs font-semibold">{tile.label}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => ctx.push({ name: 'history' })} className="min-h-[44px] self-start text-sm font-bold text-[#C5A25D]">
          Lihat riwayat trip
        </button>
      </section>

      {ctx.trips.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 pt-12 text-center">
          <p className="text-[17px] font-bold">Belum ada trip</p>
          <Meta>Muat ulang halaman setelah admin menugaskan pengiriman.</Meta>
          <div className="mt-3 w-full"><Button label="Muat ulang" tone="outline" onClick={() => void ctx.refresh()} /></div>
        </div>
      )}

      {ctx.trips.map(trip => {
        const done = trip.stops.filter(isStopDone).length
        return (
          <Card key={trip.trip_no} onClick={() => ctx.push({ name: 'trip', tripNo: trip.trip_no })}>
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-bold text-[#0D1C33]">{trip.trip_no}</span>
              <span className={`text-xs font-bold ${trip.started_at ? 'text-[#1F8A5B]' : 'text-[#9A5F0F]'}`}>{trip.started_at ? 'Berjalan' : 'Siap jalan'}</span>
            </div>
            <Meta>{done} dari {trip.stops.length} tujuan selesai</Meta>
            <Meta>{[...new Set(trip.stops.map(stop => stop.destination_city).filter(Boolean))].join(', ') || '-'}</Meta>
          </Card>
        )
      })}
    </>
  )
}

function MoneyTab({ ctx }: { ctx: Ctx }) {
  const trip = activeTrip(ctx.trips)
  const [summary, setSummary] = useState<{ totalBbmLiters: number; totalBbmRp: number; totalAdhocRp: number } | null>(null)
  const tripNo = trip?.trip_no

  useEffect(() => {
    if (!tripNo) return
    void getTripClosingSummary(tripNo).then(result => setSummary(result.success ? result.summary : null))
  }, [tripNo])

  if (!trip) return <Meta>BBM dan biaya bisa dicatat setelah ada trip.</Meta>
  return (
    <>
      <Card>
        <span className="text-[13px] text-[#4C5361]">Trip aktif</span>
        <span className="text-[17px] font-bold text-[#0D1C33]">{trip.trip_no}</span>
        {summary ? (
          <>
            <Meta>BBM: {summary.totalBbmLiters.toLocaleString('id-ID')} liter · {formatRupiah(summary.totalBbmRp)}</Meta>
            <Meta>Biaya lain: {formatRupiah(summary.totalAdhocRp)}</Meta>
          </>
        ) : <Meta>Memuat ringkasan...</Meta>}
      </Card>
      <Button label="Catat BBM" onClick={() => ctx.push({ name: 'fuel', tripNo: trip.trip_no })} />
      <Button label="Catat biaya tol, parkir, dll" tone="outline" onClick={() => ctx.push({ name: 'expense', tripNo: trip.trip_no })} />
    </>
  )
}

function ProfileTab({ ctx, driver, onLogout }: { ctx: Ctx; driver: DriverSession; onLogout: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <Card>
        <span className="text-lg font-bold text-[#0D1C33]">{driver.driver_name}</span>
        <Meta>{driver.driver_code} · {driver.role}</Meta>
      </Card>
      <Button label="Riwayat Trip" tone="outline" onClick={() => ctx.push({ name: 'history' })} />
      <Button label="Ganti PIN" tone="outline" onClick={() => ctx.push({ name: 'pin' })} />
      <Button label="Keluar" tone="danger" onClick={() => setConfirming(true)} />
      {confirming && (
        <ConfirmSheet
          title="Keluar dari aplikasi?"
          message="Pelacakan lokasi akan dihentikan."
          confirmLabel="Keluar"
          tone="danger"
          onConfirm={() => void onLogout()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

// ── Layar trip dan pengiriman ─────────────────────────────────────────────────

function TripScreen({ tripNo, ctx }: { tripNo: string; ctx: Ctx }) {
  const trip = ctx.trips.find(row => row.trip_no === tripNo)
  const [odometer, setOdometer] = useState('')
  const [scanning, setScanning] = useState(false)
  const { busy, error, setError, run } = useSubmit(ctx)

  if (!trip) return <Meta>Trip tidak ditemukan.</Meta>
  const allDone = trip.stops.every(isStopDone)

  function start() {
    const value = parseInt(odometer, 10)
    if (!Number.isInteger(value) || value < 0) return setError('Isi odometer awal')
    void run(() => startDriverTrip(tripNo, value), () => ctx.notify('Trip dimulai. Lokasi dikirim selama portal terbuka.'))
  }

  function onScanned(text: string) {
    setScanning(false)
    const code = text.trim().toUpperCase()
    const stop = trip!.stops.find(row => code.includes(row.reference_no.toUpperCase()))
    if (stop) ctx.push({ name: 'stop', id: stop.id })
    else ctx.notify(`${code} tidak ada di trip ini`, 'error')
  }

  return (
    <>
      {!trip.started_at && (
        <Card>
          <Field label="Odometer awal (KM)" value={odometer} onChange={setOdometer} inputMode="numeric" />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Mulai Trip" busy={busy} onClick={start} />
        </Card>
      )}

      {trip.started_at && (
        <div className="flex gap-2.5">
          <Button label="Scan" tone="outline" onClick={() => setScanning(true)} />
          <Button label="BBM" tone="outline" onClick={() => ctx.push({ name: 'fuel', tripNo })} />
        </div>
      )}

      <h2 className="text-base font-bold text-[#0D1C33]">Tujuan ({trip.stops.length})</h2>
      {trip.stops.map((stop, index) => (
        <Card key={stop.id} onClick={() => ctx.push({ name: 'stop', id: stop.id })}>
          <span className="text-base font-bold">{index + 1}. {stop.customer_name ?? '-'}</span>
          <Meta>{stop.reference_no} · {stop.destination_city ?? '-'}</Meta>
          <StatusPill status={stop.status} />
        </Card>
      ))}

      {trip.started_at && <Button label="Tutup Trip" disabled={!allDone} onClick={() => ctx.push({ name: 'finish', tripNo })} />}
      {trip.started_at && !allDone && <Meta>Trip bisa ditutup setelah semua tujuan selesai.</Meta>}

      <BarcodeScannerModal isOpen={scanning} onClose={() => setScanning(false)} onScanSuccess={onScanned} title="Scan Surat Jalan" subtitle="Arahkan kamera ke barcode Surat Jalan" />
    </>
  )
}

function mapsUrl(stop: Stop) {
  const destination = stop.target_lat != null && stop.target_lng != null
    ? `${stop.target_lat},${stop.target_lng}`
    : [stop.customer_name, stop.destination_address, stop.destination_city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`
}

function StopScreen({ id, ctx }: { id: number; ctx: Ctx }) {
  const found = findStop(ctx.trips, id)
  const [distance, setDistance] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const targetLat = found?.stop.target_lat ?? null
  const targetLng = found?.stop.target_lng ?? null
  const open = found ? !isStopDone(found.stop) : false

  useEffect(() => {
    if (!open || targetLat == null || targetLng == null) return
    void currentPosition().then(position => {
      if (position) setDistance(distanceMeters(position, { lat: Number(targetLat), lng: Number(targetLng) }))
    })
  }, [open, targetLat, targetLng])

  if (!found) return <Meta>Pengiriman tidak ditemukan.</Meta>
  const { trip, stop } = found
  const hasTarget = targetLat != null && targetLng != null
  const address = [stop.destination_address, stop.destination_city].filter(Boolean).join(', ')
  const far = distance != null && distance > NEAR_DESTINATION_METERS

  return (
    <>
      <Card>
        <span className="text-[17px] font-bold">{stop.customer_name ?? '-'}</span>
        <Meta>{stop.reference_no}{stop.dk_lk ? ` · ${stop.dk_lk}` : ''}</Meta>
        <Meta>{address || '-'}</Meta>
        <StatusPill status={stop.status} />
        {stop.failure_reason ? <Meta>Alasan: {stop.failure_reason}</Meta> : null}
      </Card>

      {open && (
        <Card>
          <span className="text-[13px] font-semibold text-[#4C5361]">Jarak ke lokasi tujuan</span>
          <span className="text-[22px] font-bold text-[#0D1C33]">
            {distance != null ? formatDistance(distance) : hasTarget ? 'Menghitung...' : 'Koordinat customer belum tersedia'}
          </span>
          <a
            href={mapsUrl(stop)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!hasTarget && !address}
            className="flex min-h-[52px] items-center justify-center rounded-[14px] border-[1.5px] border-[#1F3F6E] bg-white text-base font-bold text-[#1F3F6E]"
          >
            Navigasi ke Tujuan
          </a>
        </Card>
      )}

      <h2 className="text-base font-bold text-[#0D1C33]">Barang ({stop.items.length})</h2>
      <Card>
        {stop.items.length === 0 ? <Meta>Detail barang belum tersedia.</Meta> : null}
        {stop.items.map((item, index) => (
          <div key={`${item.item_no}-${item.lot_no}-${index}`} className="flex gap-3 border-b border-[#E0DACD] py-1.5 last:border-b-0">
            <div className="flex-1">
              <p className="text-sm">{item.description}</p>
              <Meta>{item.item_no}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</Meta>
            </div>
            <span className="text-[15px] font-bold text-[#0D1C33]">{item.quantity.toLocaleString('id-ID')}</span>
          </div>
        ))}
      </Card>

      {!trip.started_at && <Meta>Mulai trip terlebih dahulu untuk menyelesaikan pengiriman.</Meta>}
      {trip.started_at && open && (
        <>
          <Button label="Terkirim, isi POD" onClick={() => setConfirming(true)} />
          <Button label="Gagal kirim" tone="danger" onClick={() => ctx.push({ name: 'failed', id: stop.id })} />
        </>
      )}

      {confirming && (
        <ConfirmSheet
          title="Apakah anda sudah sampai di tujuan?"
          message={far
            ? `Posisi Anda sekitar ${formatDistance(distance!)} dari lokasi ${stop.customer_name ?? 'customer'}.`
            : `Lanjutkan isi bukti terima untuk ${stop.customer_name ?? 'customer'}.`}
          confirmLabel="Sudah sampai"
          cancelLabel="Belum"
          onConfirm={() => { setConfirming(false); ctx.push({ name: 'pod', id: stop.id }) }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

function PodScreen({ id, ctx }: { id: number; ctx: Ctx }) {
  const found = findStop(ctx.trips, id)
  const [name, setName] = useState('')
  const [receiverType, setReceiverType] = useState(RECEIVER_TYPES[0])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [signature, setSignature] = useState('')
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const { busy, error, setError, run } = useSubmit(ctx)

  useEffect(() => { void currentPosition().then(setPosition) }, [])

  if (!found) return <Meta>Pengiriman tidak ditemukan.</Meta>
  const { stop } = found
  const target = stop.target_lat != null && stop.target_lng != null ? { lat: Number(stop.target_lat), lng: Number(stop.target_lng) } : null
  const distance = position && target ? distanceMeters(position, target) : null

  function submit() {
    if (!name.trim()) return setError('Nama penerima wajib diisi')
    if (!photo) return setError('Foto bukti terima wajib diambil')
    void run(() => submitDriverPod({
      shipment_id: stop.id,
      pss_no: stop.reference_no,
      recipient_name: name.trim(),
      receiver_type: receiverType,
      notes,
      photo_receipt_url: photo,
      signature_url: signature || undefined,
      distance_meters: distance ?? undefined,
      lat: position?.lat,
      lng: position?.lng,
    }), () => { ctx.notify('POD tersimpan'); ctx.back() })
  }

  return (
    <>
      <p className="text-[17px] font-bold">{stop.customer_name}</p>
      <Meta>{stop.reference_no}</Meta>
      {distance != null && distance > NEAR_DESTINATION_METERS && (
        <p className="rounded-[10px] bg-[#FAF0E0] p-3 text-sm text-[#9A5F0F]">Posisi Anda sekitar {formatDistance(distance)} dari lokasi customer. Pastikan tujuan sudah benar.</p>
      )}
      <Field label="Nama penerima" value={name} onChange={setName} autoCapitalize="words" />
      <ChoiceRow label="Tipe penerima" options={RECEIVER_TYPES} value={receiverType} onChange={setReceiverType} />
      <PhotoField label="Foto bukti terima" value={photo} onChange={setPhoto} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Tanda tangan penerima (opsional)</span>
        <div className="overflow-hidden rounded-[10px] border border-[#E0DACD] bg-white">
          <SignatureCanvas onSave={setSignature} onClear={() => setSignature('')} height={160} />
        </div>
      </div>
      <Field label="Catatan (opsional)" value={notes} onChange={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan POD" busy={busy} onClick={submit} />
    </>
  )
}

function FailedScreen({ id, ctx }: { id: number; ctx: Ctx }) {
  const found = findStop(ctx.trips, id)
  const [reason, setReason] = useState(FAILURE_REASONS[0])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const { busy, error, setError, run } = useSubmit(ctx)

  if (!found) return <Meta>Pengiriman tidak ditemukan.</Meta>
  const { stop } = found

  async function submit() {
    if (!photo) return setError('Foto bukti wajib diambil')
    const position = await currentPosition()
    void run(() => submitDriverFailedPod({
      shipment_id: stop.id,
      pss_no: stop.reference_no,
      failure_reason: reason,
      notes,
      photo_url: photo,
      lat: position?.lat,
      lng: position?.lng,
    }), () => { ctx.notify('Gagal kirim tercatat'); ctx.back() })
  }

  return (
    <>
      <ChoiceRow label="Alasan" options={FAILURE_REASONS} value={reason} onChange={setReason} />
      <PhotoField label="Foto bukti" value={photo} onChange={setPhoto} />
      <Field label="Catatan (opsional)" value={notes} onChange={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan Gagal Kirim" tone="danger" busy={busy} onClick={() => void submit()} />
    </>
  )
}

function FuelScreen({ tripNo, ctx }: { tripNo: string; ctx: Ctx }) {
  const [spbu, setSpbu] = useState('')
  const [fuelType, setFuelType] = useState(FUEL_TYPES[0])
  const [liters, setLiters] = useState('')
  const [amount, setAmount] = useState('')
  const [odometer, setOdometer] = useState('')
  const [odoPhoto, setOdoPhoto] = useState('')
  const [receiptPhoto, setReceiptPhoto] = useState('')
  const { busy, error, setError, run } = useSubmit(ctx)

  async function submit() {
    const litersValue = Number(liters.replace(',', '.'))
    const amountValue = Number(amount.replace(/\D/g, ''))
    if (!spbu.trim()) return setError('Nama SPBU wajib diisi')
    if (!(litersValue > 0) || !(amountValue > 0)) return setError('Liter dan nominal wajib diisi')
    if (!odoPhoto || !receiptPhoto) return setError('Foto odometer dan foto struk wajib diambil')
    const position = await currentPosition()
    void run(() => logDriverFuel({
      trip_id: tripNo,
      spbu_name_location: spbu.trim(),
      spbu_latitude: position?.lat,
      spbu_longitude: position?.lng,
      fuel_type: fuelType,
      liters: litersValue,
      amount_rupiah: amountValue,
      odometer_after: odometer ? parseInt(odometer, 10) : undefined,
      photo_odometer_after_url: odoPhoto,
      photo_receipt_url: receiptPhoto,
      logged_at: new Date().toISOString(),
    }), () => { ctx.notify('BBM tersimpan'); ctx.back() })
  }

  return (
    <>
      <Field label="Nama SPBU" value={spbu} onChange={setSpbu} autoCapitalize="words" />
      <ChoiceRow label="Jenis BBM" options={FUEL_TYPES} value={fuelType} onChange={setFuelType} />
      <Field label="Jumlah liter" value={liters} onChange={setLiters} inputMode="decimal" />
      <Field label="Nominal (Rp)" value={amount} onChange={setAmount} inputMode="numeric" />
      <Field label="Odometer (KM)" value={odometer} onChange={setOdometer} inputMode="numeric" />
      <PhotoField label="Foto odometer" value={odoPhoto} onChange={setOdoPhoto} />
      <PhotoField label="Foto struk" value={receiptPhoto} onChange={setReceiptPhoto} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan BBM" busy={busy} onClick={() => void submit()} />
    </>
  )
}

function ExpenseScreen({ tripNo, ctx }: { tripNo: string; ctx: Ctx }) {
  const [expenseType, setExpenseType] = useState(EXPENSE_TYPES[0])
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const { busy, error, setError, run } = useSubmit(ctx)

  async function submit() {
    const amountValue = Number(amount.replace(/\D/g, ''))
    if (!(amountValue > 0)) return setError('Nominal wajib diisi')
    if (expenseType === 'Lainnya' && !notes.trim()) return setError('Tulis keterangan biaya')
    const position = await currentPosition()
    void run(() => logDriverAdhocExpense({
      trip_id: tripNo,
      expense_type: expenseType,
      amount_rupiah: amountValue,
      notes,
      receipt_photo_url: photo || undefined,
      lat: position?.lat,
      lng: position?.lng,
      recorded_at: new Date().toISOString(),
    }), () => { ctx.notify('Biaya tersimpan'); ctx.back() })
  }

  return (
    <>
      <ChoiceRow label="Jenis biaya" options={EXPENSE_TYPES} value={expenseType} onChange={setExpenseType} />
      <Field label="Nominal (Rp)" value={amount} onChange={setAmount} inputMode="numeric" />
      <PhotoField label="Foto bukti (opsional)" value={photo} onChange={setPhoto} />
      <Field label="Keterangan" value={notes} onChange={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan Biaya" busy={busy} onClick={() => void submit()} />
    </>
  )
}

function FinishScreen({ tripNo, ctx }: { tripNo: string; ctx: Ctx }) {
  const trip = ctx.trips.find(row => row.trip_no === tripNo)
  const [odometer, setOdometer] = useState('')
  const { busy, error, setError, run } = useSubmit(ctx)

  if (!trip) return <Meta>Trip tidak ditemukan.</Meta>
  const delivered = trip.stops.filter(stop => stop.status === 'Delivered').length
  const failed = trip.stops.filter(stop => stop.status === 'Failed Delivery').length
  const startKm = trip.odometer_start
  const endKm = parseInt(odometer, 10)

  function submit() {
    if (!Number.isInteger(endKm) || endKm < 0) return setError('Isi odometer akhir')
    if (startKm != null && endKm < startKm) return setError(`Odometer akhir lebih kecil dari odometer awal (${startKm} KM)`)
    void run(() => finishDriverTrip(tripNo, endKm), () => { ctx.notify(`Trip ${tripNo} ditutup`); ctx.backToRoot() })
  }

  return (
    <>
      <Card>
        <span className="text-[17px] font-bold text-[#0D1C33]">{tripNo}</span>
        <Meta>Terkirim: {delivered} · Gagal: {failed}</Meta>
        {startKm != null ? <Meta>Odometer awal: {startKm.toLocaleString('id-ID')} KM</Meta> : null}
        {startKm != null && endKm >= startKm ? <Meta>Jarak tempuh: {(endKm - startKm).toLocaleString('id-ID')} KM</Meta> : null}
      </Card>
      <Field label="Odometer akhir (KM)" value={odometer} onChange={setOdometer} inputMode="numeric" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Tutup Trip" busy={busy} onClick={submit} />
    </>
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function HistoryScreen() {
  const [trips, setTrips] = useState<DriverHistoryTrip[] | null>(null)
  const [error, setError] = useState('')
  const [openTrip, setOpenTrip] = useState<string | null>(null)

  useEffect(() => {
    void getDriverTripHistory().then(result => {
      if (result.success) setTrips(result.trips)
      else setError(result.error)
    })
  }, [])

  if (error) return <ErrorText>{error}</ErrorText>
  if (!trips) return <Meta>Memuat riwayat...</Meta>
  return (
    <>
      <Meta>Trip selesai dalam 30 hari terakhir.</Meta>
      {trips.length === 0 && <p className="pt-12 text-center text-[15px] text-[#4C5361]">Belum ada trip yang selesai.</p>}
      {trips.map(trip => {
        const delivered = trip.stops.filter(stop => stop.status === 'Delivered').length
        const failed = trip.stops.filter(stop => stop.status === 'Failed Delivery').length
        const expanded = openTrip === trip.trip_no
        return (
          <Card key={trip.trip_no} onClick={() => setOpenTrip(expanded ? null : trip.trip_no)}>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[#0D1C33]">{trip.trip_no}</span>
              <Meta>{formatDate(trip.completed_at ?? trip.document_date)}</Meta>
            </div>
            <Meta>
              Terkirim {delivered} · Gagal {failed} dari {trip.stops.length} tujuan
              {trip.distance_km != null ? ` · ${trip.distance_km.toLocaleString('id-ID')} KM` : ''}
            </Meta>
            {expanded
              ? trip.stops.map(stop => (
                <div key={stop.id} className="flex items-center gap-2.5 border-t border-[#E0DACD] pt-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{stop.customer_name ?? '-'}</p>
                    <Meta>{stop.reference_no}{stop.destination_city ? ` · ${stop.destination_city}` : ''}</Meta>
                    {stop.failure_reason ? <Meta>Alasan: {stop.failure_reason}</Meta> : null}
                  </div>
                  <StatusPill status={stop.status} />
                </div>
              ))
              : <span className="text-[13px] font-semibold text-[#856828]">Ketuk untuk melihat tujuan</span>}
          </Card>
        )
      })}
    </>
  )
}

function ChangePinScreen({ ctx }: { ctx: Ctx }) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const { busy, error, setError, run } = useSubmit(ctx)
  const digits = (setter: (value: string) => void) => (value: string) => setter(value.replace(/\D/g, ''))

  function submit() {
    if (!/^\d{6}$/.test(newPin)) return setError('PIN baru harus 6 angka')
    if (newPin === '123456') return setError('PIN baru tidak boleh 123456')
    if (newPin !== confirmPin) return setError('Konfirmasi PIN tidak sama')
    void run(() => driverChangePin(currentPin, newPin), () => { ctx.notify('PIN berhasil diganti'); ctx.back() })
  }

  return (
    <>
      <Field label="PIN lama" value={currentPin} onChange={digits(setCurrentPin)} type="password" inputMode="numeric" maxLength={6} />
      <Field label="PIN baru (6 angka)" value={newPin} onChange={digits(setNewPin)} type="password" inputMode="numeric" maxLength={6} />
      <Field label="Ulangi PIN baru" value={confirmPin} onChange={digits(setConfirmPin)} type="password" inputMode="numeric" maxLength={6} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan PIN" busy={busy} disabled={!currentPin || !newPin || !confirmPin} onClick={submit} />
    </>
  )
}
