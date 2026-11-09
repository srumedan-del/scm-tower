'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Calendar, Check, X as XIcon, Plus, Minus } from 'lucide-react'
import PtrDetailModal from '@/components/receiving/PtrDetailModal'
import { updateShipmentDate } from '@/app/(app)/receiving/actions'
import { confirmAction, notify } from '@/lib/feedback'

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
  transport_mode?: 'DARAT' | 'LAUT' | 'UDARA' | null
  land_vendor_code?: string | null
  sea_vendor_code?: string | null
  air_vendor_code?: string | null
  container_no?: string | null
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
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
        notify.error('Gagal mengubah ship date', err?.message)
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
      notify.error('Item detail tidak valid')
      return
    }

    const ptr = String(detail.document_no ?? '').trim().toUpperCase() || 'PTR'
    if (!(await confirmAction({ title: 'Hapus item?', message: `Item ${String(detail.item_no ?? 'detail')} dari ${ptr} akan dihapus.` }))) return

    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('receiving_detail')
          .delete()
          .eq('id', detailId)

        if (error) {
          notify.error('Gagal menghapus item', error.message)
          return
        }

        router.refresh()
      } catch (error: any) {
        notify.error('Gagal menghapus item', error?.message)
      }
    })
  }

  return (
    <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[980px] whitespace-nowrap text-[14px]">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="w-8 px-2 py-3 text-center text-[14px] font-bold uppercase text-slate-800 whitespace-nowrap"></th>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Posting date</th>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">PTR no</th>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Transfer order</th>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">From → To</th>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Shipping agent</th>
            <th className="px-4 py-3 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Ship date</th>
            <th className="px-4 py-3 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">Lead time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const ptr = String(r.ptr_no ?? '').trim().toUpperCase()
            const shipmentDate = r.shipment_date ? new Date(r.shipment_date) : null
            const postingDate = r.posting_date ? new Date(r.posting_date) : null
            const lt = (shipmentDate && postingDate && !isNaN(shipmentDate.getTime()) && !isNaN(postingDate.getTime()))
              ? Math.ceil((postingDate.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60 * 24))
              : 0
            const ltColor = lt > 18 ? 'bg-red-100 text-red-700' : lt >= 11 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            const isExpanded = expandedRows.has(r.id)
            const hasContainer = Boolean(r.container_no && r.container_no.trim())

            return (
              <Fragment key={String(r.id)}>
                <tr
                  className={`group border-t transition-colors ${
                    !hasContainer
                      ? 'bg-red-50/80 hover:bg-red-100/80 border-red-200'
                      : 'border-gray-100 hover:bg-slate-50'
                  }`}
                >
                  <td className="w-8 px-2 py-2.5 text-center text-slate-600">
                    <button
                      type="button"
                      onClick={() => toggleRow(r.id)}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold transition-all ${
                        isExpanded
                          ? !hasContainer
                            ? 'border-red-500 bg-red-100 text-red-700'
                            : 'border-indigo-500 bg-indigo-50 text-indigo-600'
                          : !hasContainer
                            ? 'border-red-300 bg-white text-red-600 hover:border-red-500 hover:bg-red-50'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                      title={isExpanded ? 'Sembunyikan info' : 'Lihat info tambahan container & vendor'}
                    >
                      {isExpanded ? (
                        <Minus className="h-3 w-3 stroke-[2.5]" />
                      ) : (
                        <Plus className="h-3 w-3 stroke-[2.5]" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-slate-600">{formatDate(r.posting_date)}</td>
                  <td className="px-4 py-2.5 text-[14px] font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => setSelectedPtr(ptr)}
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        !hasContainer
                          ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200/80 focus-visible:ring-red-500'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-500'
                      }`}
                      title={!hasContainer ? 'Nomor container belum dimaintain. Klik untuk melengkapi detail.' : 'Lihat detail PTR'}
                      disabled={pendingAction}
                    >
                      {ptr || '-'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-[14px] font-medium text-slate-600">{String(r.transfer_order_no ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-[14px] font-medium text-slate-600">{String(`${r.transfer_from_code ?? '-'} → ${r.transfer_to_code ?? '-'}`).toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-[14px] font-medium text-slate-600">{String(r.shipping_agent_code ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-slate-600">
                    {editRowId === r.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={pendingAction}
                        />
                        <button
                          type="button"
                          onClick={saveShipmentDate}
                          disabled={pendingAction}
                          className="rounded-md p-1 text-emerald-700 hover:bg-emerald-50"
                          title="Simpan"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditShipment}
                          disabled={pendingAction}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                          title="Batal"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditShipment(r)}
                        disabled={pendingAction}
                        className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[14px] transition-colors ${
                          !hasContainer
                            ? 'border-red-200/60 bg-red-100/50 text-red-900 hover:bg-white hover:border-red-300'
                            : 'border-transparent bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                        title="Edit Ship Date"
                      >
                        <Calendar className="h-3.5 w-3.5 inline mr-1 text-slate-400" />
                        {formatDate(r.shipment_date)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[14px] font-medium text-right whitespace-nowrap text-slate-600">
                    <span className={`inline-flex rounded-md px-2.5 py-0.5 text-[14px] font-bold ${ltColor}`}>{lt} hari</span>
                  </td>
                </tr>
                {isExpanded && (
                  <tr
                    className={`border-t transition-colors ${
                      !hasContainer
                        ? 'bg-red-50/50 border-red-200/80'
                        : 'bg-slate-50/90 border-slate-100'
                    }`}
                  >
                    <td colSpan={8} className="px-8 py-3">
                      <div className="flex flex-wrap items-center gap-8 text-[14px] text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase tracking-wider text-[14px] text-slate-500">
                            Mode Pengiriman:
                          </span>
                          <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-[14px] font-bold text-indigo-700 font-mono">
                            {r.transport_mode || 'LAUT'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase tracking-wider text-[14px] text-slate-500">
                            No. Container / Airway Ref:
                          </span>
                          {r.container_no ? (
                            <span className="font-mono font-bold text-slate-800 text-[14px]">
                              {r.container_no}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-[14px] text-red-700 bg-red-100 px-2.5 py-0.5 rounded-md">
                              Belum dimaintain
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase tracking-wider text-[14px] text-slate-500">
                            Nama Vendor:
                          </span>
                          <span className="font-bold text-slate-800 text-[14px]">
                            {r.sea_vendor_code || r.land_vendor_code || r.air_vendor_code || r.shipping_agent_code || <span className="font-normal italic text-slate-400">Belum diisi</span>}
                          </span>
                        </div>
                        {!hasContainer && (
                          <button
                            type="button"
                            onClick={() => setSelectedPtr(ptr)}
                            className="text-[14px] font-bold text-red-600 hover:text-red-700 underline ml-auto"
                          >
                            + Isi Nomor Container Sekarang
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}

          {rows.length === 0 && (
            <tr><td colSpan={8} className="px-6 py-14 text-center text-[14px] text-slate-500">Belum ada data receiving untuk periode ini.</td></tr>
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
