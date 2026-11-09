'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import FleetEditPanel from './FleetEditPanel'

type Fleet = {
  id: number
  vehicle_no: string | null
  nopol: string | null
  plate_no: string | null
  vehicle_type: string | null
  capacity_kg: number | null
  capacity_cbm: number | null
  driver_name: string | null
  driver_phone: string | null
  is_active: boolean | null
  status: string | null
}

export function FleetRow({ fleet }: { fleet: Fleet }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isActive = fleet.is_active === true || String(fleet.status).toLowerCase() === 'active'

  useEffect(() => { setMounted(true) }, [])

  const nopol    = String(fleet.vehicle_no ?? fleet.nopol ?? fleet.plate_no ?? '-').toUpperCase()
  const kapasitas = [
    fleet.capacity_kg  ? `${fleet.capacity_kg} T`    : null,
    fleet.capacity_cbm ? `${fleet.capacity_cbm} M³`  : null,
  ].filter(Boolean).join(' · ') || '-'

  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setOpen(true)}>
        <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{nopol}</td>
        <td className="px-4 py-3 text-sm text-slate-700">{String(fleet.vehicle_type ?? '-').toUpperCase()}</td>
        <td className="px-4 py-3 text-sm text-slate-700">{kapasitas}</td>
        <td className="px-4 py-3 text-sm">
          {String(fleet.driver_name ?? '-').toUpperCase()}
          <div className="text-xs text-gray-500">{fleet.driver_phone ?? ''}</div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </td>
      </tr>
      {mounted && open && createPortal(
        <FleetEditPanel
          fleet={fleet as any}
          onClose={() => setOpen(false)}
          onSaved={() => { if (typeof window !== 'undefined') window.location.reload() }}
        />,
        document.body
      )}
    </>
  )
}
