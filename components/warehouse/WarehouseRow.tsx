'use client'
import { useState } from 'react'
import WarehouseEditPanel from './WarehouseEditPanel'

type Wh = { id: number; warehouse_code: string; warehouse_name: string; city: string | null; address: string | null; is_active: boolean; created_at: string }

export function WarehouseRow({ wh }: { wh: Wh }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={()=>setOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{wh.warehouse_code}</td>
        <td className="px-4 py-2.5 font-medium">{String(wh.warehouse_name).toUpperCase()}</td>
        <td className="px-4 py-2.5">{String(wh.city ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-xs text-gray-600">{String(wh.address ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-center">{wh.is_active ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> : <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300"></span>}</td>
        <td className="px-4 py-2.5 text-xs text-gray-500">{wh.created_at?.slice(0,10) ?? '-'}</td>
      </tr>
      {open && <WarehouseEditPanel wh={wh as any} onClose={()=>setOpen(false)} onSaved={()=>{ if(typeof window!=='undefined') window.location.reload() }} />}
    </>
  )
}
