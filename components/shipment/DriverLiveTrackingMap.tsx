'use client'

import React, { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import {
  getActiveDriverLiveLocations,
  getTripFuelAuditLogs,
  getTripLocationHistory,
  type LiveDriverTrip,
} from '@/app/(app)/shipment/actions'
import type { RoutePoint } from './TripRouteMap'

const TripRouteMap = dynamic(() => import('./TripRouteMap'), {
  ssr: false,
  loading: () => <div className="grid h-[calc(100dvh-15rem)] min-h-[26rem] place-items-center rounded-xl bg-slate-100 text-sm text-slate-500">Memuat peta...</div>,
})
import {
  Truck,
  MapPin,
  Navigation,
  Fuel,
  RefreshCw,
  Clock,
  Radio,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Eye,
  Camera,
} from 'lucide-react'

/** Kecepatan dari HP; jika HP tidak melaporkannya, hitung dari dua titik terakhir. */
function estimateSpeedKmh(reported: number | null | undefined, points: RoutePoint[]) {
  if (Number(reported) > 0) return Math.round(Number(reported))
  if (points.length < 2) return 0
  const [from, to] = points.slice(-2)
  const seconds = (new Date(to.recorded_at).getTime() - new Date(from.recorded_at).getTime()) / 1000
  if (!(seconds >= 5 && seconds <= 600)) return 0
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.latitude - from.latitude)
  const dLng = toRad(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2
  const meters = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round((meters / seconds) * 3.6)
}

const SIGNAL_LOST_MINUTES = 10
const STATIONARY_METERS = 60
const STATIONARY_MINUTES = 5

function metersBetween(from: RoutePoint, to: RoutePoint) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.latitude - from.latitude)
  const dLng = toRad(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Bergerak, diam (HP masih mengirim sinyal), atau tidak ada sinyal. */
function movementStatus(points: RoutePoint[], now = Date.now()) {
  if (!points.length) return null
  const last = points[points.length - 1]
  const lastAt = new Date(last.recorded_at).getTime()
  const time = (value: number) => new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (now - lastAt > SIGNAL_LOST_MINUTES * 60_000) {
    return { tone: 'lost' as const, label: `Tidak ada sinyal sejak ${time(lastAt)}` }
  }
  let since = lastAt
  for (let i = points.length - 1; i >= 0 && metersBetween(points[i], last) < STATIONARY_METERS; i--) {
    since = new Date(points[i].recorded_at).getTime()
  }
  if (lastAt - since >= STATIONARY_MINUTES * 60_000 || now - since >= STATIONARY_MINUTES * 60_000) {
    return { tone: 'idle' as const, label: `Diam sejak ${time(since)}` }
  }
  return { tone: 'moving' as const, label: 'Bergerak' }
}

const STATUS_STYLE = {
  moving: 'bg-green-100 text-green-800',
  idle: 'bg-amber-100 text-amber-800',
  lost: 'bg-red-100 text-red-800',
}

export default function DriverLiveTrackingMap() {
  const [trips, setTrips] = useState<LiveDriverTrip[]>([])
  // Simpan ID-nya saja: refresh otomatis tidak boleh mengganti trip yang dipilih admin.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const selectedTrip = trips.find(trip => trip.trip_id === selectedTripId) ?? null
  const setSelectedTrip = (trip: LiveDriverTrip | null) => setSelectedTripId(trip?.trip_id ?? null)
  const [fuelModalLogs, setFuelModalLogs] = useState<any[] | null>(null)
  const [fuelLoading, setFuelLoading] = useState(false)
  const [loading, startTransition] = useTransition()
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [route, setRoute] = useState<{ tripId: string; points: RoutePoint[] } | null>(null)
  const lastRecordedAt = selectedTrip?.last_location?.recorded_at ?? null

  // Jalur dimuat ulang saat trip berganti atau ada titik GPS baru.
  useEffect(() => {
    if (!selectedTripId) return
    let cancelled = false
    void getTripLocationHistory(selectedTripId).then(points => {
      if (!cancelled) setRoute({ tripId: selectedTripId, points: points as RoutePoint[] })
    })
    return () => { cancelled = true }
  }, [selectedTripId, lastRecordedAt])

  function reload() {
    startTransition(async () => {
      const data = await getActiveDriverLiveLocations()
      setTrips(data)
      setLastRefreshed(new Date())
      setSelectedTripId(current => (data.some(trip => trip.trip_id === current) ? current : data[0]?.trip_id ?? null))
    })
  }

  useEffect(() => {
    reload()
    // Auto refresh every 20 seconds
    const interval = setInterval(() => {
      reload()
    }, 20000)
    return () => clearInterval(interval)
  }, [])

  function viewFuelLogs(tripId: string) {
    setFuelLoading(true)
    setFuelModalLogs([])
    getTripFuelAuditLogs(tripId).then(data => {
      setFuelModalLogs(data)
      setFuelLoading(false)
    })
  }

  const trackedCount = trips.filter(t => t.last_location).length
  const routePoints = route && route.tripId === selectedTripId ? route.points : []
  const speedKmh = estimateSpeedKmh(selectedTrip?.last_location?.speed_kmh, routePoints)
  const movement = movementStatus(routePoints)

  return (
    <div className="space-y-4">
      {/* Pilih trip dan aksi */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 basis-80">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Trip aktif ({trips.length})</span>
          <select
            className="inp"
            value={selectedTrip?.trip_id ?? ''}
            onChange={event => setSelectedTrip(trips.find(trip => trip.trip_id === event.target.value) ?? null)}
            disabled={trips.length === 0}
          >
            {trips.length === 0 && <option value="">Tidak ada trip yang sedang berjalan</option>}
            {trips.map(trip => (
              <option key={trip.trip_id} value={trip.trip_id}>
                {[
                  trip.trip_id,
                  trip.driver_name ?? 'Driver belum ditugaskan',
                  trip.vehicle_nopol,
                  `${trip.delivered_count}/${trip.total_deliveries} terkirim`,
                  trip.last_location ? null : 'menunggu GPS',
                ].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-3 text-xs text-slate-500">
          {trackedCount} dari {trips.length} terlacak · diperbarui {lastRefreshed.toLocaleTimeString('id-ID')}
        </span>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
        {selectedTrip?.last_location && (
          <a
            href={`https://www.google.com/maps?q=${selectedTrip.last_location.latitude},${selectedTrip.last_location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Buka di Google Maps
          </a>
        )}
      </div>

      {selectedTrip ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <TripRouteMap
              className="h-[calc(100dvh-15rem)] min-h-[26rem]"
              tripId={selectedTrip.trip_id}
              points={routePoints}
              speedKmh={speedKmh}
              destinations={selectedTrip.destinations}
            />
          </div>
          <p className="text-xs text-slate-500">
            Titik merah: posisi terakhir driver. Garis biru: jalur yang sudah dilalui ({routePoints.length} titik).
            Titik emas: tujuan yang punya koordinat, hijau jika sudah selesai.
          </p>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">Posisi terakhir</h3>
              {selectedTrip.last_location ? (
                <dl className="space-y-1.5 text-sm">
                  {movement && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Status</dt>
                      <dd><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[movement.tone]}`}>{movement.label}</span></dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Waktu</dt><dd className="font-semibold text-slate-900">{new Date(selectedTrip.last_location.recorded_at).toLocaleTimeString('id-ID')}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Kecepatan</dt><dd className="font-semibold text-slate-900">{speedKmh} km/jam</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Koordinat</dt><dd className="font-mono text-xs text-slate-700">{selectedTrip.last_location.latitude.toFixed(6)}, {selectedTrip.last_location.longitude.toFixed(6)}</dd></div>
                </dl>
              ) : (
                <p className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Driver belum memulai trip atau HP belum mengirim lokasi.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">
                Tujuan ({selectedTrip.delivered_count}/{selectedTrip.total_deliveries} terkirim)
              </h3>
              <ol className="space-y-1 text-sm text-slate-700">
                {selectedTrip.customers.map((customer, index) => (
                  <li key={customer} className="flex gap-2"><span className="w-5 shrink-0 text-slate-400">{index + 1}.</span><span className="[overflow-wrap:anywhere]">{customer}</span></li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">BBM trip ini</h3>
              <p className="text-sm font-semibold text-slate-900">{selectedTrip.total_fuel_liters.toFixed(1)} liter · Rp {selectedTrip.total_fuel_rupiah.toLocaleString('id-ID')}</p>
              <p className="mt-0.5 text-xs text-slate-500">{selectedTrip.fuel_logs_count}x pengisian</p>
              {selectedTrip.fuel_logs_count > 0 && (
                <button
                  type="button"
                  onClick={() => viewFuelLogs(selectedTrip.trip_id)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Lihat foto struk
                </button>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {loading ? 'Memuat trip...' : 'Tidak ada trip driver internal yang sedang berjalan.'}
        </div>
      )}

      {/* MODAL AUDIT FOTO BBM (ODOMETER & STRUK SPBU) */}
      {fuelModalLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900 uppercase">
                  Audit Bukti Pengisian BBM En-Route
                </h3>
              </div>
              <button
                onClick={() => setFuelModalLogs(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {fuelLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">Memuat log bukti BBM...</p>
            ) : fuelModalLogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Belum ada pengisian BBM yang dicatat oleh driver pada trip ini.
              </p>
            ) : (
              <div className="space-y-4">
                {fuelModalLogs.map((log, idx) => (
                  <div key={log.id || idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">
                        {log.spbu_name_location || 'SPBU Pertamina'}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {new Date(log.logged_at).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">VOLUME BBM</span>
                        <span className="font-bold text-slate-800 text-sm">{log.liters} L ({log.fuel_type})</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">NOMINAL RUPIAH</span>
                        <span className="font-bold text-amber-700 text-sm">Rp {Number(log.amount_rupiah).toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    {/* 3 Photos Display */}
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                        📸 3 Foto Bukti Verifikasi Driver:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {/* 1. Odo Sebelum */}
                        <div className="space-y-1 text-center">
                          <span className="text-[10px] font-semibold text-slate-500 block">1. Odo Sebelum</span>
                          {log.photo_odometer_before_url ? (
                            <img
                              src={log.photo_odometer_before_url}
                              alt="Odo Sebelum"
                              className="h-28 w-full object-cover rounded-lg border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="h-28 w-full bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>

                        {/* 2. Odo Sesudah */}
                        <div className="space-y-1 text-center">
                          <span className="text-[10px] font-semibold text-slate-500 block">2. Odo Sesudah</span>
                          {log.photo_odometer_after_url ? (
                            <img
                              src={log.photo_odometer_after_url}
                              alt="Odo Sesudah"
                              className="h-28 w-full object-cover rounded-lg border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="h-28 w-full bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>

                        {/* 3. Struk SPBU */}
                        <div className="space-y-1 text-center">
                          <span className="text-[10px] font-semibold text-slate-500 block">3. Struk Resmi</span>
                          {log.photo_receipt_url ? (
                            <img
                              src={log.photo_receipt_url}
                              alt="Struk SPBU"
                              className="h-28 w-full object-cover rounded-lg border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="h-28 w-full bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-200 pt-3">
              <button
                onClick={() => setFuelModalLogs(null)}
                className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
              >
                Tutup Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
