'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trash } from 'lucide-react'

type HeaderRow = {
  id: number | string
  ptr_no?: string | null
  transfer_order_no?: string | null
  transfer_from_code?: string | null
  transfer_to_code?: string | null
  posting_date?: string | null
  shipment_date?: string | null
  receipt_date?: string | null
  shipping_agent_code?: string | null
  ship_to_receipt_days?: number | null
  receipt_to_posting_days?: number | null
  ship_to_posting_days?: number | null
}

type DetailRow = {
  id: number | string
  receiving_header_id?: number | string | null
  document_no?: string | null
  item_no?: string | null
  description?: string | null
  quantity?: number | string | null
  uom?: string | null
  location_code?: string | null
}

type Props = {
  rows: HeaderRow[]
  details: DetailRow[]
}

const formatDate = (value?: string | null) => value ? value.slice(0, 10) : '-'

export default function ReceivingTable({ rows, details }: Props) {
  const router = useRouter()
  const [expandedPtr, setExpandedPtr] = useState<Record<string, boolean>>({})
  const [pendingAction, startTransition] = useTransition()

  const groupedDetails = useMemo(() => {
    const map = new Map<number, DetailRow[]>()
    for (const detail of details) {
      const headerId = Number(detail.receiving_header_id)
      if (!Number.isFinite(headerId)) continue
      const current = map.get(headerId) ?? []
      current.push(detail)
      map.set(headerId, current)
    }
    return map
  }, [details])

  const handleDeleteHeader = async (row: HeaderRow) => {
    const ptr = String(row.ptr_no ?? '').trim().toUpperCase()
    if (!ptr) {
      alert('PTR tidak valid.')
      return
    }

    if (!confirm(`Hapus PTR ${ptr} beserta semua item detailnya?`)) return

    startTransition(async () => {
      try {
        const headerId = Number(row.id)
        const { error: detailError } = await supabase
          .from('receiving_detail')
          .delete()
          .eq('receiving_header_id', headerId)

        const { error: headerError } = await supabase
          .from('receiving_header')
          .delete()
          .eq('id', headerId)

        if (detailError || headerError) {
          alert(`Gagal hapus PTR: ${detailError?.message ?? headerError?.message ?? 'Unknown error'}`)
          return
        }

        router.refresh()
      } catch (error: any) {
        alert(`Gagal hapus PTR: ${error?.message ?? 'Unknown error'}`)
      }
    })
  }

  const handleDeleteDetail = async (detail: DetailRow) => {
    const detailId = Number(detail.id)
    if (!detailId || Number.isNaN(detailId)) {
      alert('Item detail tidak valid.')
      return
    }

    const ptr = String(detail.document_no ?? '').trim().toUpperCase() || 'PTR'
    if (!confirm(`Hapus item ${String(detail.item_no ?? 'detail')} dari ${ptr}?`)) return

    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('receiving_detail')
          .delete()
          .eq('id', detailId)

        if (error) {
          alert(`Gagal hapus item: ${error.message}`)
          return
        }

        router.refresh()
      } catch (error: any) {
        alert(`Gagal hapus item: ${error?.message ?? 'Unknown error'}`)
      }
    })
  }

  const togglePtr = (ptr: string) => {
    setExpandedPtr((prev) => ({ ...prev, [ptr]: !prev[ptr] }))
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">RECEIPT DATE</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PTR NO</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TRANSFER ORDER</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">FROM → TO</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIPPING AGENT</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIP DATE</th>
            <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LEAD TIME</th>
            <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">R→P DAYS</th>
            <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTION</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const ptr = String(r.ptr_no ?? '').trim().toUpperCase()
            const rowId = Number(r.id)
            const detailRows = Number.isFinite(rowId) ? groupedDetails.get(rowId) ?? [] : []
            const expanded = !!expandedPtr[ptr]
            const lt = r.ship_to_receipt_days ?? 0
            const ltColor = lt > 14 ? 'bg-red-100 text-red-700' : lt > 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'

            return (
              <Fragment key={String(r.id)}>
                <tr className="border-t border-border hover:bg-blue-50 align-top">
                  <td className="px-4 py-2.5 text-xs font-medium">{formatDate(r.receipt_date)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => togglePtr(ptr || '-')}
                      className="cursor-pointer rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100"
                      disabled={pendingAction}
                    >
                      {ptr || '-'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{String(r.transfer_order_no ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-xs">{String(`${r.transfer_from_code ?? '-'} → ${r.transfer_to_code ?? '-'}`).toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-xs">{String(r.shipping_agent_code ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-xs">{formatDate(r.shipment_date)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${ltColor}`}>{lt} HARI</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs">{r.receipt_to_posting_days ?? 0}</td>
                  <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteHeader(r)}
                        disabled={pendingAction}
                        title={`Hapus PTR ${ptr}`}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                  </td>
                </tr>

                {expanded && (
                  <tr>
                    <td colSpan={9} className="bg-slate-50 p-0">
                      <div className="px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">Item PTR {ptr || '-'}</h3>
                          <span className="text-[11px] text-gray-500">{detailRows.length} item</span>
                        </div>

                        {detailRows.length > 0 ? (
                          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-100 text-left">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">ITEM</th>
                                  <th className="px-3 py-2 font-semibold">DESKRIPSI</th>
                                  <th className="px-3 py-2 font-semibold text-right">QTY</th>
                                  <th className="px-3 py-2 font-semibold">UOM</th>
                                  <th className="px-3 py-2 font-semibold">LOKASI</th>
                                  <th className="px-3 py-2 font-semibold text-center">ACTION</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailRows.map((detail) => (
                                  <tr key={String(detail.id)} className="border-t border-slate-200">
                                    <td className="px-3 py-2 font-mono">{String(detail.item_no ?? '-').toUpperCase()}</td>
                                    <td className="px-3 py-2">{String(detail.description ?? '-')}</td>
                                    <td className="px-3 py-2 text-right font-semibold">{Number(detail.quantity ?? 0).toLocaleString('id-ID')}</td>
                                    <td className="px-3 py-2">{String(detail.uom ?? '-').toUpperCase()}</td>
                                    <td className="px-3 py-2">{String(detail.location_code ?? '-').toUpperCase()}</td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDetail(detail)}
                                        disabled={pendingAction}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                                        aria-label="Hapus item"
                                        title="Hapus item"
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M3 6h18" />
                                          <path d="M8 6V4h8v2" />
                                          <path d="M19 6l-1 14H6L5 6" />
                                          <path d="M10 11v6M14 11v6" />
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-gray-500">
                            Tidak ada item detail untuk PTR ini.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}

          {rows.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">BELUM ADA DATA RECEIVING</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
