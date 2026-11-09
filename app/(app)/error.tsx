'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-gold-600" aria-hidden="true" />
        <p className="lux-display mt-4 text-xl font-semibold text-indigo-900">Halaman gagal dimuat</p>
        <p className="mt-2 text-sm text-slate-600">
          Data belum berhasil diambil. Periksa koneksi, lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Coba lagi
        </button>
      </div>
    </div>
  )
}
