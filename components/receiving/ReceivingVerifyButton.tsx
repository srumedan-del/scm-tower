'use client'

import { useState } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { verifyReceivingData } from '@/app/(app)/receiving/actions'

interface OrphanedDetail {
  id: number | string
  document_no: string
  item_no: string
  description: string
}

interface EmptyHeader {
  id: string | number
  ptr_no: string
}

interface VerifyResult {
  orphanedDetails: OrphanedDetail[]
  orphanedCount: number
  emptyHeaders: EmptyHeader[]
  emptyHeadersCount: number
  totalHeaders: number
  totalDetails: number
}

export default function ReceivingVerifyButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleVerify = async () => {
    setLoading(true)
    setErrorMsg(null)
    setResult(null)
    try {
      const res = await verifyReceivingData()
      setResult(res)
    } catch (error: any) {
      setErrorMsg(error?.message || 'Gagal memverifikasi data.')
    } finally {
      setLoading(false)
    }
  }

  if (!result && !errorMsg) {
    return (
      <button
        type="button"
        onClick={handleVerify}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? 'Memverifikasi...' : 'Verifikasi Data'}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleVerify}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? 'Memverifikasi...' : 'Verifikasi Data'}
      </button>

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="relative w-full sm:max-w-2xl bg-white sm:rounded-xl shadow-xl border-t-4 border-t-indigo-600 sm:border-t-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Hasil Verifikasi Data
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Total: {result?.totalHeaders ?? 0} header, {result?.totalDetails ?? 0} detail
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setErrorMsg(null)
                }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                {errorMsg}
              </div>
            ) : result ? (
              <div className="mt-4 space-y-4">
                {result.orphanedCount > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700">
                      ⚠️ {result.orphanedCount} Detail tanpa Header (orphaned)
                    </h4>
                    <p className="text-xs text-gray-500">document_no tidak ditemukan di receiving_header</p>
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-2 py-1">DOCUMENT NO</th>
                            <th className="text-left px-2 py-1">ITEM</th>
                            <th className="text-left px-2 py-1">DESKRIPSI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.orphanedDetails.map((d) => (
                            <tr key={String(d.id)} className="border-t">
                              <td className="px-2 py-1 font-mono">{d.document_no}</td>
                              <td className="px-2 py-1">{d.item_no}</td>
                              <td className="px-2 py-1">{d.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    ✓ Semua detail memiliki header yang valid
                  </div>
                )}

                {result.emptyHeadersCount > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-700">
                      ℹ️ {result.emptyHeadersCount} Header tanpa Detail
                    </h4>
                    <p className="text-xs text-gray-500">ptr_no tidak memiliki detail transaksi</p>
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-2 py-1">ID</th>
                            <th className="text-left px-2 py-1">PTR NO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.emptyHeaders.map((h) => (
                            <tr key={String(h.id)} className="border-t">
                              <td className="px-2 py-1">{h.id}</td>
                              <td className="px-2 py-1 font-mono">{h.ptr_no}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    ✓ Semua header memiliki detail transaksi
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Verifikasi Ulang
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
