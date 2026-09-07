'use client'
import { useState } from 'react'
import RouteEditPanel from './RouteEditPanel'

type Route = {
  id: number
  route_code: string
  origin: string
  destination: string
  standard_lead_time_hours: number | null
  dk_lk: 'D' | 'L' | null
  notes: string | null
}

export function RouteRow({ route }: { route: Route }) {
  const [open, setOpen] = useState(false)
  const lt   = route.standard_lead_time_hours ?? 0
  const days = (lt / 24).toFixed(1)
  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{route.route_code}</td>
        <td className="px-4 py-2.5">{String(route.origin).toUpperCase()} → {String(route.destination).toUpperCase()}</td>
        <td className="px-4 py-2.5">
          {route.dk_lk
            ? <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${route.dk_lk === 'D' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {route.dk_lk === 'D' ? 'Dalam Kota' : 'Luar Kota'}
              </span>
            : <span className="text-gray-300 text-xs">—</span>
          }
        </td>
        <td className="px-4 py-2.5 text-right whitespace-nowrap">
          {lt} JAM <span className="text-gray-400 text-xs">({days} HARI)</span>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-600">{String(route.notes ?? '-').toUpperCase()}</td>
      </tr>
      {open && (
        <RouteEditPanel
          route={route}
          onClose={() => setOpen(false)}
          onSaved={() => { if (typeof window !== 'undefined') window.location.reload() }}
        />
      )}
    </>
  )
}
