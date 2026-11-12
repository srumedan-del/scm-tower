'use client'

import { useEffect, useState, useTransition } from 'react'
import { KeyRound, Plus, UserCog, UserPlus } from 'lucide-react'
import {
  DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass,
  formControlClass, FormField,
} from '@/components/ui/FormDialog'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { confirmAction, notify, showSuccess } from '@/lib/feedback'
import {
  createAppUser, listUsers, resetAppUserPassword, setAppUserActive, updateAppUserName, type AppUser,
} from './actions'

function formatDateTime(value: string | null) {
  if (!value) return 'Belum pernah'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

/** Password acak 10 karakter yang mudah diketik (tanpa huruf/angka yang mirip). */
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const values = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(values, value => chars[value % chars.length]).join('')
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, startLoading] = useTransition()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [resetting, setResetting] = useState<AppUser | null>(null)

  const load = () => startLoading(async () => {
    try { setUsers(await listUsers()) } catch (error: any) { notify.error('Tidak dapat memuat pengguna', error.message) }
  })
  useEffect(() => { load() }, [])

  async function toggleActive(user: AppUser) {
    const deactivate = user.active
    if (deactivate && !(await confirmAction({
      title: `Nonaktifkan ${user.full_name ?? user.email}?`,
      message: 'Pengguna ini tidak bisa login sampai diaktifkan kembali. Datanya tetap tersimpan.',
      confirmLabel: 'Nonaktifkan',
    }))) return
    try {
      await setAppUserActive(user.id, !deactivate)
      notify.success(deactivate ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan', user.email ?? undefined)
      load()
    } catch (error: any) {
      notify.error('Tidak dapat mengubah status', error.message)
    }
  }

  const activeCount = users.filter(user => user.active).length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Kelola Pengguna</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Pengguna
        </button>
      </header>

      <p className="text-sm text-slate-500">
        {activeCount} pengguna aktif dari {users.length}. Semua pengguna yang bisa login memiliki akses penuh ke SCM Tower.
      </p>

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Nama</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Login terakhir</th>
              <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !users.length && <SkeletonRows cols={5} rows={3} />}
            {users.map(user => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {user.full_name ?? <span className="font-normal text-slate-400">Tanpa nama</span>}
                  {user.is_me && <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">Anda</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(user.last_sign_in_at)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {user.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setEditing(user)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Ubah nama</button>
                    <button type="button" onClick={() => setResetting(user)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Reset password</button>
                    {!user.is_me && (
                      <button
                        type="button"
                        onClick={() => toggleActive(user)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${user.active ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                      >
                        {user.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <AddUserDialog onClose={() => setAdding(false)} onSaved={load} />}
      {editing && <EditNameDialog user={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  )
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <FormField label="Password awal" required hint="Minimal 8 karakter. Sampaikan ke pengguna secara langsung, bukan lewat grup.">
      <div className="flex gap-2">
        <input type="text" value={value} onChange={event => onChange(event.target.value)} className={`${formControlClass} font-mono`} autoComplete="new-password" />
        <button type="button" onClick={() => onChange(generatePassword())} className={`${dialogCancelClass} shrink-0`}>Buat acak</button>
      </div>
    </FormField>
  )
}

function AddUserDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  function save() {
    setError('')
    startSaving(async () => {
      try {
        await createAppUser({ full_name: fullName, email, password })
        onClose()
        void showSuccess({
          title: 'Pengguna ditambahkan',
          message: 'Pengguna bisa langsung login di SCM Tower.',
          details: [{ label: 'Nama', value: fullName.trim() }, { label: 'Email', value: email.trim().toLowerCase() }, { label: 'Password awal', value: password }],
        }).then(onSaved)
      } catch (caught: any) {
        setError(caught.message)
      }
    })
  }

  return (
    <DialogShell onClose={onClose} size="lg">
      <DialogHeader title="Tambah Pengguna" subtitle="Akun login web SCM Tower" icon={UserPlus} />
      <div className={dialogBodyClass}>
        <FormField label="Nama lengkap" required>
          <input data-autofocus value={fullName} onChange={event => setFullName(event.target.value)} className={formControlClass} placeholder="Nama sesuai identitas" />
        </FormField>
        <FormField label="Email" required>
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} className={formControlClass} placeholder="nama@perusahaan.com" autoComplete="off" />
        </FormField>
        <PasswordField value={password} onChange={setPassword} />
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      </div>
      <div className={dialogFooterClass}>
        <span />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button type="button" onClick={save} disabled={saving} data-busy={saving} className={dialogPrimaryClass}>
            {saving ? 'Menyimpan…' : 'Tambah Pengguna'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

function EditNameDialog({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  function save() {
    setError('')
    startSaving(async () => {
      try {
        await updateAppUserName(user.id, fullName)
        onClose()
        notify.success('Nama diperbarui', fullName.trim())
        onSaved()
      } catch (caught: any) {
        setError(caught.message)
      }
    })
  }

  return (
    <DialogShell onClose={onClose} size="md">
      <DialogHeader title="Ubah Nama" subtitle={user.email ?? undefined} icon={UserCog} />
      <div className={dialogBodyClass}>
        <FormField label="Nama lengkap" required>
          <input data-autofocus value={fullName} onChange={event => setFullName(event.target.value)} className={formControlClass} />
        </FormField>
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      </div>
      <div className={dialogFooterClass}>
        <span />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button type="button" onClick={save} disabled={saving} data-busy={saving} className={dialogPrimaryClass}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </DialogShell>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [password, setPassword] = useState(generatePassword)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  function save() {
    setError('')
    startSaving(async () => {
      try {
        await resetAppUserPassword(user.id, password)
        onClose()
        void showSuccess({
          title: 'Password direset',
          message: 'Sampaikan password baru ini ke pengguna secara langsung.',
          details: [{ label: 'Email', value: user.email ?? '-' }, { label: 'Password baru', value: password }],
        })
      } catch (caught: any) {
        setError(caught.message)
      }
    })
  }

  return (
    <DialogShell onClose={onClose} size="md">
      <DialogHeader title="Reset Password" subtitle={user.full_name ?? user.email ?? undefined} icon={KeyRound} />
      <div className={dialogBodyClass}>
        <PasswordField value={password} onChange={setPassword} />
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      </div>
      <div className={dialogFooterClass}>
        <span />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button type="button" onClick={save} disabled={saving} data-busy={saving} className={dialogPrimaryClass}>{saving ? 'Menyimpan…' : 'Reset Password'}</button>
        </div>
      </div>
    </DialogShell>
  )
}
