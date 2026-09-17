'use client'

import { useState, useTransition, useEffect } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
import {
  insertCrossdocking, updateCrossdockingHeader, deleteCrossdocking,
  upsertCrossdockingDetail, deleteCrossdockingDetail,
  getCrossdockingOptions, getCrossdockingById, getPtsDetailsForCrossdocking,
  type CrossdockingHeader, type CrossdockingDetail,
  type SkuOption, type CustomerOption,
} from '@/app/(app)/crossdocking/actions'

const STATUS_OPTS = ['Draft', 'Ready', 'Dispatched', 'Delivered'] as const

type DetailDraft = Omit<CrossdockingDetail, 'id' | 'crossdocking_id' | 'created_at' | 'item_name'> & {
  _key: string     // client-only key untuk list rendering
  id?: number      // undefined = belum ada di DB
  item_name?: string | null
}

type Props = {
  crossdockingId: number | null   // null = form tambah baru
  onClose: () => void
  onSaved: () => void
}

const emptyDetail = (): DetailDraft => ({
  _key: Math.random().toString(36).slice(2),
  item_no: null, description: null, quantity: 1,
  uom: null, lot_no: null, expiration_date: null, notes: null,
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
  const [skus,      setSkus]      = useState<SkuOption[]>([])
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

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const hup = (k: keyof CrossdockingHeader, v: any) =>
    setHeader(f => ({ ...f, [k]: v }))

  // Load options + data (edit mode)
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
  }, [crossdockingId])

  // Suggestion list comes from the dedicated Crossdocking customer master.
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

  // Detail helpers
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

  // Validate & save
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
          // INSERT baru
          const documentDateTime = normalizeDocumentDateTime(header.document_created_at ?? header.document_date)
          const { customer_code, customer_name, destination_address, destination_city, pts_id,
                  pss_no, psi_no, hq_reference_no, received_from_hq_date, promised_delivery_date,
                  status, notes, created_by } = header as any
          await insertCrossdocking(
            { customer_code, customer_name, destination_address, destination_city, pts_id,
              pss_no, psi_no, ...documentDateTime, hq_reference_no, received_from_hq_date, promised_delivery_date,
              status: status ?? 'Draft', notes, created_by, pts_ids: selectedPtsIds },
            validDetails.map(({ _key, id, item_name, ...rest }) => rest)
          )
        } else {
          // UPDATE header
          const { id, crossdocking_no, created_at, updated_at, ...payload } = header as any
          await updateCrossdockingHeader(crossdockingId!, { ...payload, ...normalizeDocumentDateTime(header.document_created_at ?? header.document_date) })
          // Upsert setiap detail
          for (const d of validDetails) {
            const { _key, item_name, ...rest } = d
            await upsertCrossdockingDetail({ ...rest, id: rest.id ?? 0, crossdocking_id: crossdockingId! })
          }
        }
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  function del() {
    if (!crossdockingId) return
    if (!confirm('Hapus crossdocking ini beserta seluruh detail itemnya?')) return
    startDeleting(async () => {
      try { await deleteCrossdocking(crossdockingId); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  const totalQty = details.reduce((s, d) => s + (Number(d.quantity) || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white font-sans text-sm shadow-2xl">

        {/* ── Title ── */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-lg">
              {isEdit ? `Edit Crossdocking — ${(header as any).crossdocking_no ?? ''}` : 'Tambah Crossdocking'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Shipment dari Kantor Pusat via Medan — input manual
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat data...</p>}

          {/* ── Header fields ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Info Pengiriman</h3>

            {!isEdit && (
              <Field label="PTS sumber detail (opsional)">
                <select value="" onChange={e => onPtsChange(e.target.value)} className="inp">
                  <option value="">Pilih PTS yang telah di-upload</option>
                  {ptsOptions.map(pts => <option key={pts.id} value={pts.id}>{pts.pts_no}{pts.document_date ? ` · ${pts.document_date}` : ''}</option>)}
                </select>
                {selectedPtsIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedPtsIds.map(id => {
                      const pts = ptsOptions.find(option => option.id === id)
                      return <button key={id} type="button" onClick={() => removePts(id)} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-red-50 hover:text-red-700">
                        {pts?.pts_no ?? id} ×
                      </button>
                    })}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-gray-500">Pilih lebih dari satu PTS untuk menggabungkannya menjadi satu PSS.</p>
              </Field>
            )}

            {/* Customer */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Customer / Tujuan *">
                <input
                  value={header.customer_name ?? ''}
                  onChange={e => onCustomerNameChange(e.target.value)}
                  className="inp"
                  list="crossdocking-customer-options"
                  placeholder="Ketik atau pilih customer sebelumnya"
                />
                <datalist id="crossdocking-customer-options">
                  {customers.map(c => (
                    <option key={`${c.customer_name}-${c.destination_city ?? ''}`} value={c.customer_name} label={c.destination_city ?? ''} />
                  ))}
                </datalist>
              </Field>
              <Field label="Kota Tujuan *">
                <input
                  value={header.destination_city ?? ''}
                  onChange={e => hup('destination_city', e.target.value || null)}
                  className="inp"
                  placeholder="MEDAN"
                />
              </Field>
            </div>

            <Field label="Alamat Tujuan">
              <input
                value={header.destination_address ?? ''}
                onChange={e => hup('destination_address', e.target.value || null)}
                className="inp"
                placeholder="Alamat lengkap tujuan akhir"
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Nomor PSS">
                <input value={header.pss_no ?? ''} onChange={e => hup('pss_no', e.target.value || null)} className="inp font-mono" placeholder="PSS-XXXX-XXXX" />
              </Field>
              <Field label="Nomor PSI">
                <input value={header.psi_no ?? ''} onChange={e => hup('psi_no', e.target.value || null)} className="inp font-mono" placeholder="PSI-XXXX-XXXX" />
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
                  className="inp"
                />
              </Field>
            </div>

            {/* Tanggal & referensi */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Terima dari HQ *">
                <input
                  type="date"
                  value={header.received_from_hq_date?.slice(0, 10) ?? ''}
                  onChange={e => hup('received_from_hq_date', e.target.value)}
                  className="inp"
                />
              </Field>
              <Field label="Promised Delivery *">
                <input
                  type="date"
                  value={header.promised_delivery_date?.slice(0, 10) ?? ''}
                  onChange={e => hup('promised_delivery_date', e.target.value)}
                  className="inp"
                />
              </Field>
              <Field label="Ref. No. dari HQ">
                <input
                  value={header.hq_reference_no ?? ''}
                  onChange={e => hup('hq_reference_no', e.target.value || null)}
                  className="inp"
                  placeholder="No. dokumen HQ (opsional)"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Field label="Status">
                <select
                  value={header.status ?? 'Draft'}
                  onChange={e => hup('status', e.target.value)}
                  className="inp"
                >
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* ── Detail items ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                Detail Item ({details.filter(d => d.quantity > 0).length} baris · total {totalQty.toLocaleString('id-ID')} pcs)
              </h3>
              <button
                type="button"
                onClick={addDetail}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Item
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Item No</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Deskripsi</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600 w-20">Qty</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 w-16">UOM</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 w-24">Lot</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 w-28">Expired</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {details.map(d => (
                    <tr key={d._key} className="hover:bg-gray-50">
                      {/* Ketik kode produk; daftar menampilkan kode dan nama SKU. */}
                      <td className="px-2 py-1.5">
                        <input
                          value={d.item_no ?? ''}
                          onChange={e => onItemChange(d._key, e.target.value)}
                          list="crossdocking-sku-options"
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                          placeholder="Cari kode produk"
                        />
                        <datalist id="crossdocking-sku-options">
                          {skus.map(s => (
                            <option key={s.sku_code} value={s.sku_code} label={s.item_name} />
                          ))}
                        </datalist>
                      </td>
                      {/* Deskripsi */}
                      <td className="px-2 py-1.5">
                        <input
                          value={d.item_name || d.description || ''}
                          onChange={e => dupd(d._key, 'description', e.target.value || null)}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                          placeholder="Nama / deskripsi item"
                        />
                      </td>
                      {/* Qty */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number" min={0}
                          value={d.quantity}
                          onChange={e => dupd(d._key, 'quantity', Number(e.target.value) || 0)}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 text-right focus:outline-none"
                        />
                      </td>
                      {/* UOM */}
                      <td className="px-2 py-1.5">
                        <input
                          value={d.uom ?? ''}
                          onChange={e => dupd(d._key, 'uom', e.target.value || null)}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                          placeholder="PCS"
                        />
                      </td>
                      {/* Lot */}
                      <td className="px-2 py-1.5">
                        <input
                          value={d.lot_no ?? ''}
                          onChange={e => dupd(d._key, 'lot_no', e.target.value || null)}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none"
                        />
                      </td>
                      {/* Expired */}
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={d.expiration_date ?? ''}
                          onChange={e => dupd(d._key, 'expiration_date', e.target.value || null)}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                        />
                      </td>
                      {/* Hapus */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeDetail(d)}
                          className="text-red-400 hover:text-red-600"
                          title="Hapus baris"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {details.length > 0 && (
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500">
                        TOTAL ({details.filter(d => d.quantity > 0).length} item)
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold">
                        {totalQty.toLocaleString('id-ID')}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-between border-t px-6 py-4 bg-gray-50 shrink-0">
          <div>
            {isEdit && (
              <button
                onClick={del}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Crossdocking'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.4rem .7rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}`}</style>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>
      {children}
    </label>
  )
}
