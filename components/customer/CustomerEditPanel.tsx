'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Users } from 'lucide-react'
import { useState, useTransition } from 'react'
import { upsertCustomer, deleteCustomer } from '@/app/(app)/master-data/customers/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

type Customer = {
  id: number
  customer_code: string
  customer_name: string | null
  city: string | null
  province: string | null
  address: string | null
  dk_lk: string | null
  latitude: number | null
  longitude: number | null
  machine_count: number | null
  is_hd_customer: boolean | null
  is_active: boolean | null
  lead_time_days: number | null
  safety_buffer_days: number | null
}

const empty: Omit<Customer, 'id'> = {
  customer_code: '', customer_name: '', city: '', province: '', address: '', dk_lk: 'DK', latitude: null, longitude: null, machine_count: null, is_hd_customer: false, is_active: true, lead_time_days: 3, safety_buffer_days: 2,
}

function parseCoord(input: string): { lat: number; lng: number } | null {
  const t = input.trim()
  if (!t) return null
  // accept "lat, lng" or "lat lng" or "lat,lng"
  const parts = t.split(',').length === 2 ? t.split(',') : t.split(/\s+/)
  if (parts.length < 2) return null
  const lat = parseFloat(parts[0].trim().replace(',', '.'))
  const lng = parseFloat(parts[1].trim().replace(',', '.'))
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export default function CustomerEditPanel({ customer, onClose, onSaved }: {
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<Customer, 'id'>>(() => {
    if (customer) {
      return {
        customer_code: customer.customer_code ?? '',
        customer_name: customer.customer_name ?? '',
        city: customer.city ?? '',
        province: customer.province ?? '',
        address: customer.address ?? '',
        dk_lk: customer.dk_lk ?? 'DK',
        latitude: customer.latitude,
        longitude: customer.longitude,
        machine_count: customer.machine_count ?? null,
        is_hd_customer: customer.is_hd_customer ?? false,
        is_active: customer.is_active ?? true,
        lead_time_days: customer.lead_time_days ?? 3,
        safety_buffer_days: customer.safety_buffer_days ?? 2,
      }
    }
    return { ...empty }
  })
  const [coordInput, setCoordInput] = useState(() => {
    if (customer?.latitude != null && customer?.longitude != null) return `${customer.latitude}, ${customer.longitude}`
    return ''
  })
  const [coordErr, setCoordErr] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleCoordChange(v: string) {
    setCoordInput(v)
    if (!v.trim()) {
      setCoordErr(null)
      setForm(f => ({ ...f, latitude: null, longitude: null }))
      return
    }
    const parsed = parseCoord(v)
    if (!parsed) {
      // check if out of range vs format error
      const parts = v.split(',')
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim())
        const lng = parseFloat(parts[1].trim())
        if (!Number.isNaN(lat) && (lat < -90 || lat > 90)) { setCoordErr('LATITUDE harus antara -90 dan 90'); return }
        if (!Number.isNaN(lng) && (lng < -180 || lng > 180)) { setCoordErr('LONGITUDE harus antara -180 dan 180'); return }
      }
      setCoordErr('FORMAT SALAH — contoh: 3.5952, 98.6722')
      return
    }
    setCoordErr(null)
    setForm(f => ({ ...f, latitude: parsed.lat, longitude: parsed.lng }))
  }

  async function del() {
    if (!customer) return
    if (!(await confirmAction({ title: 'Hapus customer?', message: `Customer ${customer.customer_code} akan dihapus.` }))) return
    startDeleting(async () => {
      try {
        await deleteCustomer(customer.id)
        onClose(); void showSuccess({ title: 'Customer dihapus' }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (coordInput.trim() && coordErr) { setErr(coordErr); return }
      if (coordInput.trim() && (form.latitude == null || form.longitude == null)) { setErr('KOORDINAT belum valid — periksa format. Contoh: 3.5952, 98.6722'); return }
      const payload: any = {
        customer_code: form.customer_code.trim().toUpperCase(),
        customer_name: (form.customer_name ?? '').trim().toUpperCase() || null,
        city: (form.city ?? '').trim().toUpperCase() || null,
        province: (form.province ?? '').trim().toUpperCase() || null,
        address: (form.address ?? '').trim().toUpperCase() || null,
        dk_lk: form.dk_lk || null,
        latitude: form.latitude === null || Number.isNaN(Number(form.latitude)) ? null : Number(form.latitude),
        longitude: form.longitude === null || Number.isNaN(Number(form.longitude)) ? null : Number(form.longitude),
        machine_count: form.machine_count == null || Number.isNaN(Number(form.machine_count)) ? null : Number(form.machine_count),
        is_hd_customer: form.is_hd_customer ?? false,
        is_active: form.is_active,
        lead_time_days: form.lead_time_days == null ? null : Number(form.lead_time_days),
        safety_buffer_days: form.safety_buffer_days == null ? null : Number(form.safety_buffer_days),
      }
      try {
        await upsertCustomer(payload, customer?.id)
        onClose(); void showSuccess({ title: 'Customer tersimpan', message: form.customer_name ?? '' }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  const hasCoord = form.latitude != null && form.longitude != null && !coordErr
  const mapsUrl = hasCoord ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}` : null
  const embedUrl = hasCoord ? `https://maps.google.com/maps?q=${form.latitude},${form.longitude}&z=15&output=embed` : null

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title={customer ? 'Edit Customer' : 'Tambah Customer'} subtitle={customer ? customer.customer_name : 'Daftarkan customer baru'} icon={Users} />
        <div className={dialogBodyClass}>
          <Field label="Customer code *"><input value={form.customer_code} onChange={e=>up('customer_code', e.target.value)} className="inp font-mono" placeholder="KLI000001" disabled={!!customer} /></Field>
          <Field label="Customer name *"><input value={form.customer_name ?? ''} onChange={e=>up('customer_name', e.target.value)} className="inp" placeholder="KLINIK ..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input value={form.city ?? ''} onChange={e=>up('city', e.target.value)} className="inp" placeholder="MEDAN" /></Field>
            <Field label="Province"><input value={form.province ?? ''} onChange={e=>up('province', e.target.value)} className="inp" placeholder="SUMATERA UTARA" /></Field>
          </div>
          <Field label="Address"><textarea value={form.address ?? ''} onChange={e=>up('address', e.target.value)} className="inp" rows={2} placeholder="JL. ..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="DK / LK">
              <select value={form.dk_lk ?? 'DK'} onChange={e=>up('dk_lk', e.target.value)} className="inp">
                <option value="DK">DK — DALAM KOTA</option>
                <option value="LK">LK — LUAR KOTA</option>
              </select>
            </Field>
            <Field label="Active"><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!form.is_active} onChange={e=>up('is_active', e.target.checked)} /><span className="text-sm">AKTIF</span></label></Field>
          </div>
          <Field label="Jumlah mesin HD"><input type="number" min={0} value={form.machine_count ?? ''} onChange={e=>up('machine_count', e.target.value === '' ? null : Number(e.target.value))} className="inp" placeholder="CONTOH: 12" /></Field>
          <Field label="Jenis customer">
            <select
              value={form.is_hd_customer ? 'HD' : 'NHD'}
              onChange={e => up('is_hd_customer', e.target.value === 'HD')}
              className="inp"
            >
              <option value="HD">HD</option>
              <option value="NHD">NHD</option>
            </select>
            <div className="mt-1 text-xs text-gray-500">Pilih HD untuk customer dengan mesin dialisis; selain itu adalah customer NHD.</div>
            {form.is_hd_customer && !form.machine_count && (
              <div className="mt-1 text-xs text-amber-600">⚠ Isi jumlah mesin HD di atas untuk kalkulasi monitoring yang akurat</div>
            )}
          </Field>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-bold text-gray-700 mb-1">LOKASI — KOORDINAT GOOGLE MAPS</div>
            <div className="text-xs text-gray-500 mb-2">Buka Google Maps → cari customer → klik kanan di pin → <b>copy koordinat</b> → paste di bawah (1 baris).</div>
            <Field label="Koordinat (latitude, longitude)">
              <input value={coordInput} onChange={e=>handleCoordChange(e.target.value)} className={`inp font-mono ${coordErr ? 'border-red-400 focus:border-red-500' : hasCoord ? 'border-green-400 focus:border-green-500' : ''}`} placeholder="3.5952, 98.6722" />
            </Field>
            {coordErr && <div className="text-xs text-red-600 mt-1">{coordErr}</div>}
            {!coordErr && hasCoord && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded font-bold">✓ {form.latitude}, {form.longitude}</span>
                  <a href={mapsUrl!} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">↗ BUKA DI GOOGLE MAPS</a>
                </div>
                <div className="rounded-lg overflow-hidden border border-border">
                  <iframe src={embedUrl!} width="100%" height="180" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Preview lokasi" />
                </div>
                <div className="text-xs text-gray-400">Pastikan pin di peta sesuai alamat customer. Kalau salah, geser pin di Google Maps dan copy ulang.</div>
              </div>
            )}
            {!coordInput.trim() && <div className="text-xs text-amber-600 mt-1">⚠ BELUM ADA KOORDINAT — KOLOM LOKASI AKAN “—”</div>}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Lead time (hari)"><input type="number" value={form.lead_time_days ?? ''} onChange={e=>up('lead_time_days', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
              <Field label="Safety buffer (hari)"><input type="number" value={form.safety_buffer_days ?? ''} onChange={e=>up('safety_buffer_days', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
            </div>
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className={dialogFooterClass}>
          <div>
            {customer && (
              <button onClick={del} disabled={deleting} className={dialogDangerClass}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving || !form.customer_code || !form.customer_name}
              className={dialogPrimaryClass} data-busy={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
    </DialogShell>
  )
}
