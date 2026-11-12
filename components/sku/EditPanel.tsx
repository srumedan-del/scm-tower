'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Package } from 'lucide-react'
import { useState, useTransition } from 'react'
import { upsertSku, deleteSku } from '@/app/(app)/master-data/sku/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

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

  async function del() {
    if (!sku) return
    if (!(await confirmAction({ title: 'Hapus SKU?', message: `SKU ${sku.sku_code} — ${sku.item_name} akan dihapus.` }))) return
    startDeleting(async () => {
      try {
        await deleteSku(sku.id)
        onClose(); void showSuccess({ title: 'SKU dihapus' }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
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

      try {
        await upsertSku(payload, sku?.id)
      } catch (e: any) {
        // Fallback: kalau error karena kolom 'group' belum ada, retry tanpa field group
        if (/column.*group.*does not exist/i.test(e.message)) {
          const payloadNoGroup = { ...payload }
          delete (payloadNoGroup as any).group
          try {
            await upsertSku(payloadNoGroup, sku?.id)
            setErr('Note: kolom "group" belum ada di tabel. Field ini sementara di-skip. Jalankan scripts/add_group_to_master_sku.sql di Supabase SQL Editor.')
            onSaved()
            return
          } catch (e2: any) {
            setErr(e2.message)
            return
          }
        }
        setErr(e.message)
        return
      }

      onClose(); void showSuccess({ title: 'SKU tersimpan', message: form.item_name }).then(onSaved)
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title={sku ? 'Edit SKU' : 'Tambah SKU'} subtitle={sku ? sku.sku_code : 'Daftarkan produk baru'} icon={Package} />
        <div className={dialogBodyClass}>
          <Field label="SKU code *">
            <input value={form.sku_code} onChange={e=>up('sku_code', e.target.value)} className="inp" placeholder="AVF1625-HC-N" disabled={!!sku}/>
          </Field>
          <Field label="Item name *">
            <input value={form.item_name} onChange={e=>up('item_name', e.target.value)} className="inp"/>
          </Field>
          <Field label="Category">
            <input value={form.category || ''} onChange={e=>up('category', e.target.value)} className="inp" placeholder="AV-FISTULA"/>
          </Field>
          <Field label="Group">
            <select value={form.group || ''} onChange={e=>up('group', e.target.value)} className="inp">
              <option value="">— NONE —</option>
              <option value="HD">HD</option>
              <option value="NHD">NHD</option>
            </select>
          </Field>
          <Field label="UOM *">
            <input value={form.uom} onChange={e=>up('uom', e.target.value)} className="inp" placeholder="PCS"/>
          </Field>
          <Field label="Safety stock">
            <input type="number" value={form.safety_stock ?? ''} onChange={e=>up('safety_stock', e.target.value === '' ? null : Number(e.target.value))} className="inp"/>
          </Field>
          <Field label="Active">
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={form.is_active} onChange={e=>up('is_active', e.target.checked)} />
              <span className="text-sm">SKU aktif dipakai</span>
            </label>
          </Field>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className={dialogFooterClass}>
          <div>
            {sku && (
              <button onClick={del} disabled={deleting} className={dialogDangerClass}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving || !form.sku_code || !form.item_name}
              className={dialogPrimaryClass} data-busy={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
    </DialogShell>
  )
}
