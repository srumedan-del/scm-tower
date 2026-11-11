'use client'

import { DialogShell, DialogHeader, dialogCancelClass } from '@/components/ui/FormDialog'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, Package, Undo2, Shuffle } from 'lucide-react'
import {
  getPtsDetailsForCrossdocking,
  getPtsRecords,
  setPtsRealokasi,
  type PtsRecord,
} from '@/app/(app)/crossdocking/actions'
import { notify, confirmAction } from '@/lib/feedback'
import { jakartaToday, workingDaysSince, PTS_PENDING_REMINDER_DAYS } from '@/lib/sla'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

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

  const [savingId, setSavingId] = useState<number | null>(null)

  async function toggleRealokasi(row: PtsRecord) {
    const toRealokasi = row.status !== 'Realokasi'
    if (toRealokasi && !(await confirmAction({
      title: `Realokasi ${row.pts_no}?`,
      message: 'PTS ini dipindah dari MDN-PAR ke JKT-JP12. Tidak dibuatkan Crossdocking dan tidak ada biaya.',
      confirmLabel: 'Tandai Realokasi',
      tone: 'info',
    }))) return
    setSavingId(row.id)
    try {
      const audit = await setPtsRealokasi(row.id, toRealokasi)
      setRows(current => current.map(item => item.id === row.id
        ? { ...item, ...audit, status: toRealokasi ? 'Realokasi' : 'Menunggu Crossdocking' }
        : item))
      notify.success(toRealokasi ? 'Ditandai Realokasi' : 'Realokasi dibatalkan', row.pts_no)
    } catch (error: any) {
      notify.error('Tidak dapat mengubah status', error.message)
    } finally {
      setSavingId(null)
    }
  }

  const realokasiCount = rows.filter(row => row.status === 'Realokasi').length
  const today = jakartaToday()
  const waitingDays = (row: PtsRecord) =>
    row.status === 'Menunggu Crossdocking' && row.document_date ? workingDaysSince(row.document_date, today) : 0
  const overdueCount = rows.filter(row => waitingDays(row) > PTS_PENDING_REMINDER_DAYS).length
  const pendingCount = useMemo(
    () => rows.filter(row => row.status === 'Menunggu Crossdocking').length,
    [rows]
  )

  return (
    <section className="space-y-3 font-sans text-[14px]">
      {/* ── Info bar ── */}
      <p className="text-[14px] text-slate-500 font-medium">
        <span className="font-bold text-indigo-700">{rows.length}</span> PTS ditampilkan{' '}
        (<span className="font-semibold text-amber-700">{pendingCount}</span> siap dipilih saat membuat Crossdocking
        {realokasiCount > 0 && <>, <span className="font-semibold text-violet-700">{realokasiCount}</span> realokasi ke JKT-JP12</>}).
      </p>
      {overdueCount > 0 && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[14px] text-red-700">
          <span className="font-bold">{overdueCount} PTS</span> sudah lebih dari {PTS_PENDING_REMINDER_DAYS} hari kerja belum diputuskan.
          Buat Crossdocking jika ada pesanan pelanggan, atau tandai Realokasi jika hanya pindah stok ke JKT-JP12.
        </p>
      )}

      {/* ── Tabel ── */}
      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-12rem)] overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[1000px] text-left text-[14px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-44">PTS No.</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-36">Tgl. Dokumen</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800">Customer</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800">Alamat Tujuan</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 text-center w-44">Status</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 text-center w-28">Detail</th>
              <th className="px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-slate-800 text-center w-36">Realokasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-[14px]">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    <span>Memuat data PTS...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-slate-400">
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
                      : row.status === 'Realokasi'
                        ? 'bg-violet-50 text-violet-700 border border-violet-200/60'
                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  }`} title={row.status === 'Realokasi' ? 'Realokasi MDN-PAR ke JKT-JP12, tanpa biaya' : undefined}>
                    {row.status === 'Realokasi' ? 'Realokasi ke JKT-JP12' : row.status}
                  </span>
                  {row.status === 'Realokasi' && (row.realokasi_by || row.realokasi_at) && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {[row.realokasi_by, row.realokasi_at && formatDateTime(row.realokasi_at)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {waitingDays(row) > PTS_PENDING_REMINDER_DAYS && (
                    <span className="mt-1 block text-xs font-semibold text-red-600">
                      {waitingDays(row)} hari kerja belum diputuskan
                    </span>
                  )}
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
                {/* Realokasi */}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {row.status === 'Terhubung Crossdocking' ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => toggleRealokasi(row)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-all disabled:opacity-50 ${
                        row.status === 'Realokasi'
                          ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                      }`}
                    >
                      {savingId === row.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : row.status === 'Realokasi' ? <Undo2 className="h-4 w-4" /> : <Shuffle className="h-4 w-4" />}
                      {row.status === 'Realokasi' ? 'Batalkan' : 'Realokasi'}
                    </button>
                  )}
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
    <DialogShell onClose={onClose} size="5xl" guardDirty={false}>
      <DialogHeader
        title={record.pts_no}
        icon={Package}
        subtitle={
          <>
            {record.transfer_order_no && <>TO: {record.transfer_order_no} · </>}
            Tgl dokumen {record.document_date ?? '—'} · {total.toLocaleString('id-ID')} unit ({items.length} baris lot)
          </>
        }
      />

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
            className={dialogCancelClass}
          >
            Tutup
          </button>
        </div>
    </DialogShell>
  )
}
