'use client'
import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

type Fleet = {
  id: number
  vehicle_no: string | null
  nopol: string | null
  plate_no: string | null
  vehicle_type: string | null
  brand: string | null
  capacity_kg: number | null
  driver_name: string | null
  driver_phone: string | null
  is_active: boolean | null
  status: string | null
  notes: string | null
  vendor_id: number | null
}

export default function FleetEditPanel({ fleet, onClose, onSaved }: {
  fleet: Fleet | null
  onClose: () => void
  onSaved: () => void
}) {
  const getNo = (f: Fleet) => f.vehicle_no ?? f.nopol ?? f.plate_no ?? ''
  const [form, setForm] = useState(() => fleet ? {
    vehicle_no: getNo(fleet),
    vehicle_type: fleet.vehicle_type ?? '',
    brand: fleet.brand ?? '',
    // capacity_kg deprecated — mapped to notes
    capacity_kg: (fleet as any).notes ? null : null,
    driver_name: fleet.driver_name ?? '',
    driver_phone: fleet.driver_phone ?? '',
    is_active: fleet.is_active ?? (String(fleet.status).toLowerCase() === 'active'),
  } : {
    vehicle_no: '', vehicle_type: '', brand: '', capacity_kg: null as number | null, driver_name: '', driver_phone: '', is_active: true,
  })
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f:any) => ({ ...f, [k]: v }))

  function del() {
    if (!fleet) return
    if (!confirm(`HAPUS ARMADA ${getNo(fleet)}?`)) return
    startDeleting(async () => {
      const { error } = await supabase.from('transport_fleet').delete().eq('id', fleet.id)
      if (error) { setErr(error.message); return }
      onSaved(); onClose()
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload: any = {
        vendor_id: 1,
        vehicle_no: (form.vehicle_no as string).trim().toUpperCase(),
        vehicle_type: (form.vehicle_type as string).trim().toUpperCase() || null,
        driver_name: (form.driver_name as string).trim().toUpperCase() || null,
        driver_phone: (form.driver_phone as string).trim() || null,
        status: form.is_active ? 'aktif' : 'aktif',
        notes: (form.brand as string).trim().toUpperCase() || null,
      }
      if (!payload.vehicle_no) { setErr('NOPOL wajib diisi'); return }
      let error
      if (fleet) {
        const r = await supabase.from('transport_fleet').update(payload).eq('id', fleet.id)
        error = r.error
      } else {
        const r = await supabase.from('transport_fleet').insert(payload)
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
          <h3 className="text-lg font-bold uppercase">{fleet ? 'EDIT ARMADA' : 'TAMBAH ARMADA'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="NOPOL / VEHICLE NO *"><input value={form.vehicle_no} onChange={e=>up('vehicle_no', e.target.value)} className="inp font-mono" disabled={!!fleet} /></Field>
          <Field label="JENIS"><input value={form.vehicle_type} onChange={e=>up('vehicle_type', e.target.value)} className="inp" /></Field>
          <Field label="BRAND"><input value={form.brand} onChange={e=>up('brand', e.target.value)} className="inp" /></Field>
          <Field label="KAPASITAS (KG)"><input type="number" value={form.capacity_kg ?? ''} onChange={e=>up('capacity_kg', e.target.value === '' ? null : Number(e.target.value))} className="inp" /></Field>
          <Field label="DRIVER"><input value={form.driver_name} onChange={e=>up('driver_name', e.target.value)} className="inp" /></Field>
          <Field label="DRIVER PHONE"><input value={form.driver_phone} onChange={e=>up('driver_phone', e.target.value)} className="inp" /></Field>
          <Field label="ACTIVE"><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!form.is_active} onChange={e=>up('is_active', e.target.checked)} /><span className="text-sm">AKTIF</span></label></Field>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>{fleet && <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">{deleting ? 'MENGHAPUS…' : 'HAPUS'}</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.vehicle_no} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'MENYIMPAN…' : 'SIMPAN'}</button>
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
