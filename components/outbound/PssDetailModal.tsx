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

function isAssemblySetItem(itemNo: string | null | undefined): boolean {
  if (!itemNo) return false
  const clean = itemNo.trim().toUpperCase()
  return clean.startsWith('HD SET') || clean.startsWith('HD-SET') || /^HD\s*SET/i.test(clean)
}

export default function PssDetailModal({ pssNo }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [header, setHeader] = useState<Record<string, any> | null>(null)
  const [details, setDetails] = useState<DetailRow[]>([])
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [excludedItems, setExcludedItems] = useState<string[]>([])
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
      setExcludedItems([])

      try {
        const { header: h, details: d, customer: c, excludedItems: ex, error } = await getOutboundFullData(pssNo)
        if (cancelled) return
        if (error) {
          setErrorMsg((error as any)?.message || 'Gagal memuat data.')
          return
        }
        setHeader(h as Record<string, any>)
        setDetails(((d ?? []) as unknown as DetailRow[]).filter((row) => !isAssemblySetItem(row.item_no)))
        setCustomer(c as CustomerInfo | null)
        setExcludedItems(ex ?? [])
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
    setExcludedItems([])
    setErrorMsg(null)
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-md bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
            className="relative flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white font-sans text-sm shadow-2xl"
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
            <div className="min-h-0 flex-1 overflow-y-auto">

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
                      excludedItems.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          Data detail ada di upload, tetapi item yang masuk adalah non-SKU / assembly dan tidak ditampilkan di daftar ini:
                          <div className="mt-2 font-mono text-xs break-all">{excludedItems.join(', ')}</div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 py-4 text-center">
                          Belum ada data detail untuk PSS ini.
                        </p>
                      )
                    ) : (
                      <div className="receiving-table-scroll data-list-scroll max-h-[60vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">#</th>
                              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">ITEM NO</th>
                              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">DESKRIPSI</th>
                              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">QTY</th>
                              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">LOT</th>
                              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">EXPIRED</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {details.map((d, idx) => (
                              <tr key={String(d.id)} className="group border-t border-gray-100 transition-colors hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-medium text-center text-slate-600">{idx + 1}</td>
                                <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{d.item_no ?? '-'}</td>
                                <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{d.description || '-'}</td>
                                <td className="px-4 py-3 text-sm font-medium text-right text-slate-600">
                                  {d.quantity !== null
                                    ? Math.abs(Number(d.quantity)).toLocaleString('id-ID')
                                    : '-'}
                                </td>
                                <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{d.lot_no || '-'}</td>
                                <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600">
                                  {d.expiration_date && d.expiration_date !== '9999-12-31'
                                    ? String(d.expiration_date).slice(0, 10)
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t">
                            <tr>
                              <td colSpan={3} className="px-3 py-1.5 text-sm font-semibold text-gray-500">
                                TOTAL ({details.length} lines)
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-right text-slate-600">
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
