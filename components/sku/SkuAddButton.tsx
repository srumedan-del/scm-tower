'use client'
import { useState } from 'react'
import SkuEditPanel from './EditPanel'

export default function SkuAddButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={()=>setOpen(true)} className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">+ TAMBAH SKU</button>
      {open && <SkuEditPanel sku={null} onClose={()=>setOpen(false)} onSaved={()=>{ if(typeof window!=='undefined') window.location.reload() }} />}
    </>
  )
}
