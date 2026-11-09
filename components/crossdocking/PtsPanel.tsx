'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, Package, X } from 'lucide-react'
import {
  getPtsDetailsForCrossdocking,
  getPtsRecords,
  type PtsRecord,
} from '@/app/(app)/crossdocking/actions'
import { notify } from '@/lib/feedback'

interface Props {
  selectedMonth?: string
}

export default function PtsPanel({ selectedMonth }: Props) {
  const [rows, setRows] = useState<PtsRecord[]>([])
  const [loading, startLoading] = useTransition()
  const [selected, setSelected] = useState<PtsRecord | null>(null)

  const load = (month?: string) => startLoading(async () => {
    try {
      const target = month !== undefined ? month : selectedMonth
      setRows(await getPtsRecords(target))
    } catch (error: any) {
      notify.error('Tidak dapat memuat PTS', error.message)
    }
  })

  useEffect(() => {
    load(selectedMonth)
  }, [selectedMonth])

  const pendingCount = useMemo(
    () => rows.filter(row => row.status === 'Menunggu Crossdocking').length,
    [rows]
  )

  return (
    <section className="space-y-3 font-sans text-[14px]">
      {/* ── Info bar ── */}
      <p className="text-[14px] text-slate-500 font-medium">
        <span className="font-bold text-indigo-700">{rows.length}</span> PTS ditampilkan{' '}
        (<span className="font-semibold text-amber-700">{pendingCount}</span> siap dipilih saat membuat Crossdocking).
      </p>

      {/* ── Tabel ── */}
      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-12rem)] overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[860px] text-left text-[14px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-44">PTS No.</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">Tgl. Dokumen</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800">Customer</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800">Alamat Tujuan</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 text-center w-44">Status</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 text-center w-28">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-[14px]">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    <span>Memuat data PTS...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[14px] text-slate-400">
                  Belum ada data PTS untuk periode bulan ini.
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50/60 transition-colors">
                {/* PTS No */}
                <td className="px-4 py-3">
                  <span className="font-mono text-[14px] font-bold text-slate-800">{row.pts_no}</span>
                </td>
                {/* Document Date */}
                <td className="px-4 py-3 text-[14px] text-slate-600 whitespace-nowrap">
                  {row.document_date ?? <span className="text-slate-300">—</span>}
                </td>
                {/* Customer */}
                <td className="px-4 py-3 max-w-[220px]">
                  {row.customer_name
                    ? <span className="text-[14px] font-medium text-slate-800 line-clamp-2 leading-relaxed" title={row.customer_name}>{row.customer_name}</span>
                    : <span className="text-[14px] text-slate-300">—</span>
                  }
                </td>
                {/* Alamat */}
                <td className="px-4 py-3 max-w-[280px]">
                  {[row.destination_address, row.destination_city].filter(Boolean).join(', ')
                    ? (
                      <span
                        className="text-[14px] text-slate-600 line-clamp-2 leading-relaxed"
                        title={[row.destination_address, row.destination_city].filter(Boolean).join(', ')}
                      >
                        {[row.destination_address, row.destination_city].filter(Boolean).join(', ')}
                      </span>
                    )
                    : <span className="text-[14px] text-slate-300">—</span>
                  }
                </td>
                {/* Status */}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span className={`inline-flex rounded-lg px-2.5 py-1 text-[13px] font-bold ${
                    row.status === 'Terhubung Crossdocking'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  }`}>
                    {row.status}
                  </span>
                </td>
                {/* Detail */}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-semibold text-slate-700 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition-all cursor-pointer"
                  >
                    <Package className="h-4 w-4" />
                    <span>Lihat Item</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <PtsDetailModal
          record={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}

function PtsDetailModal({ record, onClose }: { record: PtsRecord; onClose: () => void }) {
  const [items, setItems] = useState<Array<{
    item_no: string | null
    description: string | null
    quantity: number
    uom: string | null
    lot_no: string | null
    expiration_date: string | null
    notes: string | null
  }>>([])
  const [loading, startLoading] = useTransition()

  useEffect(() => {
    startLoading(async () => {
      try {
        setItems(await getPtsDetailsForCrossdocking(record.id))
      } catch (err: any) {
        notify.error('Gagal memuat item', err.message)
      }
    })
  }, [record.id])

  const total = items.reduce((sum, item) => sum + item.quantity, 0)

  // Bersihkan format display lokasi sumber
  const formatLocation = (notes: string | null) => {
    if (!notes) return 'MDN-PAR'
    return notes.replace(/^Source:\s*/i, '').replace(/\|\s*Source:\s*/i, ' ').trim() || 'MDN-PAR'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] text-[14px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-[18px] sm:text-[20px] font-bold font-mono text-slate-900 tracking-tight">
                  {record.pts_no}
                </h3>
                {record.transfer_order_no && (
                  <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[14px] font-bold text-indigo-700 font-mono">
                    TO: {record.transfer_order_no}
                  </span>
                )}
              </div>
              <p className="text-[14px] text-slate-500 mt-0.5">
                Tgl Dokumen: <strong className="text-slate-800 font-semibold">{record.document_date ?? '—'}</strong> · Total:{' '}
                <strong className="text-indigo-700 font-bold">{total.toLocaleString('id-ID')} unit</strong> ({items.length} baris lot)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[780px] text-left text-[14px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 w-12 text-center whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-44">ITEM NO.</th>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 min-w-[240px]">DESKRIPSI</th>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 text-right w-28 whitespace-nowrap">QTY</th>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">LOT NO.</th>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-32">EXPIRED</th>
                <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-32">LOKASI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-[14px]">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      <span>Memuat rincian item PTS...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.map((item, index) => (
                <tr key={`${item.item_no}-${item.lot_no}-${index}`} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 text-center text-[14px] font-semibold text-slate-400">{index + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[14px] font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/70 rounded-md px-2.5 py-1">
                      {item.item_no ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] font-medium text-slate-800">{item.description ?? '—'}</td>
                  <td className="px-4 py-3 text-[14px] font-bold font-mono text-right text-slate-900 whitespace-nowrap">
                    {item.quantity.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-[14px] font-mono text-slate-700 whitespace-nowrap">{item.lot_no ?? '—'}</td>
                  <td className="px-4 py-3 text-[14px] font-mono text-slate-600 whitespace-nowrap">{item.expiration_date ?? '—'}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-slate-600 whitespace-nowrap">
                    {formatLocation(item.notes)}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-slate-400">
                    Tidak ada detail item untuk PTS ini.
                  </td>
                </tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-700">
                    TOTAL ({items.length} ITEM)
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold font-mono text-indigo-700 whitespace-nowrap">
                    {total.toLocaleString('id-ID')}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-3.5 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
