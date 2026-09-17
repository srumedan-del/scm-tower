'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
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

function truckSpecification(rate: Rate) {
  const parts = [String(rate.vehicle_type ?? '-').toUpperCase()]
  if (rate.tonnage != null) parts.push(`${Number(rate.tonnage).toLocaleString('id-ID', { maximumFractionDigits: 2 })} TON`)
  if (rate.cbm != null) parts.push(`${Number(rate.cbm).toLocaleString('id-ID', { maximumFractionDigits: 2 })} CBM`)
  return parts.join(' · ')
}

export function RateCardRow({ rate }: { rate: Rate }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      <tr className="cursor-pointer transition-colors hover:bg-blue-50" onClick={()=>setOpen(true)}>
        <td className="break-words px-2 py-2.5 text-left font-mono text-[11px] font-medium sm:px-3">{rate.rate_code}</td>
        <td className="break-words px-2 py-2.5 text-left text-[11px] font-bold sm:px-3">
          {(rate as any).vendor_name ? String((rate as any).vendor_name).toUpperCase() : '-'}
        </td>
        <td className="break-words px-2 py-2.5 text-left sm:px-3">{String(rate.origin).toUpperCase()} → {String(rate.destination).toUpperCase()}</td>
        <td className="break-words px-2 py-2.5 text-left sm:px-3">{truckSpecification(rate)}</td>
        <td className="break-words px-2 py-2.5 text-left sm:px-3">{String(rate.tariff_model ?? '-').toUpperCase()}</td>
        <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">{rate.price != null ? Number(rate.price).toLocaleString('id-ID') : '-'}</td>
        <td className="px-2 py-2.5 text-center sm:px-3">{statusBadge(rate.status)}</td>
      </tr>
      {mounted && open && createPortal(
        <RateCardEditPanel rate={rate as any} onClose={()=>setOpen(false)} onSaved={() => {
          setOpen(false)
          router.refresh()
        }} />,
        document.body
      )}
    </>
  )
}
