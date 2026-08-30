'use client'

import { useState } from 'react'
import VendorEditPanel from './VendorEditPanel'

type Vendor = {
  id: number
  vendor_code: string
  vendor_name: string
  vendor_type: string | null
  pic_name: string | null
  phone: string | null
  email: string | null
  coverage_area: string | null
  default_sla: number | null
  is_active: boolean | null
}

export function VendorRow({ vendor }: { vendor: Vendor }) {
  const [editOpen, setEditOpen] = useState(false)
  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setEditOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{vendor.vendor_code}</td>
        <td className="px-4 py-2.5 font-medium">{String(vendor.vendor_name).toUpperCase()}</td>
        <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">{String(vendor.vendor_type ?? '-').toUpperCase()}</span></td>
        <td className="px-4 py-2.5">{String(vendor.pic_name ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-xs">{vendor.phone ?? '-'}</td>
        <td className="px-4 py-2.5 text-xs">{String(vendor.coverage_area ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-right">{vendor.default_sla ? `${vendor.default_sla} HARI` : '-'}</td>
        <td className="px-4 py-2.5 text-center">{vendor.is_active ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> : <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300"></span>}</td>
      </tr>
      {editOpen && <VendorEditPanel vendor={vendor} onClose={()=>setEditOpen(false)} onSaved={()=>{ if(typeof window!=='undefined') window.location.reload() }} />}
    </>
  )
}
