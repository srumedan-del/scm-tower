'use client'
import { useState } from 'react'
import ShipmentEditPanel from './ShipmentEditPanel'
export function ShipmentAddButton({ vendors }:{ vendors:{vendor_name:string;vendor_code:string}[] }){
  const [open,setOpen]=useState(false)
  return (
    <>
      <button onClick={()=>setOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">+ TAMBAH SHIPMENT</button>
      {open && <ShipmentEditPanel shipment={null} vendors={vendors} onClose={()=>setOpen(false)} onSaved={()=>{if(typeof window!=='undefined') window.location.reload()}} />}
    </>
  )
}
