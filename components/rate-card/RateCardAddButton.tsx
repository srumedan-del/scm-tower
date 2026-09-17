'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RateCardEditPanel from './RateCardEditPanel'

export default function RateCardAddButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSaved() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={()=>setOpen(true)} className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">+ TAMBAH RATE</button>
      {open && <RateCardEditPanel rate={null} onClose={()=>setOpen(false)} onSaved={handleSaved} />}
    </>
  )
}
