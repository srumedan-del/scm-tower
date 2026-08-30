'use client'
import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

type Rate = {
  id: number
  rate_code: string
  origin: string
  destination: string
  vehicle_type: string | null
  tonnage: number | null
  cbm: number | null
  tariff_model: string | null
  price: number | null
  status: string | null
  service_name: string | null
  effective_from: string | null
  vendor_id: number | null
}

export default function RateCardEditPanel({ rate, onClose, onSaved }: {
  rate: Rate | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => rate ? {
    rate_code: rate.rate_code ?? '',
    origin: rate.origin ?? '',
    destination: rate.destination ?? '',
    vehicle_type: rate.vehicle_type ?? '',
    tonnage: rate.tonnage,
    cbm: rate.cbm,
    tariff_model: rate.tariff_model ?? 'per_trip',
    price: rate.price,
    status: rate.status ?? 'aktif',
    service_name: rate.service_name ?? '',
    effective_from: rate.effective_from ? rate.effective_from.slice(0,10) : '',
  } : {
    rate_code: '', origin: 'MEDAN', destination: '', vehicle_type: 'R6', tonnage: null as number | null, cbm: null as number | null, tariff_model: 'per_trip', price: null as number | null, status: 'aktif', service_name: '', effective_from: '',
  })
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f:any) => ({ ...f, [k]: v }))

  function del() {
    if (!rate) return
    if (!confirm(`HAPUS RATE ${rate.rate_code}?`)) return
    startDeleting(async () => {
      const { error } = await supabase.from('transport_rate_card').delete().eq('id', rate.id)
      if (error) { setErr(error.message); return }
      onSaved(); onClose()
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload: any = {
        rate_code: (form.rate_code as string).trim().toUpperCase(),
        origin: (form.origin as string).trim().toUpperCase(),
        destination: (form.destination as string).trim().toUpperCase(),
        vehicle_type: (form.vehicle_type as string).trim().toUpperCase() || null,
        tonnage: form.tonnage == null ? null : Number(form.tonnage),
        cbm: form.cbm == null ? null : Number(form.cbm),
        tariff_model: (form.tariff_model as string).trim().toLowerCase() || 'per_trip',
        price: form.price == null ? null : Number(form.price),
        status: (form.status as string).trim().toLowerCase() || 'aktif',
        service_name: (form.service_name as string).trim().toUpperCase() || null,
        effective_from: (form.effective_from as string) || null,
      }
      if (!payload.rate_code) { setErr('RATE CODE wajib diisi'); return }
      if (!payload.origin) { setErr('ORIGIN wajib diisi'); return }
      if (!payload.destination) { setErr('DESTINATION wajib diisi'); return }
      let error
      if (rate) {
        const r = await supabase.from('transport_rate_card').update(payload).eq('id', rate.id)
        error = r.error
      } else {
        const r = await supabase.from('transport_rate_card').insert(payload)
        error = r.error
      }
      if (error) { setErr(error.message); return }
      onSaved(); onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <h3 className="text-lg font-bold uppercase">{rate ? 'EDIT RATE CARD' : 'TAMBAH RATE CARD'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="RATE CODE *"><input value={form.rate_code} onChange={e=>up('rate_code', e.target.value)} className="inp font-mono" placeholder="BIA-EKS-2137" disabled={!!rate} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ORIGIN *"><input value={form.origin} onChange={e=>up('origin', e.target.value)} className="inp" placeholder="MEDAN" /></Field>
            <Field label="DESTINATION *"><input value={form.destination} onChange={e=>up('destination', e.target.value)} className="inp" placeholder="BANDA ACEH" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="VEHICLE"><input value={form.vehicle_type} onChange={e=>up('vehicle_type', e.target.value)} className="inp" placeholder="R6" /></Field>
            <Field label="TONNAGE"><input type="number" step="any" value={form.tonnage ?? ''} onChange={e=>up('tonnage', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
            <Field label="CBM"><input type="number" step="any" value={form.cbm ?? ''} onChange={e=>up('cbm', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TARIFF MODEL">
              <select value={form.tariff_model} onChange={e=>up('tariff_model', e.target.value)} className="inp">
                <option value="per_trip">PER_TRIP</option>
                <option value="per_kg">PER_KG</option>
                <option value="per_cbm">PER_CBM</option>
                <option value="per_unit">PER_UNIT</option>
              </select>
            </Field>
            <Field label="PRICE *"><input type="number" value={form.price ?? ''} onChange={e=>up('price', e.target.value === '' ? null : Number(e.target.value))} className="inp" placeholder="1250000" /></Field>
          </div>
          <Field label="SERVICE NAME"><input value={form.service_name} onChange={e=>up('service_name', e.target.value)} className="inp" placeholder="TRUCKING 4 TON..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EFFECTIVE FROM"><input type="date" value={form.effective_from} onChange={e=>up('effective_from', e.target.value)} className="inp" /></Field>
            <Field label="STATUS">
              <select value={form.status} onChange={e=>up('status', e.target.value)} className="inp">
                <option value="aktif">AKTIF</option>
                <option value="nonaktif">NONAKTIF</option>
              </select>
            </Field>
          </div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>{rate && <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">{deleting ? 'MENGHAPUS…' : 'HAPUS'}</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.rate_code || !form.origin || !form.destination} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'MENYIMPAN…' : 'SIMPAN'}</button>
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
