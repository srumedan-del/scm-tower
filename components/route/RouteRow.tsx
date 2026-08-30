'use client'
import { useState } from 'react'
import RouteEditPanel from './RouteEditPanel'

type Route = {
  id: number
  route_code: string
  origin: string
  destination: string
  city: string | null
  standard_lead_time_hours: number | null
  risk_level: string
  notes: string | null
}

export function RouteRow({ route }: { route: Route }) {
  const [open, setOpen] = useState(false)
  const riskColor = route.risk_level === 'high' ? 'bg-red-100 text-red-700' : route.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
  const lt = route.standard_lead_time_hours ?? 0
  const days = (lt / 24).toFixed(1)
  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={()=>setOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{route.route_code}</td>
        <td className="px-4 py-2.5">{String(route.origin).toUpperCase()} → {String(route.destination).toUpperCase()}</td>
        <td className="px-4 py-2.5">{String(route.city ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-right">{lt} JAM <span className="text-gray-400 text-xs">({days} HARI)</span></td>
        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded font-bold ${riskColor}`}>{String(route.risk_level).toUpperCase()}</span></td>
        <td className="px-4 py-2.5 text-xs text-gray-600">{String(route.notes ?? '-').toUpperCase()}</td>
      </tr>
      {open && <RouteEditPanel route={route} onClose={()=>setOpen(false)} onSaved={()=>{ if(typeof window!=='undefined') window.location.reload() }} />}
    </>
  )
}
