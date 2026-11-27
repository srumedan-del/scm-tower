'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { DialogShell, DialogHeader, DialogCancelButton, dialogBodyClass, dialogFooterClass, dialogPrimaryClass, FormField as Field } from '@/components/ui/FormDialog'
import { getSpabDrafts, createSpabDocuments, type SpabDraft } from '@/app/(app)/shipment/spab-actions'
import { DEFAULT_SPAB_SIGNER } from '@/lib/spab'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const previewNo = (seq: number | '', date: string) =>
  seq === '' || !date ? '-' : `${String(seq).padStart(5, '0')}/SPAB/SRU/${ROMAN[Number(date.slice(5, 7)) - 1]}/${date.slice(0, 4)}`

type Row = { draft: SpabDraft; checked: boolean; seq: number | ''; address: string; recipient: string }

const openPrint = (id: number) => window.open(`/print/spab/${id}`, '_blank', 'noopener')
const openPdf = (id: number) => window.open(`/print/spab/${id}?pdf=1`, '_blank', 'noopener')

/** Buat SPAB (Surat Perintah Ambil Barang) per PSS, biasanya langsung setelah trip dibuat. */
export default function SpabDialog({ pssNos, onClose }: { pssNos: string[]; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [spabDate, setSpabDate] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [signer, setSigner] = useState(DEFAULT_SPAB_SIGNER)
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: number; spab_no: string; pss_no: string }[]>([])
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    let cancelled = false
    getSpabDrafts(pssNos)
      .then(({ drafts, nextSeq, today }) => {
        if (cancelled) return
        setSpabDate(today)
        setPickupDate(today)
        // PSS yang belum punya SPAB dicentang dan diberi nomor urut berurutan.
        let seq = nextSeq
        setRows(drafts.map(draft => {
          const fresh = draft.existing.length === 0
          return {
            draft,
            checked: fresh,
            seq: fresh ? seq++ : '',
            address: draft.customer_address ?? '',
            recipient: draft.recipient,
          }
        }))
      })
      .catch((e: any) => !cancelled && setErr(e?.message ?? 'Gagal memuat data PSS'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [pssNos])

  const update = (index: number, patch: Partial<Row>) => setRows(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const selected = useMemo(() => rows.filter(row => row.checked), [rows])

  function submit() {
    setErr(null)
    if (!selected.length) { setErr('Pilih minimal satu PSS'); return }
    if (selected.some(row => row.seq === '')) { setErr('Nomor urut SPAB wajib diisi'); return }
    startSaving(async () => {
      try {
        const result = await createSpabDocuments(selected.map(row => ({
          tracking_id: row.draft.tracking_id,
          seq: Number(row.seq),
          spab_date: spabDate,
          pickup_date: pickupDate || null,
          customer_address: row.address,
          recipient: row.recipient,
          signer,
          notes,
        })))
        setCreated(result)
        if (result.length === 1) openPrint(result[0].id)
      } catch (e: any) {
        setErr(e?.message ?? 'Gagal membuat SPAB')
      }
    })
  }

  const tripId = rows[0]?.draft.trip_id

  return (
    <DialogShell onClose={onClose} size="3xl" guardDirty={!created.length}>
      <DialogHeader title="Buat SPAB" subtitle={`Surat Perintah Ambil Barang${tripId ? ` · ${tripId}` : ''}`} icon={FileText} />
      <div className={dialogBodyClass}>
        {loading && <div className="h-32 animate-pulse rounded-xl bg-slate-100" />}

        {!loading && created.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-green-800">{created.length} SPAB berhasil dibuat.</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {created.map(doc => (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span><span className="font-mono font-semibold text-slate-800">{doc.spab_no}</span> <span className="text-slate-500">· {doc.pss_no}</span></span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => openPdf(doc.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <Download className="h-4 w-4" /> Unduh PDF
                    </button>
                    <button type="button" onClick={() => openPrint(doc.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <Printer className="h-4 w-4" /> Cetak
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && !created.length && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Tanggal SPAB">
                <input type="date" value={spabDate} onChange={e => setSpabDate(e.target.value)} className="inp" />
              </Field>
              <Field label="Barang bisa diambil tanggal">
                <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="inp" />
              </Field>
              <Field label="Hormat kami (penanda tangan)">
                <input value={signer} onChange={e => setSigner(e.target.value)} className="inp" />
              </Field>
            </div>

            <div className="space-y-3">
              {rows.length === 0 && <p className="text-sm text-slate-500">PSS tidak ditemukan di Shipment Tracking.</p>}
              {rows.map((row, index) => (
                <div key={row.draft.tracking_id} className={`rounded-xl border p-3 ${row.checked ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200'}`}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={row.checked} onChange={e => update(index, { checked: e.target.checked })} className="mt-1 rounded border-slate-300" />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-900">{row.draft.pss_no}</span>
                      <span className="text-slate-600"> · {row.draft.customer_name ?? '-'}{row.draft.destination_city ? ` · ${row.draft.destination_city}` : ''}</span>
                      <span className="block text-xs text-slate-500">
                        {[row.draft.fleet_type, row.draft.vehicle_no, row.draft.driver_name].filter(Boolean).join(' · ')}
                      </span>
                      {row.draft.existing.length > 0 && (
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-amber-800">
                          Sudah ada SPAB:
                          {row.draft.existing.map(doc => (
                            <span key={doc.id} className="inline-flex items-center gap-1.5">
                              <button type="button" onClick={e => { e.preventDefault(); openPrint(doc.id) }} className="font-mono font-semibold underline">
                                {doc.spab_no}
                              </button>
                              <button type="button" title="Unduh PDF" onClick={e => { e.preventDefault(); openPdf(doc.id) }} className="inline-flex items-center gap-0.5 font-semibold underline">
                                <Download className="h-3.5 w-3.5" /> PDF
                              </button>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                  {row.checked && (
                    <div className="mt-3 grid grid-cols-1 gap-3 pl-7 sm:grid-cols-[150px_1fr]">
                      <Field label="No. urut">
                        <input
                          inputMode="numeric"
                          value={row.seq}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 5)
                            update(index, { seq: digits ? Number(digits) : '' })
                          }}
                          className="inp font-mono"
                        />
                      </Field>
                      <Field label="Nomor SPAB">
                        <div className="inp bg-slate-50 font-mono text-slate-700">{previewNo(row.seq, spabDate)}</div>
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Kepada (ekspedisi)">
                          <input value={row.recipient} onChange={e => update(index, { recipient: e.target.value })} className="inp" />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Alamat tujuan">
                          <textarea value={row.address} onChange={e => update(index, { address: e.target.value })} rows={2} className="inp" placeholder="Alamat pelanggan" />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Field label="Catatan tambahan (opsional)">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="inp" />
            </Field>
          </>
        )}

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      </div>
      <div className={dialogFooterClass}>
        <DialogCancelButton onClose={onClose} label={created.length ? 'Tutup' : 'Lewati'} />
        {!created.length && (
          <button type="button" onClick={submit} disabled={saving || loading || !selected.length} className={dialogPrimaryClass}>
            <FileText className="h-4 w-4" /> {saving ? 'Membuat…' : `Buat ${selected.length || ''} SPAB`}
          </button>
        )}
      </div>
    </DialogShell>
  )
}
