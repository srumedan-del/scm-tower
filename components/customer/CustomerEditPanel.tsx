'use client'

import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

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
  is_active: boolean | null
  lead_time_days: number | null
  safety_buffer_days: number | null
}

const empty: Omit<Customer, 'id'> = {
  customer_code: '', customer_name: '', city: '', province: '', address: '', dk_lk: 'DK', latitude: null, longitude: null, machine_count: null, is_active: true, lead_time_days: 3, safety_buffer_days: 2,
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

  function del() {
    if (!customer) return
    if (!confirm(`HAPUS CUSTOMER ${customer.customer_code}?`)) return
    startDeleting(async () => {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id)
      if (error) { setErr(error.message); return }
      onSaved(); onClose()
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
        is_active: form.is_active,
        lead_time_days: form.lead_time_days == null ? null : Number(form.lead_time_days),
        safety_buffer_days: form.safety_buffer_days == null ? null : Number(form.safety_buffer_days),
      }
      let error
      if (customer) {
        const r = await supabase.from('customers').update(payload).eq('id', customer.id)
        error = r.error
      } else {
        const r = await supabase.from('customers').insert(payload)
        error = r.error
      }
      if (error) { setErr(error.message); return }
      onSaved()
      onClose()
    })
  }

  const hasCoord = form.latitude != null && form.longitude != null && !coordErr
  const mapsUrl = hasCoord ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}` : null
  const embedUrl = hasCoord ? `https://maps.google.com/maps?q=${form.latitude},${form.longitude}&z=15&output=embed` : null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <h3 className="text-lg font-bold uppercase">{customer ? 'EDIT CUSTOMER' : 'TAMBAH CUSTOMER'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="CUSTOMER CODE *"><input value={form.customer_code} onChange={e=>up('customer_code', e.target.value)} className="inp font-mono" placeholder="KLI000001" disabled={!!customer} /></Field>
          <Field label="CUSTOMER NAME *"><input value={form.customer_name ?? ''} onChange={e=>up('customer_name', e.target.value)} className="inp" placeholder="KLINIK ..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CITY"><input value={form.city ?? ''} onChange={e=>up('city', e.target.value)} className="inp" placeholder="MEDAN" /></Field>
            <Field label="PROVINCE"><input value={form.province ?? ''} onChange={e=>up('province', e.target.value)} className="inp" placeholder="SUMATERA UTARA" /></Field>
          </div>
          <Field label="ADDRESS"><textarea value={form.address ?? ''} onChange={e=>up('address', e.target.value)} className="inp" rows={2} placeholder="JL. ..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="DK / LK">
              <select value={form.dk_lk ?? 'DK'} onChange={e=>up('dk_lk', e.target.value)} className="inp">
                <option value="DK">DK — DALAM KOTA</option>
                <option value="LK">LK — LUAR KOTA</option>
              </select>
            </Field>
            <Field label="ACTIVE"><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!form.is_active} onChange={e=>up('is_active', e.target.checked)} /><span className="text-sm">AKTIF</span></label></Field>
          </div>
          <Field label="JUMLAH MESIN HD"><input type="number" min={0} value={form.machine_count ?? ''} onChange={e=>up('machine_count', e.target.value === '' ? null : Number(e.target.value))} className="inp" placeholder="CONTOH: 12" /></Field>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-bold text-gray-700 mb-1">LOKASI — KOORDINAT GOOGLE MAPS</div>
            <div className="text-xs text-gray-500 mb-2">Buka Google Maps → cari customer → klik kanan di pin → <b>copy koordinat</b> → paste di bawah (1 baris).</div>
            <Field label="KOORDINAT (LATITUDE, LONGITUDE)">
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
              <Field label="LEAD TIME (HARI)"><input type="number" value={form.lead_time_days ?? ''} onChange={e=>up('lead_time_days', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
              <Field label="SAFETY BUFFER (HARI)"><input type="number" value={form.safety_buffer_days ?? ''} onChange={e=>up('safety_buffer_days', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
            </div>
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>
            {customer && (
              <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'MENGHAPUS…' : 'HAPUS'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.customer_code || !form.customer_name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'MENYIMPAN…' : 'SIMPAN'}
            </button>
          </div>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#3b82f6}.inp:disabled{background:#f3f4f6;color:#6b7280}`}</style>
      </div>
    </div>
  )
}

function Field({label, children}:{label:string;children:React.ReactNode}) {
  return <label className="block"><span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>{children}</label>
}
