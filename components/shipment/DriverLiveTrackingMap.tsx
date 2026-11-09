'use client'

import React, { useEffect, useState, useTransition } from 'react'
import {
  getActiveDriverLiveLocations,
  getTripFuelAuditLogs,
  type LiveDriverTrip,
} from '@/app/(app)/shipment/actions'
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

export default function DriverLiveTrackingMap() {
  const [trips, setTrips] = useState<LiveDriverTrip[]>([])
  const [selectedTrip, setSelectedTrip] = useState<LiveDriverTrip | null>(null)
  const [fuelModalLogs, setFuelModalLogs] = useState<any[] | null>(null)
  const [fuelLoading, setFuelLoading] = useState(false)
  const [loading, startTransition] = useTransition()
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  function reload() {
    startTransition(async () => {
      const data = await getActiveDriverLiveLocations()
      setTrips(data)
      setLastRefreshed(new Date())
      if (selectedTrip) {
        const updated = data.find(t => t.trip_id === selectedTrip.trip_id)
        if (updated) setSelectedTrip(updated)
      } else if (data.length > 0) {
        setSelectedTrip(data[0])
      }
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

  const activeInTransitCount = trips.filter(t => t.status === 'In Transit').length

  return (
    <div className="space-y-4">
      {/* Top Banner Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Radio className="h-5 w-5 animate-pulse text-green-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Live GPS Tracking & Audit Pengiriman Driver
            </h2>
            <p className="text-xs text-slate-500">
              Perekaman koordinat otomatis tiap 50 meter & audit BBM en-route • Terakhir diperbarui:{' '}
              <span className="font-mono font-semibold text-slate-700">
                {lastRefreshed.toLocaleTimeString('id-ID')}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
            {activeInTransitCount} Armada Bergerak
          </span>
          <button
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Grid: Trip List on Left, Detail & Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Trip Cards */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Daftar Trip Armada ({trips.length})
          </h3>

          {trips.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Belum ada Trip yang tercatat. Buat pengiriman di tab <strong>For Transport Planning</strong>.
            </div>
          )}

          {trips.map(trip => {
            const isSelected = selectedTrip?.trip_id === trip.trip_id
            const hasGps = !!trip.last_location

            return (
              <div
                key={trip.trip_id}
                onClick={() => setSelectedTrip(trip)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/30 shadow-md ring-2 ring-indigo-600/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {trip.trip_id}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          trip.status === 'Delivered'
                            ? 'bg-green-100 text-green-700'
                            : trip.status === 'In Transit'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-600">
                      <Truck className="h-3.5 w-3.5 text-slate-400" />
                      <span>{trip.driver_name ?? 'Driver Belum Ditugaskan'}</span>
                      {trip.vehicle_nopol && (
                        <span className="font-mono text-slate-500">({trip.vehicle_nopol})</span>
                      )}
                    </div>
                  </div>

                  {/* Fuel tag */}
                  {trip.fuel_logs_count > 0 && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        viewFuelLogs(trip.trip_id)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                      title="Klik untuk melihat bukti foto struk & odometer"
                    >
                      <Fuel className="h-3 w-3 text-amber-600" />
                      <span>{trip.fuel_logs_count}x BBM</span>
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{trip.cities.join(', ') || 'MEDAN'}</span>
                    <span className="text-slate-400">•</span>
                    <span>{trip.delivered_count}/{trip.total_deliveries} Terkirim</span>
                  </div>

                  {hasGps ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      GPS Terlacak
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Menunggu GPS HP</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right Column: Live Map & Trip Audit Detail */}
        <div className="lg:col-span-7">
          {selectedTrip ? (
            <div className="space-y-4">
              {/* Trip Detail Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Rincian Pelacakan Trip
                    </span>
                    <h3 className="font-mono text-xl font-black text-slate-900">
                      {selectedTrip.trip_id}
                    </h3>
                  </div>

                  {selectedTrip.last_location && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedTrip.last_location.latitude},${selectedTrip.last_location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Buka di Google Maps</span>
                    </a>
                  )}
                </div>

                {/* GPS Live Coordinates Status Box */}
                {selectedTrip.last_location ? (
                  <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-green-900">
                        <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                        <span>KOORDINAT GPS DRIVER (TERAKHIR TERCATAT)</span>
                      </div>
                      <span className="text-[11px] font-semibold text-green-700">
                        {new Date(selectedTrip.last_location.recorded_at).toLocaleTimeString('id-ID')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                      <div className="rounded-lg bg-white/80 p-2 border border-green-100">
                        <span className="block text-[10px] text-slate-400">LATITUDE</span>
                        <span className="font-bold text-slate-800">{selectedTrip.last_location.latitude.toFixed(6)}</span>
                      </div>
                      <div className="rounded-lg bg-white/80 p-2 border border-green-100">
                        <span className="block text-[10px] text-slate-400">LONGITUDE</span>
                        <span className="font-bold text-slate-800">{selectedTrip.last_location.longitude.toFixed(6)}</span>
                      </div>
                      <div className="rounded-lg bg-white/80 p-2 border border-green-100">
                        <span className="block text-[10px] text-slate-400">KECEPATAN</span>
                        <span className="font-bold text-slate-800">{selectedTrip.last_location.speed_kmh} KM/H</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Driver belum memulai pengiriman atau belum terhubung dengan sinyal GPS smartphone.
                    </span>
                  </div>
                )}

                {/* Customers list in this trip */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Daftar Customer Tujuan:
                  </h4>
                  <div className="space-y-1.5">
                    {selectedTrip.customers.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                          {i + 1}
                        </span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fuel Summary in Trip */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Fuel className="h-5 w-5 text-amber-600" />
                    <div>
                      <span className="block text-xs font-bold text-slate-800">
                        Realisasi BBM Trip Ini: {selectedTrip.total_fuel_liters.toFixed(1)} Liter
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Total: Rp {selectedTrip.total_fuel_rupiah.toLocaleString('id-ID')} ({selectedTrip.fuel_logs_count}x Pengisian)
                      </span>
                    </div>
                  </div>

                  {selectedTrip.fuel_logs_count > 0 && (
                    <button
                      onClick={() => viewFuelLogs(selectedTrip.trip_id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Lihat Foto Struk</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
              Pilih Trip di sebelah kiri untuk melihat posisi GPS dan rincian audit pengiriman.
            </div>
          )}
        </div>
      </div>

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
