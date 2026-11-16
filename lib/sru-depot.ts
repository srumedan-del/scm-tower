/**
 * Titik gudang SRU Medan (dari titik awal/akhir GPS trip driver). End trip driver hanya boleh dalam radius ini.
 */
export const SRU_DEPOT = { latitude: 3.60357, longitude: 98.62717, radiusMeters: 500 }

/** Lokasi GPS yang lebih tua dari ini tidak dipakai untuk cek radius end trip. */
export const END_TRIP_LOCATION_MAX_AGE_MINUTES = 15

export function metersBetweenPoints(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function distanceFromDepot(point: { latitude: number; longitude: number }) {
  return metersBetweenPoints(point, SRU_DEPOT)
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`
}
