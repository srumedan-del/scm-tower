'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { useEffect, useState, useTransition } from 'react'
import { upsertDriver, deleteDriver, getNextDriverCode, type DriverRow } from '@/app/(app)/master-data/drivers/actions'
import { Sparkles, RefreshCw, KeyRound, Smartphone, UserRound } from 'lucide-react'
import { confirmAction, showSuccess } from '@/lib/feedback'

const empty: Omit<DriverRow, 'id'> = {
  driver_code: '', driver_name: '', role: 'Driver',
  sim_no: null, phone: null, is_active: true, notes: null,
  username: '', pin: '',
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
      username:    driver.username ?? driver.driver_code?.toLowerCase() ?? '',
      pin:         '',
    } : { ...empty, sim_no: '', phone: '', notes: '' }
  )
  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [generatingCode, setGeneratingCode] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const up = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Auto-numbering on modal mount for new driver/helper
  useEffect(() => {
    if (!driver && !form.driver_code) {
      loadNextCode(form.role)
    }
  }, [driver])

  async function loadNextCode(role: 'Driver' | 'Helper') {
    try {
      setGeneratingCode(true)
      const nextCode = await getNextDriverCode(role)
      setForm(f => ({
        ...f,
        role,
        driver_code: nextCode,
        username: f.username || nextCode.toLowerCase(),
      }))
    } catch (e: any) {
      console.error('Error generating driver code:', e)
    } finally {
      setGeneratingCode(false)
    }
  }

  function handleRoleChange(newRole: 'Driver' | 'Helper') {
    if (driver) {
      up('role', newRole)
    } else {
      loadNextCode(newRole)
    }
  }

  async function del() {
    if (!driver) return
    if (!(await confirmAction({ title: 'Hapus kru?', message: `${driver.role ?? 'Kru'} ${driver.driver_name} akan dihapus dari master data.` }))) return
    startDeleting(async () => {
      try { await deleteDriver(driver.id); onClose(); void showSuccess({ title: 'Data kru dihapus', message: driver.driver_name }).then(onSaved) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const code = form.driver_code.trim()
      const name = form.driver_name.trim()
      if (!code) { setErr('Kode wajib diisi'); return }
      if (!name) { setErr('Nama wajib diisi'); return }
      try {
        await upsertDriver({
          id:          driver?.id,
          driver_code: code.toUpperCase(),
          driver_name: name.toUpperCase(),
          role:        form.role,
          sim_no:      (form.sim_no as string)?.trim() || null,
          phone:       (form.phone  as string)?.trim() || null,
          is_active:   form.is_active,
          notes:       (form.notes  as string)?.trim() || null,
          username:    (form.username as string)?.trim() || code.toLowerCase(),
          pin:         (form.pin as string)?.trim() || null,
        })
        onClose(); void showSuccess({ title: 'Data kru tersimpan', details: [{ label: 'Kode', value: code.toUpperCase() }, { label: 'Nama', value: name.toUpperCase() }] }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader
        title={driver ? `Edit ${driver.role ?? 'Kru'}` : 'Tambah Driver / Helper'}
        subtitle={driver ? `Perbarui data untuk kode ${driver.driver_code}` : 'Sistem otomatis mengalokasikan nomor kode berikutnya (DRV / HLP)'}
        icon={UserRound}
      />

        <div className={dialogBodyClass}>
          {/* Role selector */}
          <Field label="Role *">
            <div className="mt-1 flex gap-3">
              {(['Driver', 'Helper'] as const).map(r => (
                <label key={r} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 cursor-pointer transition-all ${
                  form.role === r
                    ? r === 'Driver' ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold shadow-xs'
                                     : 'border-purple-600 bg-purple-50/70 text-purple-700 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={form.role === r}
                    onChange={() => handleRoleChange(r)}
                    className="sr-only"
                  />
                  <span>{r === 'Driver' ? '🚗 Driver' : '👥 Helper'}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* Kode & Nama */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kode kru *">
              <div className="relative mt-1">
                <input
                  type="text"
                  value={form.driver_code}
                  onChange={e => {
                    const c = e.target.value.toUpperCase()
                    up('driver_code', c)
                    if (!form.username) up('username', c.toLowerCase())
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 font-mono text-sm font-bold uppercase text-slate-800 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="DRV-001"
                />
                {!driver && (
                  <button
                    type="button"
                    onClick={() => loadNextCode(form.role)}
                    disabled={generatingCode}
                    title="Generate ulang kode berikutnya"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${generatingCode ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>
                )}
              </div>
            </Field>

            <Field label="Nama lengkap *">
              <input
                type="text"
                value={form.driver_name}
                onChange={e => up('driver_name', e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold uppercase text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="CONTOH: AHMAD SUBARKAH"
              />
            </Field>
          </div>

          {/* Akun Login APK Driver (Khusus Android) */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Akun Login APK Driver (Android)
                </span>
              </div>
              <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                Kredensial SCM Driver
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Username login">
                <input
                  type="text"
                  value={(form.username as string) ?? ''}
                  onChange={e => up('username', e.target.value.toLowerCase().trim())}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder={form.driver_code ? form.driver_code.toLowerCase() : 'drv-001'}
                />
              </Field>

              <Field label={driver ? 'PIN BARU (KOSONGKAN JIKA TETAP)' : 'PIN KEAMANAN (6 ANGKA)'}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={(form.pin as string) ?? ''}
                  onChange={e => up('pin', e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm tracking-widest font-mono text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="••••••"
                />
              </Field>
            </div>
            <p className="text-[11px] text-indigo-600/80">
              Driver memasukkan Username dan PIN ini untuk masuk ke aplikasi di smartphone. Jika PIN dikosongkan, driver diminta membuat PIN sendiri saat login pertama.
            </p>
          </div>

          {/* SIM & HP */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="No. sim (opsional)">
              <input
                type="text"
                value={(form.sim_no as string) ?? ''}
                onChange={e => up('sim_no', e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm uppercase text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="SIM B1 / B2 UMUM"
              />
            </Field>

            <Field label="No. telepon / wa (opsional)">
              <input
                type="text"
                value={(form.phone as string) ?? ''}
                onChange={e => up('phone', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="+62 8..."
              />
            </Field>
          </div>

          <Field label="Catatan">
            <textarea
              value={(form.notes as string) ?? ''}
              onChange={e => up('notes', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              rows={2}
              placeholder="Catatan tambahan (opsional)"
            />
          </Field>

          <Field label="Status">
            <label className="mt-1 inline-flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={e => up('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Aktif</span>
            </label>
          </Field>

          {err && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
              {err}
            </p>
          )}
        </div>

        <div className={dialogFooterClass}>
          <div>
            {driver && (
              <button
                onClick={del}
                disabled={deleting}
                className={dialogDangerClass}
              >
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className={dialogCancelClass}
            >
              Batal
            </button>
            <button
              onClick={save}
              disabled={saving || generatingCode}
              className={dialogPrimaryClass}
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
    </DialogShell>
  )
}
