'use client'

import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type RoutePoint = { latitude: number; longitude: number; recorded_at: string }
export type RouteDestination = { name: string; latitude: number; longitude: number; done: boolean }

const MEDAN: [number, number] = [3.5952, 98.6722]

/** Sesuaikan tampilan hanya saat trip berganti atau data pertama tiba, agar geseran admin tidak direset tiap refresh. */
function FitToRoute({ fitKey, positions }: { fitKey: string; positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!positions.length) return
    if (positions.length === 1) map.setView(positions[0], 15)
    else map.fitBounds(positions, { padding: [32, 32], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])
  return null
}

export default function TripRouteMap({ tripId, points, destinations, className = 'h-[420px]' }: {
  className?: string
  tripId: string
  points: RoutePoint[]
  destinations: RouteDestination[]
}) {
  const path = points.map(point => [point.latitude, point.longitude] as [number, number])
  const current = path[path.length - 1]
  const all = [...path, ...destinations.map(destination => [destination.latitude, destination.longitude] as [number, number])]

  return (
    <MapContainer center={current ?? MEDAN} zoom={13} scrollWheelZoom className={`${className} w-full rounded-xl`}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToRoute fitKey={`${tripId}:${path.length > 0}:${destinations.length}`} positions={all} />

      {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#1F3F6E', weight: 4, opacity: 0.85 }} />}
      {path.slice(0, -1).map((position, index) => (
        <CircleMarker key={index} center={position} radius={3} pathOptions={{ color: '#1F3F6E', fillColor: '#ffffff', fillOpacity: 1, weight: 1.5 }}>
          <Tooltip>{new Date(points[index].recorded_at).toLocaleTimeString('id-ID')}</Tooltip>
        </CircleMarker>
      ))}

      {destinations.map(destination => (
        <CircleMarker
          key={destination.name}
          center={[destination.latitude, destination.longitude]}
          radius={8}
          pathOptions={{ color: destination.done ? '#1F8A5B' : '#A8863F', fillColor: destination.done ? '#46A171' : '#C5A25D', fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip>{destination.name}{destination.done ? ' (selesai)' : ''}</Tooltip>
        </CircleMarker>
      ))}

      {current && (
        <CircleMarker center={current} radius={10} pathOptions={{ color: '#ffffff', fillColor: '#C8372D', fillOpacity: 1, weight: 3 }}>
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Posisi driver · {new Date(points[points.length - 1].recorded_at).toLocaleTimeString('id-ID')}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
