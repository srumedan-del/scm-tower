'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trash, Calendar, Check, X as XIcon } from 'lucide-react'
import PtrDetailModal from '@/components/receiving/PtrDetailModal'
import { updateShipmentDate } from '@/app/(app)/receiving/actions'

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
  const [pendingAction, startTransition] = useTransition()
  const [selectedPtr, setSelectedPtr] = useState<string | null>(null)
  const [editRowId, setEditRowId] = useState<string | number | null>(null)
  const [editDate, setEditDate] = useState('')

  const startEditShipment = (row: HeaderRow) => {
    setEditRowId(row.id)
    setEditDate(row.shipment_date ?? '')
  }

  const saveShipmentDate = async () => {
    if (!editRowId || !editDate) return
    startTransition(async () => {
      try {
        await updateShipmentDate(editRowId, editDate)
        router.refresh()
      } catch (err: any) {
        alert(`Gagal update ship date: ${err?.message ?? 'Unknown error'}`)
      }
    })
    setEditRowId(null)
    setEditDate('')
  }

  const cancelEditShipment = () => {
    setEditRowId(null)
    setEditDate('')
  }

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

  return (
    <div className="bg-white border border-border rounded-xl overflow-auto max-h-[85vh]">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b sticky top-0 z-20">
          <tr>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">POSTING DATE</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PTR NO</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TRANSFER ORDER</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">FROM → TO</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIPPING AGENT</th>
            <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIP DATE</th>
            <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LEAD TIME</th>
             <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTION</th>
           </tr>
         </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const ptr = String(r.ptr_no ?? '').trim().toUpperCase()
            const shipmentDate = r.shipment_date ? new Date(r.shipment_date) : null
            const postingDate = r.posting_date ? new Date(r.posting_date) : null
            const lt = (shipmentDate && postingDate && !isNaN(shipmentDate.getTime()) && !isNaN(postingDate.getTime()))
              ? Math.ceil((postingDate.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60 * 24))
              : 0
             const ltColor = lt > 18 ? 'bg-red-100 text-red-700' : lt >= 11 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'

            return (
              <tr key={String(r.id)} className="border-t border-border hover:bg-blue-50 align-top">
                 <td className="px-4 py-2.5 text-xs font-medium">{formatDate(r.posting_date)}</td>
                <td className="px-4 py-2.5 font-mono text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSelectedPtr(ptr)}
                    className="cursor-pointer rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100"
                    disabled={pendingAction}
                  >
                    {ptr || '-'}
                  </button>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{String(r.transfer_order_no ?? '-').toUpperCase()}</td>
                <td className="px-4 py-2.5 text-xs">{String(`${r.transfer_from_code ?? '-'} → ${r.transfer_to_code ?? '-'}`).toUpperCase()}</td>
                <td className="px-4 py-2.5 text-xs">{String(r.shipping_agent_code ?? '-').toUpperCase()}</td>
                 <td className="px-4 py-2.5 text-xs">
                   {editRowId === r.id ? (
                     <div className="flex items-center gap-1">
                       <input
                         type="date"
                         value={editDate}
                         onChange={(e) => setEditDate(e.target.value)}
                         className="border border-gray-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                         disabled={pendingAction}
                       />
                       <button
                         type="button"
                         onClick={saveShipmentDate}
                         disabled={pendingAction}
                         className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                         title="Simpan"
                       >
                         <Check className="h-3 w-3" />
                       </button>
                       <button
                         type="button"
                         onClick={cancelEditShipment}
                         disabled={pendingAction}
                         className="p-0.5 text-gray-500 hover:bg-gray-100 rounded"
                         title="Batal"
                       >
                         <XIcon className="h-3 w-3" />
                       </button>
                     </div>
                   ) : (
                     <button
                       type="button"
                       onClick={() => startEditShipment(r)}
                       disabled={pendingAction}
                       className="cursor-pointer rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-100"
                       title="Edit Ship Date"
                     >
                       <Calendar className="h-3 w-3 inline mr-1" />
                       {formatDate(r.shipment_date)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${ltColor}`}>{lt} HARI</span>
                   </td>
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
            )
          })}

          {rows.length === 0 && (
             <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">BELUM ADA DATA RECEIVING</td></tr>
          )}

          {rows.length > 0 && rows.length < 15 && (
            <tr>
              <td colSpan={8}>
                <div style={{ height: `${(15 - rows.length) * 38}px` }} />
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedPtr && (
        <PtrDetailModal
          ptrNo={selectedPtr}
          isOpen={true}
          onClose={() => setSelectedPtr(null)}
        />
      )}
    </div>
  )
}
