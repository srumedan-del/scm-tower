'use client'
import { useState } from 'react'
import RateCardEditPanel from './RateCardEditPanel'

type Rate = {
  id: number
  rate_code: string
  origin: string
  destination: string
  vehicle_type: string | null
  tonnage: number | null
  cbm: number | null
  tariff_model: string | null
  price: number | null
  status: string | null
  service_name: string | null
  effective_from: string | null
  vendor_id: number | null
}

function statusBadge(s: string | null) {
  const v = String(s ?? '').toLowerCase()
  const isAktif = v === 'aktif' || v === 'active'
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${isAktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{String(s ?? '-').toUpperCase()}</span>
}

export function RateCardRow({ rate }: { rate: Rate }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={()=>setOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{rate.rate_code}</td>
        <td className="px-4 py-2.5 text-xs font-bold">{String((rate as any).vendor_code ?? (rate as any).vendor_name ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5">{String(rate.origin).toUpperCase()} → {String(rate.destination).toUpperCase()}</td>
        <td className="px-4 py-2.5">{String(rate.vehicle_type ?? '-').toUpperCase()}{rate.tonnage ? ` · ${rate.tonnage}T` : ''}{rate.cbm ? ` · ${rate.cbm} CBM` : ''}</td>
        <td className="px-4 py-2.5">{String(rate.tariff_model ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-right font-medium">{rate.price != null ? Number(rate.price).toLocaleString('id-ID') : '-'}</td>
        <td className="px-4 py-2.5 text-center">{statusBadge(rate.status)}</td>
      </tr>
      {open && <RateCardEditPanel rate={rate as any} onClose={()=>setOpen(false)} onSaved={()=>{ if(typeof window!=='undefined') window.location.reload() }} />}
    </>
  )
}
