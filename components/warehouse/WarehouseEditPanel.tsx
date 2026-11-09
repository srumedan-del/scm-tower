'use client'
import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Warehouse } from 'lucide-react'
import { useState, useTransition } from 'react'
import { upsertWarehouse, deleteWarehouse } from '@/app/(app)/master-data/warehouses/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

type Wh = {
  id: number
  warehouse_code: string
  warehouse_name: string
  city: string | null
  address: string | null
  is_active: boolean
}

export default function WarehouseEditPanel({ wh, onClose, onSaved }: {
  wh: Wh | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => wh ? {
    warehouse_code: wh.warehouse_code ?? '',
    warehouse_name: wh.warehouse_name ?? '',
    city: wh.city ?? '',
    address: wh.address ?? '',
    is_active: wh.is_active ?? true,
  } : {
    warehouse_code: '', warehouse_name: '', city: '', address: '', is_active: true,
  })
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f:any) => ({ ...f, [k]: v }))

  async function del() {
    if (!wh) return
    if (!(await confirmAction({ title: 'Hapus gudang?', message: `Gudang ${wh.warehouse_code} akan dihapus.` }))) return
    startDeleting(async () => {
      try {
        await deleteWarehouse(wh.id)
        onClose(); void showSuccess({ title: 'Gudang dihapus' }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload: any = {
        warehouse_code: (form.warehouse_code as string).trim().toUpperCase(),
        warehouse_name: (form.warehouse_name as string).trim().toUpperCase() || null,
        city: (form.city as string).trim().toUpperCase() || null,
        address: (form.address as string).trim().toUpperCase() || null,
        is_active: !!form.is_active,
      }
      if (!payload.warehouse_code) { setErr('CODE wajib diisi'); return }
      try {
        await upsertWarehouse(payload, wh?.id)
        onClose(); void showSuccess({ title: 'Gudang tersimpan', message: form.warehouse_code }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="xl">
      <DialogHeader title={wh ? 'Edit Gudang' : 'Tambah Gudang'} subtitle={wh ? wh.warehouse_code : 'Daftarkan gudang baru'} icon={Warehouse} />
        <div className={dialogBodyClass}>
          <Field label="Code *"><input value={form.warehouse_code} onChange={e=>up('warehouse_code', e.target.value)} className="inp font-mono" disabled={!!wh} /></Field>
          <Field label="Nama *"><input value={form.warehouse_name} onChange={e=>up('warehouse_name', e.target.value)} className="inp" /></Field>
          <Field label="City"><input value={form.city} onChange={e=>up('city', e.target.value)} className="inp" /></Field>
          <Field label="Address"><textarea value={form.address} onChange={e=>up('address', e.target.value)} className="inp" rows={2} /></Field>
          <Field label="Active"><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!form.is_active} onChange={e=>up('is_active', e.target.checked)} /><span className="text-sm">AKTIF</span></label></Field>
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
        <div className={dialogFooterClass}>
          <div>{wh && <button onClick={del} disabled={deleting} className={dialogDangerClass}>{deleting ? 'Menghapus…' : 'Hapus'}</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving || !form.warehouse_code} className={dialogPrimaryClass}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </div>
    </DialogShell>
  )
}
