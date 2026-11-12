'use client'
import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Truck } from 'lucide-react'
import { useState, useTransition } from 'react'
import { upsertFleet, deleteFleet } from '@/app/(app)/master-data/vehicles/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

type Fleet = {
  id: number
  vehicle_no: string | null
  nopol: string | null
  plate_no: string | null
  vehicle_type: string | null
  capacity_kg: number | null
  capacity_cbm: number | null
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
    vehicle_no:   getNo(fleet),
    vehicle_type: fleet.vehicle_type ?? '',
    capacity_kg:  fleet.capacity_kg,
    capacity_cbm: fleet.capacity_cbm,
    driver_name:  fleet.driver_name ?? '',
    driver_phone: fleet.driver_phone ?? '',
    is_active:    fleet.is_active ?? (String(fleet.status).toLowerCase() === 'active'),
  } : {
    vehicle_no: '', vehicle_type: '',
    capacity_kg:  null as number | null,
    capacity_cbm: null as number | null,
    driver_name: '', driver_phone: '', is_active: true,
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  async function del() {
    if (!fleet) return
    if (!(await confirmAction({ title: 'Hapus armada?', message: `Armada ${getNo(fleet)} akan dihapus.` }))) return
    startDeleting(async () => {
      try { await deleteFleet(fleet.id); onClose(); void showSuccess({ title: 'Armada dihapus' }).then(onSaved) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload: any = {
        vendor_id:    1,
        vehicle_no:   (form.vehicle_no as string).trim().toUpperCase(),
        vehicle_type: (form.vehicle_type as string).trim().toUpperCase() || null,
        capacity_kg:  form.capacity_kg != null ? Number(form.capacity_kg) : null,
        capacity_cbm: form.capacity_cbm != null ? Number(form.capacity_cbm) : null,
        driver_name:  (form.driver_name as string).trim().toUpperCase() || null,
        driver_phone: (form.driver_phone as string).trim() || null,
        status:       form.is_active ? 'aktif' : 'nonaktif',
      }
      if (!payload.vehicle_no) { setErr('NOPOL wajib diisi'); return }
      try { await upsertFleet(payload, fleet?.id); onClose(); void showSuccess({ title: 'Armada tersimpan', message: form.vehicle_no }).then(onSaved) }
      catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title={fleet ? 'Edit Armada' : 'Tambah Armada'} subtitle={fleet ? getNo(fleet) : 'Daftarkan kendaraan baru'} icon={Truck} />
        <div className={dialogBodyClass}>
          <Field label="Nopol / vehicle no *">
            <input value={form.vehicle_no} onChange={e => up('vehicle_no', e.target.value)}
              className="inp font-mono" placeholder="BK 8510 GY" disabled={!!fleet} />
          </Field>
          <Field label="Jenis kendaraan">
            <input value={form.vehicle_type} onChange={e => up('vehicle_type', e.target.value)}
              className="inp" placeholder="CDD, CDE, Fuso, Tronton, Pickup..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tonase (ton)">
              <input type="number" step="0.1" min={0}
                value={form.capacity_kg ?? ''}
                onChange={e => up('capacity_kg', e.target.value === '' ? null : Number(e.target.value))}
                className="inp" placeholder="4" />
            </Field>
            <Field label="Volume (m³)">
              <input type="number" step="0.1" min={0}
                value={form.capacity_cbm ?? ''}
                onChange={e => up('capacity_cbm', e.target.value === '' ? null : Number(e.target.value))}
                className="inp" placeholder="15" />
            </Field>
          </div>
          <Field label="Driver">
            <input value={form.driver_name} onChange={e => up('driver_name', e.target.value)}
              className="inp" placeholder="Nama driver" />
          </Field>
          <Field label="Driver phone">
            <input value={form.driver_phone} onChange={e => up('driver_phone', e.target.value)}
              className="inp" placeholder="+62 ..." />
          </Field>
          <Field label="Active">
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={!!form.is_active} onChange={e => up('is_active', e.target.checked)} />
              <span className="text-sm">AKTIF</span>
            </label>
          </Field>
          {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        </div>
        <div className={dialogFooterClass}>
          <div>
            {fleet && (
              <button onClick={del} disabled={deleting}
                className={dialogDangerClass}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving || !form.vehicle_no}
              className={dialogPrimaryClass} data-busy={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
    </DialogShell>
  )
}
