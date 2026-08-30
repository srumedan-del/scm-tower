'use client'

import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

type Vendor = {
  id: number
  vendor_code: string
  vendor_name: string
  vendor_type: string | null
  pic_name: string | null
  phone: string | null
  email: string | null
  coverage_area: string | null
  default_sla: number | null
  is_active: boolean | null
}

const empty: Omit<Vendor, 'id' | 'created_at'> & { created_at?: string | null } = {
  vendor_code: '', vendor_name: '', vendor_type: 'TRUCKING', pic_name: '', phone: '', email: '', coverage_area: '', default_sla: null, is_active: true,
}

export default function VendorEditPanel({ vendor, onClose, onSaved }: {
  vendor: Vendor | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<Vendor, 'id' | 'created_at'>>(() => {
    if (vendor) {
      return {
        vendor_code: vendor.vendor_code ?? '',
        vendor_name: vendor.vendor_name ?? '',
        vendor_type: vendor.vendor_type ?? 'TRUCKING',
        pic_name: vendor.pic_name ?? '',
        phone: vendor.phone ?? '',
        email: vendor.email ?? '',
        coverage_area: vendor.coverage_area ?? '',
        default_sla: vendor.default_sla,
        is_active: vendor.is_active ?? true,
      }
    }
    return { ...empty }
  })
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  function del() {
    if (!vendor) return
    if (!confirm(`HAPUS VENDOR ${vendor.vendor_code}?`)) return
    startDeleting(async () => {
      const { error } = await supabase.from('vendors').delete().eq('id', vendor.id)
      if (error) { setErr(error.message); return }
      onSaved(); onClose()
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload: any = {
        vendor_code: form.vendor_code.trim().toUpperCase(),
        vendor_name: form.vendor_name.trim().toUpperCase() || null,
        vendor_type: form.vendor_type || null,
        pic_name: (form.pic_name ?? '').trim().toUpperCase() || null,
        phone: (form.phone ?? '').trim() || null,
        email: (form.email ?? '').trim().toLowerCase() || null,
        coverage_area: (form.coverage_area ?? '').trim().toUpperCase() || null,
        default_sla: form.default_sla == null || Number.isNaN(Number(form.default_sla)) ? null : Number(form.default_sla),
        is_active: !!form.is_active,
      }
      if (!payload.vendor_code) { setErr('KODE VENDOR wajib diisi'); return }
      if (!payload.vendor_name) { setErr('NAMA VENDOR wajib diisi'); return }
      let error
      if (vendor) {
        const r = await supabase.from('vendors').update(payload).eq('id', vendor.id)
        error = r.error
      } else {
        const r = await supabase.from('vendors').insert(payload)
        error = r.error
      }
      if (error) { setErr(error.message); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <h3 className="text-lg font-bold uppercase">{vendor ? 'EDIT VENDOR' : 'TAMBAH VENDOR'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="KODE VENDOR *"><input value={form.vendor_code} onChange={e=>up('vendor_code', e.target.value)} className="inp font-mono" placeholder="VOTH001801" disabled={!!vendor} /></Field>
          <Field label="NAMA VENDOR *"><input value={form.vendor_name} onChange={e=>up('vendor_name', e.target.value)} className="inp" placeholder="PT. ..." /></Field>
          <Field label="TIPE">
            <select value={form.vendor_type ?? 'TRUCKING'} onChange={e=>up('vendor_type', e.target.value)} className="inp">
              <option value="TRUCKING">TRUCKING</option>
              <option value="COURIER">COURIER</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="RETAIL">RETAIL</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PIC NAME"><input value={form.pic_name ?? ''} onChange={e=>up('pic_name', e.target.value)} className="inp" /></Field>
            <Field label="PHONE"><input value={form.phone ?? ''} onChange={e=>up('phone', e.target.value)} className="inp" placeholder="+62 ..." /></Field>
          </div>
          <Field label="EMAIL"><input value={form.email ?? ''} onChange={e=>up('email', e.target.value)} className="inp" placeholder="PIC@EXAMPLE.COM" /></Field>
          <Field label="COVERAGE AREA"><input value={form.coverage_area ?? ''} onChange={e=>up('coverage_area', e.target.value)} className="inp" placeholder="MEDAN, BANDA ACEH" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="DEFAULT SLA (HARI)"><input type="number" min={0} value={form.default_sla ?? ''} onChange={e=>up('default_sla', e.target.value === '' ? null : Number(e.target.value))} className="inp" placeholder="2" /></Field>
            <Field label="ACTIVE"><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!form.is_active} onChange={e=>up('is_active', e.target.checked)} /><span className="text-sm">AKTIF</span></label></Field>
          </div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>
            {vendor && (
              <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'MENGHAPUS…' : 'HAPUS'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.vendor_code || !form.vendor_name}
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
