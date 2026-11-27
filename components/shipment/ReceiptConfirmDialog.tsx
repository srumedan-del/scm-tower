'use client'

import { useEffect, useState, useTransition } from 'react'
import { MessageCircle, Phone, PhoneCall } from 'lucide-react'
import {
  DialogShell, DialogHeader, DialogCancelButton, FormField, dialogBodyClass, dialogDangerClass, dialogFooterClass, dialogPrimaryClass, formControlClass,
} from '@/components/ui/FormDialog'
import { confirmAction, notify } from '@/lib/feedback'
import { clearReceiptConfirmation, getReceiptConfirmation, saveReceiptConfirmation, type ReceiptConfirmation } from '@/app/(app)/shipment-cost/receipt-actions'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : ''

/** Nomor Indonesia untuk WhatsApp: 08xx → 628xx. */
function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

/**
 * Vendor tanpa POD (JNE): user menelepon PIC penerima di pelanggan untuk memastikan barang
 * sudah diterima, lalu mencatat hasilnya. Kontak PIC diambil dari, dan bisa diperbarui ke, Master Customer.
 */
export default function ReceiptConfirmDialog({ trackingId, onClose, onSaved }: { trackingId: number; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<ReceiptConfirmation | null>(null)
  const [picName, setPicName] = useState('')
  const [picPhone, setPicPhone] = useState('')
  const [receivedDate, setReceivedDate] = useState(today())
  const [confirmedWith, setConfirmedWith] = useState('')
  const [note, setNote] = useState('')
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    getReceiptConfirmation(trackingId)
      .then(next => {
        setData(next)
        setPicName(next.pic_name ?? '')
        setPicPhone(next.pic_phone ?? '')
        setReceivedDate(next.received_date ?? today())
        setConfirmedWith(next.confirmed_with ?? next.pic_name ?? '')
        setNote(next.note ?? '')
      })
      .catch(error => { notify.error('Tidak dapat memuat data', error.message); onClose() })
  }, [trackingId, onClose])

  const picChanged = !!data && ((data.pic_name ?? '') !== picName.trim() || (data.pic_phone ?? '') !== picPhone.trim())
  const phone = picPhone.trim()

  function save() {
    startSaving(async () => {
      try {
        await saveReceiptConfirmation({
          tracking_id: trackingId, received_date: receivedDate, confirmed_with: confirmedWith, note,
          pic_name: picName, pic_phone: picPhone, save_pic: picChanged,
        })
        notify.success('Konfirmasi penerimaan disimpan', picChanged ? 'Kontak PIC di Master Customer ikut diperbarui.' : undefined)
        onSaved()
        onClose()
      } catch (error: any) {
        notify.error('Gagal menyimpan', error.message)
      }
    })
  }

  async function clear() {
    if (!await confirmAction({ title: 'Hapus konfirmasi?', message: 'Status kembali menjadi belum dikonfirmasi.', confirmLabel: 'Hapus', tone: 'danger' })) return
    startSaving(async () => {
      try {
        await clearReceiptConfirmation(trackingId)
        notify.success('Konfirmasi dihapus')
        onSaved()
        onClose()
      } catch (error: any) {
        notify.error('Gagal menghapus', error.message)
      }
    })
  }

  return (
    <DialogShell onClose={onClose} size="xl">
      <DialogHeader
        icon={PhoneCall}
        title="Konfirmasi penerimaan"
        subtitle={data ? `${data.pss_no ?? ''} · ${data.customer_name ?? ''}${data.destination_city ? ` · ${data.destination_city}` : ''}` : 'Memuat…'}
      />
      <div className={dialogBodyClass}>
        {!data ? <p className="text-sm text-slate-500">Memuat data…</p> : (
          <>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              JNE tidak mengembalikan dokumen POD. Telepon PIC penerima untuk memastikan barang
              {data.no_resi ? <> resi <span className="font-mono font-semibold">{data.no_resi}</span></> : null} sudah diterima.
            </p>

            <section className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">PIC penerima (Master Customer)</h3>
              {!data.customer_id && <p className="text-xs text-rose-700">Customer tidak ditemukan di Master Customer; kontak tidak bisa disimpan.</p>}
              {data.customer_id && !data.pic_phone && <p className="text-xs text-amber-700">Belum ada nomor kontak di Master Customer. Isi di bawah, akan ikut tersimpan.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Nama PIC">
                  <input value={picName} onChange={event => setPicName(event.target.value)} className={formControlClass} maxLength={80} disabled={!data.customer_id} />
                </FormField>
                <FormField label="Nomor telepon">
                  <input value={picPhone} onChange={event => setPicPhone(event.target.value)} className={formControlClass} inputMode="tel" placeholder="08…" maxLength={24} disabled={!data.customer_id} />
                </FormField>
              </div>
              {phone && (
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Phone className="h-4 w-4" aria-hidden="true" /> Telepon
                  </a>
                  <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                  </a>
                </div>
              )}
              {picChanged && data.customer_id && <p className="text-xs text-indigo-700">Perubahan kontak akan disimpan ke Master Customer.</p>}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Hasil konfirmasi</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Barang diterima tanggal" required>
                  <input type="date" value={receivedDate} max={today()} onChange={event => setReceivedDate(event.target.value)} className={formControlClass} />
                </FormField>
                <FormField label="Dikonfirmasi oleh (di pelanggan)" required>
                  <input value={confirmedWith} onChange={event => setConfirmedWith(event.target.value)} className={formControlClass} maxLength={80} placeholder="Nama yang menjawab telepon" />
                </FormField>
              </div>
              <FormField label="Catatan">
                <textarea value={note} onChange={event => setNote(event.target.value)} className={formControlClass} rows={2} maxLength={500} placeholder="Mis. diterima bagian gudang, kondisi baik" />
              </FormField>
              {data.status === 'In Transit' && (
                <p className="text-xs text-slate-500">Status shipment masih In Transit. Tandai diterima lewat tombol Terima di Shipment Tracking › Pengiriman Retail.</p>
              )}
              {data.confirmed_at && (
                <p className="text-xs text-slate-500">Terakhir dicatat {fmtDateTime(data.confirmed_at)}{data.confirmed_by ? ` oleh ${data.confirmed_by}` : ''}.</p>
              )}
            </section>
          </>
        )}
      </div>
      <div className={dialogFooterClass}>
        <div>
          {data?.confirmed_at && <button type="button" onClick={clear} disabled={saving} className={dialogDangerClass}>Hapus konfirmasi</button>}
        </div>
        <div className="flex gap-2">
          <DialogCancelButton onClose={onClose} />
          <button type="button" onClick={save} disabled={!data || saving} className={dialogPrimaryClass}>
            {saving ? 'Menyimpan…' : 'Simpan konfirmasi'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
