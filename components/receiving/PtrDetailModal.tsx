'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Package, FileText } from 'lucide-react'
import { getReceivingFullData } from '@/app/(app)/receiving/actions'

interface HeaderData {
  id: string | number
  ptr_no: string
  transfer_order_no: string | null
  transfer_from_code: string | null
  transfer_to_code: string | null
  posting_date: string | null
  shipment_date: string | null
  receipt_date: string | null
  shipping_agent_code: string | null
  ship_to_receipt_days: number | null
  receipt_to_posting_days: number | null
  ship_to_posting_days: number | null
  source_file: string | null
  import_period: string | null
  created_at: string | null
  updated_at: string | null
}

interface DetailData {
  id: string | number
  document_no: string | null
  document_line_no: number | null
  item_no: string | null
  item_name: string | null
  description: string | null
  quantity: number | null
  lot_no: string | null
  expiration_date: string | null
  entry_no: number | null
}

interface Props {
  ptrNo: string
  onClose?: () => void
  trigger?: React.ReactNode
  isOpen?: boolean
}

const fieldLabels: Record<string, string> = {
  ptr_no: 'PTR No',
  transfer_order_no: 'Transfer Order',
  transfer_from_code: 'From',
  transfer_to_code: 'To',
  posting_date: 'Posting Date',
  shipment_date: 'Shipment Date',
  receipt_date: 'Receipt Date',
  shipping_agent_code: 'Shipping Agent',
  ship_to_posting_days: 'Ship → Posting (days)',
}

const HIDDEN_FIELDS = new Set([
  'id',
  'branch_representative',
  'project',
  'shipment_method_code',
  'external_document_no',
  'external_documents_no',
  'source_file',
  'import_period',
  'created_at',
  'updated_at',
  'ship_to_receipt_days',
  'receipt_to_posting_days',
])

function InfoGrid({ data }: { data: HeaderData }) {
  const items = Object.entries(data).filter(([key]) => !HIDDEN_FIELDS.has(key))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {items.map(([key, value]) => {
        const label = fieldLabels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        const display = value !== null && value !== undefined && value !== '' ? String(value) : '-'
        return (
          <div key={key}>
            <dt className="text-xs font-medium text-gray-500">{label}</dt>
            <dd className="text-sm font-mono text-gray-900 mt-0.5 break-all">{display}</dd>
          </div>
        )
      })}
    </div>
  )
}

export default function PtrDetailModal({ ptrNo, onClose, trigger, isOpen: controlledOpen }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const [loading, setLoading] = useState(false)
  const [header, setHeader] = useState<HeaderData | null>(null)
  const [details, setDetails] = useState<DetailData[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setErrorMsg(null)
      setHeader(null)
      setDetails([])

      try {
        const { header: h, details: d, error } = await getReceivingFullData(ptrNo)
        if (cancelled) return

        if (error) {
          setErrorMsg((error as Error)?.message || 'Gagal memuat data.')
          return
        }

        setHeader(h as HeaderData)
        setDetails((d ?? []) as DetailData[])
      } catch (err: any) {
        if (cancelled) return
        setErrorMsg(err?.message || 'Gagal memuat data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [open, ptrNo])

  const handleClose = () => {
    setInternalOpen(false)
    onClose?.()
    setHeader(null)
    setDetails([])
    setErrorMsg(null)
  }

  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setInternalOpen(true)} className="pointer-events-auto">
          {trigger}
        </button>
      ) : null}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900 font-mono">{ptrNo}</h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-73px)]">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="ml-3 text-sm text-gray-600">Memuat data...</span>
                </div>
              )}

              {errorMsg && !loading && (
                <div className="p-6">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                    {errorMsg}
                  </div>
                </div>
              )}

              {!loading && !errorMsg && header && (
                <>
                  <div className="p-6 border-b">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Data Header
                    </h3>
                    <InfoGrid data={header} />
                  </div>

                  <div className="p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Data Detail ({details.length} item)
                    </h3>
                    {details.length === 0 ? (
                      <p className="text-sm text-gray-500">Tidak ada item detail.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-center px-3 py-2 font-semibold">#</th>
                              <th className="text-left px-3 py-2 font-semibold">NOMOR URUT</th>
                              <th className="text-left px-3 py-2 font-semibold">ITEM NO</th>
                              <th className="text-left px-3 py-2 font-semibold">DESKRIPSI (MATERIAL MASTER)</th>
                              <th className="text-right px-3 py-2 font-semibold">QTY</th>
                              <th className="text-left px-3 py-2 font-semibold">LOT</th>
                              <th className="text-left px-3 py-2 font-semibold">EXPIRED DATE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {details.map((d, idx) => (
                              <tr key={String(d.id)} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-center text-xs">{idx + 1}</td>
                                <td className="px-3 py-2 font-mono">{d.entry_no ?? d.document_line_no ?? '-'}</td>
                                <td className="px-3 py-2 font-mono">{d.item_no ?? '-'}</td>
                                <td className="px-3 py-2">{d.item_name || d.description || '-'}</td>
                                <td className="px-3 py-2 text-right">{Number(d.quantity ?? 0).toLocaleString('id-ID')}</td>
                                <td className="px-3 py-2">{d.lot_no ?? '-'}</td>
                                <td className="px-3 py-2">{d.expiration_date ? String(d.expiration_date).slice(0, 10) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
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
