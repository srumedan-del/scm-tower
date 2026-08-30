'use client'

import { useState } from 'react'
import CustomerEditPanel from './CustomerEditPanel'

type Customer = {
  id: number
  customer_code: string
  customer_name: string | null
  city: string | null
  province: string | null
  address: string | null
  dk_lk: string | null
  latitude: number | null
  longitude: number | null
  machine_count: number | null
  is_active: boolean | null
  lead_time_days: number | null
  safety_buffer_days: number | null
}

function locLabel(c: Customer) {
  if (c.latitude != null && c.longitude != null) return `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}`
  return '—'
}

export function CustomerRow({ customer }: { customer: Customer }) {
  const [editOpen, setEditOpen] = useState(false)
  const hasLoc = customer.latitude != null && customer.longitude != null

  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setEditOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{customer.customer_code}</td>
        <td className="px-4 py-2.5 font-medium">{String(customer.customer_name ?? '').toUpperCase()}</td>
        <td className="px-4 py-2.5">{String(customer.city ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-center"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${customer.dk_lk==='DK' ? 'bg-blue-100 text-blue-700' : customer.dk_lk==='LK' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{customer.dk_lk ?? '-'}</span></td>
        <td className="px-4 py-2.5 text-center font-bold">{customer.machine_count ?? <span className="text-gray-400 font-normal">—</span>}</td>
        <td className="px-4 py-2.5 max-w-[320px] truncate text-xs text-gray-600" title={customer.address ?? ''}>{String(customer.address ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-center font-mono text-xs">
          {hasLoc ? (
            <span className="inline-flex items-center gap-1 text-green-700 font-bold" title={`${customer.latitude}, ${customer.longitude}`}>
              📍 {locLabel(customer)}
            </span>
          ) : (
            <span className="text-gray-400" title="Belum ada koordinat — klik untuk isi">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-center">{customer.is_active ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> : <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300"></span>}</td>
      </tr>
      {editOpen && (
        <CustomerEditPanel
          customer={customer}
          onClose={() => setEditOpen(false)}
          onSaved={() => { if (typeof window !== 'undefined') window.location.reload() }}
        />
      )}
    </>
  )
}
