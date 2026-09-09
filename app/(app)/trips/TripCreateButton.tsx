'use client'

import { useState } from 'react'
import { TripCreatePanel } from './TripCreatePanel'

export function TripCreateButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
        Buat Trip
      </button>
      {open && <TripCreatePanel onClose={() => setOpen(false)} />}
    </>
  )
}
