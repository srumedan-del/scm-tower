'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Calendar, Check, X as XIcon } from 'lucide-react'
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
    <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <table className="w-full min-w-[980px] whitespace-nowrap text-xs">
              <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Posting date</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">PTR no</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Transfer order</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">From → To</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Shipping agent</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Ship date</th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Lead time</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0F4]">
                {rows.map((r) => {
                  const ptr = String(r.ptr_no ?? '').trim().toUpperCase()
                  const shipmentDate = r.shipment_date ? new Date(r.shipment_date) : null
                  const postingDate = r.posting_date ? new Date(r.posting_date) : null
                  const lt = (shipmentDate && postingDate && !isNaN(shipmentDate.getTime()) && !isNaN(postingDate.getTime()))
                    ? Math.ceil((postingDate.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 0
                   const ltColor = lt > 18 ? 'bg-red-100 text-red-700' : lt >= 11 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'

                  return (
                    <tr key={String(r.id)} className="group border-t border-[#EEF0F4] transition-colors hover:bg-[#F8FAFC]">
                       <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-[#475569]">{formatDate(r.posting_date)}</td>
                      <td className="px-4 py-2 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setSelectedPtr(ptr)}
                          className="cursor-pointer rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          disabled={pendingAction}
                        >
                          {ptr || '-'}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-xs font-medium text-[#475569]">{String(r.transfer_order_no ?? '-').toUpperCase()}</td>
                                        <td className="px-4 py-2 text-xs font-medium text-[#475569]">{String(r.shipping_agent_code ?? '-').toUpperCase()}</td>
                                        <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-[#475569]">
                                         {editRowId === r.id ? (
                                           <div className="flex items-center gap-1">
                                             <input
                                               type="date"
                                               value={editDate}
                                               onChange={(e) => setEditDate(e.target.value)}
                                               className="w-32 rounded-lg border border-[#D8DEE8] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                               disabled={pendingAction}
                                             />
                                             <button
                                               type="button"
                                               onClick={saveShipmentDate}
                                               disabled={pendingAction}
                                               className="rounded-md p-1 text-emerald-700 hover:bg-emerald-50"
                                               title="Simpan"
                                             >
                                               <Check className="h-3 w-3" />
                                             </button>
                                             <button
                                               type="button"
                                               onClick={cancelEditShipment}
                                               disabled={pendingAction}
                                               className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
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
                                             className="cursor-pointer rounded-lg border border-transparent bg-[#F1F5F9] px-2 py-1 text-xs text-[#475569] transition-colors hover:border-[#D8DEE8] hover:bg-white"
                                             title="Edit Ship Date"
                                           >
                                             <Calendar className="h-3 w-3 inline mr-1" />
                                             {formatDate(r.shipment_date)}
                                            </button>
                                          )}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2 text-right">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ltColor}`}>{lt} hari</span>
                                         </td>
                 </tr>
            )
          })}

          {rows.length === 0 && (
             <tr><td colSpan={7} className="px-6 py-14 text-center text-sm text-[#64748B]">Belum ada data receiving untuk periode ini.</td></tr>
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
