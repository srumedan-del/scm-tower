import type { RoutePoint } from './TripRouteMap'

const MIN_STEP_METERS = 15
const SPIKE_TURN_DEGREES = 120

const toRad = (value: number) => (value * Math.PI) / 180

export function metersBetween(from: RoutePoint, to: RoutePoint) {
  const dLat = toRad(to.latitude - from.latitude)
  const dLng = toRad(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearing(from: RoutePoint, to: RoutePoint) {
  const y = Math.sin(toRad(to.longitude - from.longitude)) * Math.cos(toRad(to.latitude))
  const x = Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude))
    - Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(toRad(to.longitude - from.longitude))
  return (Math.atan2(y, x) * 180) / Math.PI
}

function turnDegrees(a: RoutePoint, b: RoutePoint, c: RoutePoint) {
  const turn = Math.abs(bearing(a, b) - bearing(b, c)) % 360
  return turn > 180 ? 360 - turn : turn
}

/**
 * Jalur untuk ditampilkan: buang titik yang terlalu rapat dan titik yang melompat
 * bolak-balik (meleset GPS), lalu haluskan dengan rata-rata tiga titik. Titik
 * pertama dan terakhir (posisi driver sekarang) tidak diubah.
 */
export function smoothRoute(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return points
  const last = points[points.length - 1]

  let kept: RoutePoint[] = [points[0]]
  for (const point of points.slice(1, -1)) {
    if (metersBetween(kept[kept.length - 1], point) >= MIN_STEP_METERS) kept.push(point)
  }
  kept.push(last)

  // Titik di tengah yang membuat jalur berbalik tajam lalu kembali dianggap meleset.
  for (let changed = true; changed && kept.length > 2;) {
    changed = false
    for (let i = 1; i < kept.length - 1; i++) {
      const [a, b, c] = [kept[i - 1], kept[i], kept[i + 1]]
      const detour = metersBetween(a, b) + metersBetween(b, c)
      if (turnDegrees(a, b, c) > SPIKE_TURN_DEGREES && metersBetween(a, c) < detour * 0.5) {
        kept = [...kept.slice(0, i), ...kept.slice(i + 1)]
        changed = true
        break
      }
    }
  }

  return kept.map((point, index) => {
    if (index === 0 || index === kept.length - 1) return point
    const [a, b, c] = [kept[index - 1], point, kept[index + 1]]
    return { ...point, latitude: (a.latitude + b.latitude + c.latitude) / 3, longitude: (a.longitude + b.longitude + c.longitude) / 3 }
  })
}
