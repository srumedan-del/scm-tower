'use client'

import { DialogShell, DialogHeader, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass } from '@/components/ui/FormDialog'
import { useState, useTransition, useEffect } from 'react'
import { Plus, Trash2, ArrowRightLeft, Loader2, AlertCircle, X } from 'lucide-react'
import {
  insertCrossdocking, updateCrossdockingHeader, deleteCrossdocking,
  upsertCrossdockingDetail, deleteCrossdockingDetail,
  getCrossdockingOptions, getCrossdockingById, getPtsDetailsForCrossdocking,
  type CrossdockingHeader, type CrossdockingDetail,
  type SkuOption, type CustomerOption,
} from '@/app/(app)/crossdocking/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

const STATUS_OPTS = ['Draft', 'Ready', 'Dispatched', 'In Transit', 'Delivered'] as const

type DetailDraft = Omit<CrossdockingDetail, 'id' | 'crossdocking_id' | 'created_at' | 'item_name'> & {
  _key: string
  id?: number
  item_name?: string | null
}

type Props = {
  crossdockingId: number | null
  onClose: () => void
  onSaved: () => void
}

const emptyDetail = (): DetailDraft => ({
  _key: Math.random().toString(36).slice(2),
  item_no: null,
  description: null,
  quantity: 1,
  uom: null,
  lot_no: null,
  expiration_date: null,
  notes: null,
})

function nowLocalDateTime() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function normalizeDocumentDateTime(value: string | null | undefined) {
  if (!value) return { document_created_at: null, document_date: null }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { document_created_at: null, document_date: value.slice(0, 10) || null }
  return { document_created_at: date.toISOString(), document_date: value.slice(0, 10) }
}

export default function CrossdockingPanel({ crossdockingId, onClose, onSaved }: Props) {
  const isEdit = crossdockingId !== null

  // Options
  const [skus, setSkus] = useState<SkuOption[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [ptsOptions, setPtsOptions] = useState<Array<{ id: number; pts_no: string; document_date: string | null }>>([])
  const [selectedPtsIds, setSelectedPtsIds] = useState<number[]>([])
  const [optLoading, setOptLoading] = useState(true)

  // Header form
  const [header, setHeader] = useState<Partial<CrossdockingHeader>>({
    status: 'Draft',
    document_created_at: nowLocalDateTime(),
    document_date: new Date().toISOString().slice(0, 10),
    received_from_hq_date: new Date().toISOString().slice(0, 10),
    promised_delivery_date: '',
  })

  // Detail rows
  const [details, setDetails] = useState<DetailDraft[]>([emptyDetail()])

  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const hup = (k: keyof CrossdockingHeader, v: any) =>
    setHeader(f => ({ ...f, [k]: v }))

  // Load options (memuat PTS bulan saat proses dan bulan sebelumnya untuk respon super cepat)
  useEffect(() => {
    getCrossdockingOptions().then(opts => {
      setSkus(opts.skus)
      setCustomers(opts.customers)
      setPtsOptions(opts.pts)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))

    if (isEdit && crossdockingId) {
      getCrossdockingById(crossdockingId).then(({ header: h, details: d }) => {
        setHeader(h)
        setDetails(
          d.length > 0
            ? d.map(r => ({ ...r, _key: r.id.toString() }))
            : [emptyDetail()]
        )
      }).catch(e => setErr(e.message))
    }
  }, [crossdockingId, isEdit])

  function onCustomerNameChange(name: string) {
    hup('customer_name', name || null)
    const c = customers.find(c => c.customer_name.toLowerCase() === name.trim().toLowerCase())
    if (c) {
      hup('destination_city', c.destination_city)
      hup('destination_address', c.destination_address)
    }
  }

  function onPtsChange(value: string) {
    const ptsId = Number(value)
    if (!ptsId || selectedPtsIds.includes(ptsId)) return
    const nextIds = [...selectedPtsIds, ptsId]
    setSelectedPtsIds(nextIds)
    hup('pts_id', nextIds[0])

    const selectedOptions = ptsOptions.filter(option => nextIds.includes(option.id))
    const dates = selectedOptions.map(option => option.document_date).filter(Boolean).sort()
    hup('hq_reference_no', selectedOptions.map(option => option.pts_no).join(', '))
    if (dates[0]) {
      hup('document_date', dates[0])
      hup('received_from_hq_date', dates[0])
    }

    Promise.all(nextIds.map(id => getPtsDetailsForCrossdocking(id)))
      .then(detailGroups => {
        const merged = detailGroups.flat()
        setDetails(merged.length ? merged.map((row, index) => ({ ...row, _key: `pts-${index}` })) : [emptyDetail()])
      })
      .catch(error => setErr(error.message))
  }

  function removePts(ptsId: number) {
    const nextIds = selectedPtsIds.filter(id => id !== ptsId)
    setSelectedPtsIds(nextIds)
    hup('pts_id', nextIds[0] ?? null)
    const selectedOptions = ptsOptions.filter(option => nextIds.includes(option.id))
    hup('hq_reference_no', selectedOptions.map(option => option.pts_no).join(', ') || null)
    Promise.all(nextIds.map(id => getPtsDetailsForCrossdocking(id)))
      .then(detailGroups => {
        const merged = detailGroups.flat()
        setDetails(merged.length ? merged.map((row, index) => ({ ...row, _key: `pts-${index}` })) : [emptyDetail()])
      })
      .catch(error => setErr(error.message))
  }

  const dupd = (key: string, field: keyof DetailDraft, value: any) =>
    setDetails(ds => ds.map(d => d._key === key ? { ...d, [field]: value } : d))

  function onItemChange(key: string, skuCode: string) {
    const itemNo = skuCode.trim()
    const sku = skus.find(s => s.sku_code.toLowerCase() === itemNo.toLowerCase())
    if (sku) {
      setDetails(ds => ds.map(d =>
        d._key === key
          ? { ...d, item_no: sku.sku_code, description: sku.item_name, item_name: sku.item_name, uom: sku.uom }
          : d
      ))
    } else {
      setDetails(ds => ds.map(d => d._key === key ? { ...d, item_no: itemNo || null, item_name: null } : d))
    }
  }

  function addDetail() {
    setDetails(ds => [...ds, emptyDetail()])
  }

  async function removeDetail(det: DetailDraft) {
    if (det.id) {
      try { await deleteCrossdockingDetail(det.id) }
      catch (e: any) { setErr(e.message); return }
    }
    setDetails(ds => ds.filter(d => d._key !== det._key))
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!header.received_from_hq_date) { setErr('Tanggal terima dari HQ wajib diisi'); return }
      if (!header.promised_delivery_date) { setErr('Promised delivery date wajib diisi'); return }
      if (!header.customer_name && !header.customer_code) {
        setErr('Customer wajib diisi'); return
      }
      if (!header.destination_city?.trim()) {
        setErr('Kota tujuan wajib diisi'); return
      }

      const validDetails = details.filter(d => d.quantity > 0)

      try {
        if (!isEdit) {
          const documentDateTime = normalizeDocumentDateTime(header.document_created_at ?? header.document_date)
          const { customer_code, customer_name, destination_address, destination_city, pts_id,
                  pss_no, psi_no, hq_reference_no, received_from_hq_date, promised_delivery_date,
                  notes, created_by } = header as any
          await insertCrossdocking(
            { customer_code, customer_name, destination_address, destination_city, pts_id,
              pss_no, psi_no, ...documentDateTime, hq_reference_no, received_from_hq_date, promised_delivery_date,
              status: 'Dispatched', notes, created_by, pts_ids: selectedPtsIds },
            validDetails.map(({ _key, id, item_name, ...rest }) => rest)
          )
        } else {
          const { id, crossdocking_no, created_at, updated_at, ...payload } = header as any
          await updateCrossdockingHeader(crossdockingId!, { ...payload, ...normalizeDocumentDateTime(header.document_created_at ?? header.document_date) })
          for (const d of validDetails) {
            const { _key, item_name, ...rest } = d
            await upsertCrossdockingDetail({ ...rest, id: rest.id ?? 0, crossdocking_id: crossdockingId! })
          }
        }
        onClose(); void showSuccess({ title: 'Crossdocking tersimpan', message: header.customer_name ?? undefined }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  async function del() {
    if (!crossdockingId) return
    if (!(await confirmAction({ title: 'Hapus crossdocking?', message: 'Data crossdocking beserta seluruh detail itemnya akan dihapus.' }))) return
    startDeleting(async () => {
      try { await deleteCrossdocking(crossdockingId); onClose(); void showSuccess({ title: 'Crossdocking dihapus' }).then(onSaved) }
      catch (e: any) { setErr(e.message) }
    })
  }

  const totalQty = details.reduce((s, d) => s + (Number(d.quantity) || 0), 0)

  return (
    <DialogShell onClose={onClose} size="4xl">
      <DialogHeader
        title={isEdit ? `Edit Crossdocking — ${(header as any).crossdocking_no ?? ''}` : 'Tambah Crossdocking'}
        subtitle="Shipment dari Kantor Pusat via Medan"
        icon={ArrowRightLeft}
        actions={
          <span className="mt-1.5 shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {header.status || 'Draft'}
          </span>
        }
      />

        {/* ── Modal Body (Scrollable) ── */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-slate-50/40">
          {optLoading && (
            <div className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[14px] font-medium text-indigo-700 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Memuat data master & PTS bulan ini...</span>
            </div>
          )}

          {/* ── 1. Info Pengiriman Card ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700">
                Informasi Pengiriman
              </h3>
            </div>

            {!isEdit && (
              <Field label="PTS Sumber Detail (Opsional)">
                <select
                  value=""
                  onChange={e => onPtsChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all cursor-pointer"
                >
                  <option value="">Pilih PTS yang telah di-upload...</option>
                  {ptsOptions.map(pts => (
                    <option key={pts.id} value={pts.id}>
                      {pts.pts_no}{pts.document_date ? ` · ${pts.document_date}` : ''}
                    </option>
                  ))}
                </select>
                {selectedPtsIds.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {selectedPtsIds.map(id => {
                      const pts = ptsOptions.find(option => option.id === id)
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1 text-[14px] font-bold text-indigo-700"
                        >
                          <span>{pts?.pts_no ?? id}</span>
                          <button
                            type="button"
                            onClick={() => removePts(id)}
                            className="text-indigo-400 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                            title="Hapus PTS"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <p className="mt-1 text-[12px] text-slate-400">
                  Pilih lebih dari satu PTS untuk menggabungkannya menjadi satu PSS. (Menampilkan PTS bulan aktif & 1 bulan sebelumnya)
                </p>
              </Field>
            )}

            {/* Customer & Kota */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <Field label="Nama Customer / Tujuan" required>
                  <input
                    value={header.customer_name ?? ''}
                    onChange={e => onCustomerNameChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                    list="crossdocking-customer-options"
                    placeholder="Ketik atau pilih customer tujuan"
                  />
                  <datalist id="crossdocking-customer-options">
                    {customers.map(c => (
                      <option
                        key={`${c.customer_name}-${c.destination_city ?? ''}`}
                        value={c.customer_name}
                        label={c.destination_city ?? ''}
                      />
                    ))}
                  </datalist>
                </Field>
              </div>
              <div>
                <Field label="Kota Tujuan" required>
                  <input
                    value={header.destination_city ?? ''}
                    onChange={e => hup('destination_city', e.target.value || null)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                    placeholder="Contoh: MEDAN / PEKANBARU"
                  />
                </Field>
              </div>
            </div>

            {/* Alamat Tujuan */}
            <Field label="Alamat Tujuan">
              <input
                value={header.destination_address ?? ''}
                onChange={e => hup('destination_address', e.target.value || null)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                placeholder="Alamat lengkap tujuan pengiriman"
              />
            </Field>

            {/* Nomor Dokumen & Datetime */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Field label="Nomor PSS">
                <input
                  value={header.pss_no ?? ''}
                  onChange={e => hup('pss_no', e.target.value || null)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium font-mono text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                  placeholder="PSS-XXXX-XXXX"
                />
              </Field>
              <Field label="Nomor PSI">
                <input
                  value={header.psi_no ?? ''}
                  onChange={e => hup('psi_no', e.target.value || null)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium font-mono text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                  placeholder="PSI-XXXX-XXXX"
                />
              </Field>
              <Field label="Document Date Time">
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(header.document_created_at ?? header.document_date)}
                  onChange={e => {
                    const value = e.target.value || null
                    const normalized = normalizeDocumentDateTime(value)
                    hup('document_created_at', value)
                    hup('document_date', normalized.document_date)
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                />
              </Field>
            </div>

            {/* Tanggal HQ, Promised, Ref & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <Field label="Terima dari HQ" required>
                <input
                  type="date"
                  value={header.received_from_hq_date?.slice(0, 10) ?? ''}
                  onChange={e => hup('received_from_hq_date', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                />
              </Field>
              <Field label="Promised Delivery" required>
                <input
                  type="date"
                  value={header.promised_delivery_date?.slice(0, 10) ?? ''}
                  onChange={e => hup('promised_delivery_date', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                />
              </Field>
              <Field label="Ref. No. dari HQ">
                <input
                  value={header.hq_reference_no ?? ''}
                  onChange={e => hup('hq_reference_no', e.target.value || null)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all"
                  placeholder="No. dokumen HQ"
                />
              </Field>
              <Field label="Status">
                <select
                  value={header.status ?? 'Draft'}
                  onChange={e => hup('status', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-bold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition-all cursor-pointer"
                >
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* ── 2. Detail Item Section ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700">
                  Detail Item
                </h3>
                <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[14px] font-bold text-indigo-700">
                  {details.filter(d => d.quantity > 0).length} baris · {totalQty.toLocaleString('id-ID')} pcs
                </span>
              </div>
              <button
                type="button"
                onClick={addDetail}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[14px] font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Tambah Item
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-[14px] border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 w-12">#</th>
                    <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 min-w-[160px] w-48">Item No</th>
                    <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 min-w-[240px]">Deskripsi</th>
                    <th className="px-3.5 py-2.5 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 w-28">Qty</th>
                    <th className="px-3.5 py-2.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 w-24">UOM</th>
                    <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 w-36">Lot No</th>
                    <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 w-40">Expired</th>
                    <th className="px-2 py-2.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {details.map((d, index) => (
                    <tr key={d._key} className="hover:bg-slate-50/70 transition-colors">
                      {/* Row Index # */}
                      <td className="px-3.5 py-2 text-center text-[14px] font-semibold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Item No */}
                      <td className="px-3.5 py-2">
                        <input
                          value={d.item_no ?? ''}
                          onChange={e => onItemChange(d._key, e.target.value)}
                          list="crossdocking-sku-options"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                          placeholder="Kode produk"
                        />
                        <datalist id="crossdocking-sku-options">
                          {skus.map(s => (
                            <option key={s.sku_code} value={s.sku_code} label={s.item_name} />
                          ))}
                        </datalist>
                      </td>

                      {/* Deskripsi */}
                      <td className="px-3.5 py-2">
                        <input
                          value={d.item_name || d.description || ''}
                          onChange={e => dupd(d._key, 'description', e.target.value || null)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                          placeholder="Nama / deskripsi item"
                        />
                      </td>

                      {/* Qty */}
                      <td className="px-3.5 py-2">
                        <input
                          type="number"
                          min={0}
                          value={d.quantity}
                          onChange={e => dupd(d._key, 'quantity', Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-bold font-mono text-right text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </td>

                      {/* UOM */}
                      <td className="px-3.5 py-2">
                        <input
                          value={d.uom ?? ''}
                          onChange={e => dupd(d._key, 'uom', e.target.value || null)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[14px] text-center uppercase font-bold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                          placeholder="PCS"
                        />
                      </td>

                      {/* Lot No */}
                      <td className="px-3.5 py-2">
                        <input
                          value={d.lot_no ?? ''}
                          onChange={e => dupd(d._key, 'lot_no', e.target.value || null)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-mono text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                          placeholder="Nomor lot"
                        />
                      </td>

                      {/* Expired */}
                      <td className="px-3.5 py-2">
                        <input
                          type="date"
                          value={d.expiration_date ?? ''}
                          onChange={e => dupd(d._key, 'expiration_date', e.target.value || null)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </td>

                      {/* Hapus Action */}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeDetail(d)}
                          className="rounded-lg p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {details.length > 0 && (
                  <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-[14px] uppercase tracking-wider text-slate-700">
                        TOTAL ({details.filter(d => d.quantity > 0).length} baris item)
                      </td>
                      <td className="px-4 py-3 text-right text-[14px] font-mono text-indigo-700">
                        {totalQty.toLocaleString('id-ID')}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {/* ── Error Notification ── */}
          {err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[14px] font-medium text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{err}</span>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className={dialogFooterClass}>
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={del}
                disabled={deleting}
                className={dialogDangerClass}
              >
                {deleting ? 'Menghapus…' : 'Hapus Crossdocking'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className={dialogCancelClass}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={dialogPrimaryClass}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                <span>{isEdit ? 'Simpan Perubahan' : 'Buat Crossdocking'}</span>
              )}
            </button>
          </div>
        </div>
    </DialogShell>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5 text-[14px]">
      <label className="flex items-center gap-1 text-[13px] font-medium text-slate-700">
        <span>{label}</span>
        {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      {children}
    </div>
  )
}
