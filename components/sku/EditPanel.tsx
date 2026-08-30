'use client'

import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'

type Sku = {
  id: number
  sku_code: string
  item_name: string
  category: string | null
  group: string | null
  uom: string
  safety_stock: number | null
  is_active: boolean
}

const empty: Omit<Sku, 'id'> = {
  sku_code: '', item_name: '', category: '', group: '', uom: 'PCS', safety_stock: null, is_active: true,
}

type FormState = {
  sku_code: string
  item_name: string
  category: string
  group: string
  uom: string
  safety_stock: number | null
  is_active: boolean
}

export default function SkuEditPanel({ sku, onClose, onSaved }: {
  sku: Sku | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<Sku, 'id'>>(() => {
    if (sku) {
      return {
        sku_code: sku.sku_code,
        item_name: sku.item_name,
        category: sku.category ?? '',
        group: sku.group ?? '',
        uom: sku.uom,
        safety_stock: sku.safety_stock,
        is_active: sku.is_active,
      }
    }
    return { ...empty, category: '', group: '' }
  })
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  function del() {
    if (!sku) return
    if (!confirm(`HAPUS SKU ${sku.sku_code} — ${sku.item_name}?`)) return
    startDeleting(async () => {
      const { error } = await supabase.from('master_sku').delete().eq('id', sku.id)
      if (error) { setErr(error.message); return }
      onSaved(); onClose()
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload = {
        sku_code: form.sku_code.trim().toUpperCase(),
        item_name: form.item_name.trim().toUpperCase(),
        category: (form.category || '').trim().toUpperCase() || null,
        group: (form.group || '').trim().toUpperCase() || null,
        uom: form.uom.trim().toUpperCase(),
        safety_stock: form.safety_stock === null || Number.isNaN(Number(form.safety_stock)) ? null : Number(form.safety_stock),
        is_active: form.is_active,
      }
      let error
      if (sku) {
        const r = await supabase.from('master_sku').update(payload).eq('id', sku.id)
        error = r.error
      } else {
        const r = await supabase.from('master_sku').insert(payload)
        error = r.error
      }

      // Fallback: kalau error karena kolom 'group' belum ada, retry tanpa field group
      if (error && /column.*group.*does not exist/i.test(error.message)) {
        const payloadNoGroup = { ...payload }
        delete (payloadNoGroup as any).group
        const r2 = sku
          ? await supabase.from('master_sku').update(payloadNoGroup).eq('id', sku.id)
          : await supabase.from('master_sku').insert(payloadNoGroup)
        if (!r2.error) {
          setErr('Note: kolom "group" belum ada di tabel. Field ini sementara di-skip. Jalankan scripts/add_group_to_master_sku.sql di Supabase SQL Editor.')
          onSaved()
          return
        }
        error = r2.error
      }

      if (error) { setErr(error.message); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-lg font-bold uppercase">{sku ? 'EDIT SKU' : 'NEW SKU'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="SKU CODE *">
            <input value={form.sku_code} onChange={e=>up('sku_code', e.target.value)} className="inp" placeholder="AVF1625-HC-N" disabled={!!sku}/>
          </Field>
          <Field label="ITEM NAME *">
            <input value={form.item_name} onChange={e=>up('item_name', e.target.value)} className="inp"/>
          </Field>
          <Field label="CATEGORY">
            <input value={form.category || ''} onChange={e=>up('category', e.target.value)} className="inp" placeholder="AV-FISTULA"/>
          </Field>
          <Field label="GROUP">
            <select value={form.group || ''} onChange={e=>up('group', e.target.value)} className="inp">
              <option value="">— NONE —</option>
              <option value="HD">HD</option>
              <option value="NHD">NHD</option>
            </select>
          </Field>
          <Field label="UOM *">
            <input value={form.uom} onChange={e=>up('uom', e.target.value)} className="inp" placeholder="PCS"/>
          </Field>
          <Field label="SAFETY STOCK">
            <input type="number" value={form.safety_stock ?? ''} onChange={e=>up('safety_stock', e.target.value === '' ? null : Number(e.target.value))} className="inp"/>
          </Field>
          <Field label="ACTIVE">
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={form.is_active} onChange={e=>up('is_active', e.target.checked)} />
              <span className="text-sm">SKU aktif dipakai</span>
            </label>
          </Field>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50">
          <div>
            {sku && (
              <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'MENGHAPUS…' : 'HAPUS'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.sku_code || !form.item_name}
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
  return <label className="block"><span className="text-xs text-gray-600 mb-1 block">{label}</span>{children}</label>
}