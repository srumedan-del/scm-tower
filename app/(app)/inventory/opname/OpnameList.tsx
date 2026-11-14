'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ClipboardList, FileUp, Settings2, Trash2 } from 'lucide-react'
import {
  DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, formControlClass, FormField,
} from '@/components/ui/FormDialog'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { confirmAction, notify, showSuccess } from '@/lib/feedback'
import { jakartaToday } from '@/lib/sla'
import { opnameDateParts, type OpnamePeriod } from '@/lib/stock-opname'
import {
  createOpnameFromRows, createOpnameFromSnapshot, deleteOpnameSession, getLatestSirupSnapshot, getOpnameSettings, listOpnameSessions, saveOpnameSettings,
  type OpnameSession, type OpnameSettings, type SirupSnapshot,
} from './actions'

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  'Sedang dihitung': 'bg-amber-100 text-amber-800',
  Selesai: 'bg-green-100 text-green-700',
  Diverifikasi: 'bg-indigo-100 text-indigo-700',
}

export function OpnameList({ period }: { period: OpnamePeriod }) {
  const [sessions, setSessions] = useState<OpnameSession[]>([])
  const [loading, startLoading] = useTransition()
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)

  const load = () => startLoading(async () => {
    try { setSessions(await listOpnameSessions(period)); setError('') } catch (e: any) { setError(e.message) }
  })
  useEffect(() => { load() }, [period])

  async function remove(session: OpnameSession) {
    if (!(await confirmAction({ title: `Hapus opname ${opnameDateParts(session.opname_date).long}?`, message: 'Semua baris dan hasil hitung sesi ini ikut terhapus.' }))) return
    try { await deleteOpnameSession(session.id); notify.success('Sesi opname dihapus'); load() } catch (e: any) { notify.error('Gagal menghapus', e.message) }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Stock Opname {period}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditingSettings(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Settings2 className="h-4 w-4" aria-hidden="true" /> Penandatangan
          </button>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
            <FileUp className="h-4 w-4" aria-hidden="true" /> Buat Opname
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Tanggal opname</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Sumber</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Lines</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Sudah dihitung</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Selisih</th>
              <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !sessions.length && <SkeletonRows cols={7} rows={3} />}
            {!loading && !sessions.length && !error && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                Belum ada sesi opname {period.toLowerCase()}. Tekan <b>Buat Opname</b> untuk membuat sesi dari snapshot stok SIRUP atau file Export Excel.
              </td></tr>
            )}
            {sessions.map(session => {
              const date = opnameDateParts(session.opname_date)
              return (
                <tr key={session.id}>
                  <td className="px-4 py-3">
                    <Link href={`/inventory/opname/${session.id}`} className="font-semibold text-indigo-900 hover:underline">{date.day}, {date.long}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{session.source === 'sirup' ? 'Otomatis dari SIRUP' : 'Upload Excel'}</td>
                  <td className="px-4 py-3 text-right font-mono">{session.line_count ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono">{session.counted_count ?? 0}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${session.diff_count ? 'text-red-700' : 'text-slate-500'}`}>{session.diff_count ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[session.status] ?? STATUS_STYLE.Draft}`}>{session.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/inventory/opname/${session.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Buka</Link>
                      <button type="button" onClick={() => remove(session)} aria-label="Hapus sesi" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && <CreateOpnameDialog period={period} onClose={() => setCreating(false)} onCreated={load} />}
      {editingSettings && <SettingsDialog onClose={() => setEditingSettings(false)} />}
    </div>
  )
}

function CreateOpnameDialog({ period, onClose, onCreated }: { period: OpnamePeriod; onClose: () => void; onCreated: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [date, setDate] = useState(jakartaToday())
  const [pic, setPic] = useState('')
  const [source, setSource] = useState<'snapshot' | 'upload'>('snapshot')
  const [snapshot, setSnapshot] = useState<SirupSnapshot | null | undefined>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    void getOpnameSettings().then(s => setPic(current => current || s.default_pic || '')).catch(() => {})
    void getLatestSirupSnapshot().then(latest => { setSnapshot(latest); if (!latest) setSource('upload') }).catch(() => { setSnapshot(null); setSource('upload') })
  }, [])

  const snapshotLabel = snapshot
    ? new Date(snapshot.taken_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
  const snapshotOld = snapshot ? snapshot.snapshot_date !== jakartaToday() : false

  function save() {
    setError('')
    if (source === 'snapshot' && !snapshot) { setError('Belum ada snapshot SIRUP. Pilih Upload file.'); return }
    if (source === 'upload' && !file) { setError('Pilih file Export to Excel dari SIRUP.'); return }
    startSaving(async () => {
      try {
        let result
        if (source === 'snapshot') {
          result = await createOpnameFromSnapshot({ snapshot_id: snapshot!.id, period, opname_date: date, pic })
        } else {
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(await file!.arrayBuffer(), { type: 'array', cellDates: false })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
          result = await createOpnameFromRows({ rows, period, opname_date: date, pic, source: 'upload', source_note: file!.name })
        }
        onClose()
        void showSuccess({
          title: `Sesi opname ${period.toLowerCase()} dibuat`,
          message: 'Cetak lembar hitung untuk dibawa ke gudang, lalu isi Qty Fisik di halaman sesi.',
          details: [{ label: 'Tanggal', value: opnameDateParts(date).long }, { label: 'Lines opname', value: String(result.lineCount) }, { label: 'Baris SIRUP', value: String(result.totalRows) }],
          actionLabel: 'Buka sesi',
        }).then(() => { onCreated(); window.location.href = `/inventory/opname/${result.id}` })
      } catch (e: any) {
        setError(e.message ?? 'Sesi opname gagal dibuat')
      }
    })
  }

  const option = (value: 'snapshot' | 'upload', title: string, detail: string, disabled = false) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 text-sm ${source === value ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input type="radio" name="opname-source" checked={source === value} disabled={disabled} onChange={() => setSource(value)} className="mt-1" />
      <span><b className="block text-slate-800">{title}</b><span className="text-slate-600">{detail}</span></span>
    </label>
  )

  return (
    <DialogShell onClose={onClose} size="lg">
      <DialogHeader title={`Buat Opname ${period}`} subtitle={period === 'Bulanan' ? 'Semua item di semua bin MDN-PAR, dikelompokkan per bin' : 'Hollow Fiber/Dialyzer dan Blood Tubing Set di bincode MDN-PAR-CON'} icon={ClipboardList} />
      <div className={dialogBodyClass}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tanggal opname" required>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={formControlClass} />
          </FormField>
          <FormField label="PIC penghitung">
            <input value={pic} onChange={e => setPic(e.target.value)} className={formControlClass} placeholder="Abdi & Ngadimin" />
          </FormField>
        </div>
        <FormField label="Sumber data stok" required>
          <div className="grid gap-2">
            {option('snapshot', 'Snapshot SIRUP terbaru',
              snapshot === undefined ? 'Memeriksa snapshot…'
                : snapshot ? `Diambil ${snapshotLabel}, ${period === 'Bulanan' ? snapshot.total_rows : snapshot.line_count} lines${snapshotOld ? '. Bukan snapshot hari ini.' : ''}`
                : 'Belum ada snapshot. Snapshot diambil otomatis pukul 07.00 di hari kerja.',
              !snapshot)}
            {option('upload', 'Upload file Export Excel', 'Dari SIRUP Stok Gudang: CAB01-MDN, MDN-PAR, Kategori All, Filter, lalu Export to Excel.')}
          </div>
        </FormField>
        {source === 'upload' && (
          <FormField label="File Export SIRUP" required>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} className={dialogCancelClass}>Pilih file</button>
              <span className="truncate text-sm text-slate-600">{file?.name ?? 'Belum ada file'}</span>
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.html,.htm" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </FormField>
        )}
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      </div>
      <div className={dialogFooterClass}>
        <span />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button type="button" onClick={save} disabled={saving} data-busy={saving} className={dialogPrimaryClass}>{saving ? 'Memproses…' : 'Buat Opname'}</button>
        </div>
      </div>
    </DialogShell>
  )
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<OpnameSettings | null>(null)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const LABELS = ['Dibuat oleh', 'Diperiksa oleh 1', 'Diperiksa oleh 2', 'Diperiksa oleh 3', 'Diperiksa oleh 4']

  useEffect(() => {
    void getOpnameSettings().then(s => setSettings({ ...s, signers: Array.from({ length: 5 }, (_, i) => s.signers[i] ?? { name: '', title: '' }) })).catch(e => setError(e.message))
  }, [])

  function save() {
    if (!settings) return
    startSaving(async () => {
      try { await saveOpnameSettings(settings); onClose(); notify.success('Penandatangan disimpan') } catch (e: any) { setError(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="xl">
      <DialogHeader title="Penandatangan Berita Acara" subtitle="F-SRU-SCMWHL-37 Selisih Stock Opname" icon={Settings2} />
      <div className={dialogBodyClass}>
        {!settings && !error && <p className="text-sm text-slate-500">Memuat…</p>}
        {settings && (
          <>
            {settings.signers.map((signer, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <FormField label={LABELS[i]}>
                  <input value={signer.name} onChange={e => setSettings({ ...settings, signers: settings.signers.map((s, j) => j === i ? { ...s, name: e.target.value } : s) })} className={formControlClass} />
                </FormField>
                <FormField label="Bagian">
                  <input value={signer.title} onChange={e => setSettings({ ...settings, signers: settings.signers.map((s, j) => j === i ? { ...s, title: e.target.value } : s) })} className={formControlClass} placeholder="SCM" />
                </FormField>
              </div>
            ))}
            <FormField label="PIC penghitung default">
              <input value={settings.default_pic ?? ''} onChange={e => setSettings({ ...settings, default_pic: e.target.value })} className={formControlClass} />
            </FormField>
          </>
        )}
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      </div>
      <div className={dialogFooterClass}>
        <span />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
          <button type="button" onClick={save} disabled={saving || !settings} data-busy={saving} className={dialogPrimaryClass}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </DialogShell>
  )
}

