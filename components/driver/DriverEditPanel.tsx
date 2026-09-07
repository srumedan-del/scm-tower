'use client'

import { useState, useTransition } from 'react'
import { upsertDriver, deleteDriver, type DriverRow } from '@/app/(app)/master-data/drivers/actions'

const empty: Omit<DriverRow, 'id'> = {
  driver_code: '', driver_name: '', role: 'Driver',
  sim_no: null, phone: null, is_active: true, notes: null,
}

export default function DriverEditPanel({
  driver, onClose, onSaved,
}: {
  driver: DriverRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<DriverRow, 'id'>>(() =>
    driver ? {
      driver_code: driver.driver_code,
      driver_name: driver.driver_name,
      role:        driver.role ?? 'Driver',
      sim_no:      driver.sim_no ?? '',
      phone:       driver.phone  ?? '',
      is_active:   driver.is_active,
      notes:       driver.notes  ?? '',
    } : { ...empty, sim_no: '', phone: '', notes: '' }
  )
  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  function del() {
    if (!driver) return
    if (!confirm(`HAPUS ${driver.role ?? 'KRU'} ${driver.driver_name}?`)) return
    startDeleting(async () => {
      try { await deleteDriver(driver.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.driver_code.trim()) { setErr('Kode wajib diisi'); return }
      if (!form.driver_name.trim()) { setErr('Nama wajib diisi'); return }
      try {
        await upsertDriver({
          id:          driver?.id,
          driver_code: form.driver_code.trim().toUpperCase(),
          driver_name: form.driver_name.trim().toUpperCase(),
          role:        form.role,
          sim_no:      (form.sim_no as string)?.trim() || null,
          phone:       (form.phone  as string)?.trim() || null,
          is_active:   form.is_active,
          notes:       (form.notes  as string)?.trim() || null,
        })
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-bold text-lg uppercase">
            {driver ? `Edit ${driver.role ?? 'Kru'}` : 'Tambah Driver / Helper'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Role selector */}
          <Field label="ROLE *">
            <div className="flex gap-2 mt-1">
              {(['Driver', 'Helper'] as const).map(r => (
                <label key={r} className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 py-2 cursor-pointer transition-colors ${
                  form.role === r
                    ? r === 'Driver' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                                     : 'border-purple-500 bg-purple-50 text-purple-700 font-bold'
                    : 'border-gray-200 text-gray-500'
                }`}>
                  <input type="radio" name="role" value={r} checked={form.role === r}
                    onChange={() => up('role', r)} className="sr-only" />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="KODE *">
            <input value={form.driver_code} onChange={e => up('driver_code', e.target.value)}
              className="inp font-mono" placeholder={form.role === 'Driver' ? 'DRV-001' : 'HLP-001'} disabled={!!driver} />
          </Field>
          <Field label="NAMA *">
            <input value={form.driver_name} onChange={e => up('driver_name', e.target.value)}
              className="inp" placeholder="Nama lengkap" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={form.role === 'Driver' ? 'NO. SIM' : 'NO. SIM (opsional)'}>
              <input value={(form.sim_no as string) ?? ''} onChange={e => up('sim_no', e.target.value)}
                className="inp" placeholder={form.role === 'Driver' ? 'SIM A/B' : '-'} />
            </Field>
            <Field label="NO. HP">
              <input value={(form.phone as string) ?? ''} onChange={e => up('phone', e.target.value)}
                className="inp" placeholder="+62 ..." />
            </Field>
          </div>
          <Field label="CATATAN">
            <textarea value={(form.notes as string) ?? ''} onChange={e => up('notes', e.target.value)}
              className="inp" rows={2} placeholder="Opsional" />
          </Field>
          <Field label="STATUS">
            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked={!!form.is_active}
                onChange={e => up('is_active', e.target.checked)} />
              <span className="text-sm">Aktif</span>
            </label>
          </Field>
          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        <div className="flex justify-between border-t p-4 bg-gray-50">
          <div>
            {driver && (
              <button onClick={del} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#3b82f6}.inp:disabled{background:#f3f4f6;color:#6b7280}`}</style>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>{children}</label>
}
