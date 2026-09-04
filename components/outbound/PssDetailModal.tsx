'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { getOutboundFullData } from '@/app/(app)/outbound/actions'

interface DetailRow {
  id: string | number
  document_no: string | null
  item_no: string | null
  description: string | null
  quantity: number | null
  qty_out: number | null
  location_code: string | null
  lot_no: string | null
  expiration_date: string | null
  entry_no: number | null
  posting_date: string | null
  entry_type: string | null
}

interface CustomerInfo {
  customer_name: string
  address: string
  city: string
}

interface Props {
  pssNo: string
}

export default function PssDetailModal({ pssNo }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [header, setHeader] = useState<Record<string, any> | null>(null)
  const [details, setDetails] = useState<DetailRow[]>([])
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setErrorMsg(null)
      setHeader(null)
      setDetails([])
      setCustomer(null)

      try {
        const { header: h, details: d, customer: c, error } = await getOutboundFullData(pssNo)
        if (cancelled) return
        if (error) {
          setErrorMsg((error as any)?.message || 'Gagal memuat data.')
          return
        }
        setHeader(h as Record<string, any>)
        setDetails((d ?? []) as unknown as DetailRow[])
        setCustomer(c as CustomerInfo | null)
      } catch (err: any) {
        if (cancelled) return
        setErrorMsg(err?.message || 'Gagal memuat data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [open, pssNo])

  const handleClose = () => {
    setOpen(false)
    setHeader(null)
    setDetails([])
    setCustomer(null)
    setErrorMsg(null)
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2 transition-colors"
      >
        {pssNo.toUpperCase()}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Modal title bar ─────────────────────── */}
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex-1 min-w-0">
                {/* PSS No — sama besar dengan Customer Name, di atas */}
                <h2 className="text-lg font-bold text-gray-900 leading-tight font-mono">
                  {pssNo.toUpperCase()}
                </h2>

                {/* Customer Name */}
                <h3 className="text-lg font-bold text-gray-900 leading-tight mt-0.5">
                  {customer?.customer_name ?? header?.customer_name ?? '—'}
                </h3>

                {/* Alamat */}
                {customer?.address && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {customer.address}
                    {customer.city ? `, ${customer.city}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex-shrink-0 ml-4 rounded-md p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Modal body ──────────────────────────── */}
            <div className="overflow-y-auto max-h-[calc(90vh-100px)]">

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="ml-3 text-sm text-gray-600">Memuat data...</span>
                </div>
              )}

              {/* Error */}
              {errorMsg && !loading && (
                <div className="p-6">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
                    {errorMsg}
                  </div>
                </div>
              )}

              {/* Content */}
              {!loading && !errorMsg && header && (
                <>
                  {/* Info header ringkas */}
                  <div className="px-6 py-3 border-b bg-gray-50">
                    <dl className="flex flex-wrap gap-x-8 gap-y-2">
                      {[
                        { label: 'Document Date', value: header.document_date?.slice(0, 10) },
                        { label: 'Order No',       value: header.order_no },
                        { label: 'Customer No',    value: header.customer_no },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <dt className="text-xs text-gray-400">{label}</dt>
                          <dd className="text-sm font-mono font-medium text-gray-900">{value || '-'}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Detail items */}
                  <div className="p-6">
                    {details.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        Belum ada data detail untuk PSS ini.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-center px-3 py-2 font-semibold text-gray-600">#</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">ITEM NO</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">DESKRIPSI</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-600">QTY</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">LOT</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">EXPIRED</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {details.map((d, idx) => (
                              <tr key={String(d.id)} className="hover:bg-blue-50">
                                <td className="px-3 py-2 text-center text-gray-400">{idx + 1}</td>
                                <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{d.item_no ?? '-'}</td>
                                <td className="px-3 py-2">{d.description || '-'}</td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {d.quantity !== null
                                    ? Math.abs(Number(d.quantity)).toLocaleString('id-ID')
                                    : '-'}
                                </td>
                                <td className="px-3 py-2 font-mono whitespace-nowrap">{d.lot_no || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {d.expiration_date && d.expiration_date !== '9999-12-31'
                                    ? String(d.expiration_date).slice(0, 10)
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t">
                            <tr>
                              <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-500">
                                TOTAL ({details.length} lines)
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs font-bold">
                                {details
                                  .reduce((s, d) => s + Math.abs(Number(d.quantity ?? 0)), 0)
                                  .toLocaleString('id-ID')}
                              </td>
                              <td colSpan={2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
