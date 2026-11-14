'use client'

import { useEffect } from 'react'

/** Buka dialog cetak (Save as PDF) begitu halaman siap, plus tombol cadangan. */
export function PrintOnLoad() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="toolbar">
      <button type="button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
      <button type="button" onClick={() => window.close()}>Tutup</button>
    </div>
  )
}
