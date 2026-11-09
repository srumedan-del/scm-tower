'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogPrimaryClass } from '@/components/ui/FormDialog'
import { useState } from 'react'
import { Search, Loader2, ShieldCheck } from 'lucide-react'
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

      <DialogShell onClose={() => { setResult(null); setErrorMsg(null) }} size="2xl" guardDirty={false}>
        <DialogHeader
          title="Hasil Verifikasi Data"
          subtitle={`Total: ${result?.totalHeaders ?? 0} header, ${result?.totalDetails ?? 0} detail`}
          icon={ShieldCheck}
        />
          <div className={dialogBodyClass}>

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
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">DOCUMENT NO</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">ITEM</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">DESKRIPSI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.orphanedDetails.map((d) => (
                            <tr key={String(d.id)} className="border-t">
                              <td className="px-4 py-2 text-xs font-mono font-medium text-slate-700">{d.document_no}</td>
                              <td className="px-4 py-2 text-xs font-mono font-medium text-slate-700">{d.item_no}</td>
                              <td className="px-4 py-2 text-xs font-mono font-medium text-slate-700">{d.description}</td>
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
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">ID</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">PTR NO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.emptyHeaders.map((h) => (
                            <tr key={String(h.id)} className="border-t">
                              <td className="px-4 py-2 text-xs font-mono font-medium text-slate-700">{h.id}</td>
                              <td className="px-4 py-2 text-xs font-mono font-medium text-slate-700">{h.ptr_no}</td>
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
                className={dialogPrimaryClass}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Verifikasi Ulang
              </button>
            </div>
          </div>
      </DialogShell>
    </>
  )
}
