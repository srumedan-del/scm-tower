'use client'
import { useState } from 'react'
import ShipmentEditPanel from './ShipmentEditPanel'

type Shipment = {
  id: string
  shipment_no: string | null
  document_no: string | null
  shipment_date: string | null
  origin_warehouse: string | null
  destination_site: string | null
  destination_name: string | null
  destination_city: string | null
  route: string | null
  shipment_type: string | null
  vendor_name: string | null
  vehicle_no: string | null
  driver_name: string | null
  status: string | null
  eta: string | null
  sla_status: string | null
  pod_status: string | null
  delay_reason: string | null
  notes: string | null
}

function StatusBadge({status}:{status:string|null}){
  const map:Record<string,string>={planned:'bg-gray-100 text-gray-700',picking:'bg-blue-100 text-blue-700',packed:'bg-indigo-100 text-indigo-700',loaded:'bg-purple-100 text-purple-700',in_transit:'bg-amber-100 text-amber-700',delivered:'bg-green-100 text-green-700',delayed:'bg-red-100 text-red-700',returned:'bg-orange-100 text-orange-700',cancelled:'bg-gray-200 text-gray-500'}
  return <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${map[status||'']||'bg-gray-100 text-gray-600'}`}>{(status||'-').toUpperCase()}</span>
}
function SlaBadge({status}:{status:string|null}){
  const map:Record<string,string>={on_time:'bg-green-100 text-green-700',late:'bg-red-100 text-red-700',at_risk:'bg-yellow-100 text-yellow-700'}
  return <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${map[status||'']||'bg-gray-100 text-gray-500'}`}>{(status||'-').toUpperCase()}</span>
}
function PodBadge({status}:{status:string|null}){
  const map:Record<string,string>={received:'bg-green-100 text-green-700',pending:'bg-yellow-100 text-yellow-700',missing:'bg-red-100 text-red-700'}
  return <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${map[status||'']||'bg-gray-100 text-gray-500'}`}>{(status||'-').toUpperCase()}</span>
}

export function ShipmentRow({ shipment, vendors }:{ shipment: Shipment; vendors:{vendor_name:string;vendor_code:string}[] }){
  const [open,setOpen]=useState(false)
  return (
    <>
      <tr className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={()=>setOpen(true)}>
        <td className="px-4 py-2.5 text-xs">{shipment.shipment_date?.slice(0,10) ?? '-'}</td>
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{String(shipment.shipment_no ?? shipment.document_no ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-xs">{String(shipment.destination_city ?? '-').toUpperCase()}{shipment.destination_name && <div className="text-xs text-gray-500">{String(shipment.destination_name).toUpperCase()}</div>}</td>
        <td className="px-4 py-2.5 text-xs">{String(shipment.vendor_name ?? '-').toUpperCase()}</td>
        <td className="px-4 py-2.5 text-xs">{shipment.eta?.slice(0,10) ?? '-'}</td>
        <td className="px-4 py-2.5"><StatusBadge status={shipment.status} /></td>
        <td className="px-4 py-2.5"><SlaBadge status={shipment.sla_status} /></td>
        <td className="px-4 py-2.5"><PodBadge status={shipment.pod_status} /></td>
      </tr>
      {open && <ShipmentEditPanel shipment={shipment} vendors={vendors} onClose={()=>setOpen(false)} onSaved={()=>{if(typeof window!=='undefined') window.location.reload()}} />}
    </>
  )
}
