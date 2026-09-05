'use client'

import { useState, useTransition } from 'react'
import {
  upsertTransporter, deleteTransporter, type TransporterRow,
} from '@/app/(app)/master-data/transporters/actions'

const empty: Omit<TransporterRow, 'id'> = {
  transporter_code: '', name: '', type: 'Eksternal',
  service_model: 'Retail', pic_name: null, pic_phone: null,
  pic_email: null, is_active: true, notes: null,
}

export default function TransporterEditPanel({
  transporter, onClose, onSaved,
}: {
  transporter: TransporterRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<TransporterRow, 'id'>>(() =>
    transporter ? {
      transporter_code: transporter.transporter_code,
      name:             transporter.name,
      type:             transporter.type,
      service_model:    transporter.service_model,
      pic_name:         transporter.pic_name  ?? '',
      pic_phone:        transporter.pic_phone ?? '',
      pic_email:        transporter.pic_email ?? '',
      is_active:        transporter.is_active,
      notes:            transporter.notes     ?? '',
    } : { ...empty, pic_name: '', pic_phone: '', pic_email: '', notes: '' }
  )
  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  function del() {
    if (!transporter) return
    if (!confirm(`HAPUS TRANSPORTER ${transporter.name}?`)) return
    startDeleting(async () => {
      try { await deleteTransporter(transporter.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.transporter_code.trim()) { setErr('Kode transporter wajib diisi'); return }
      if (!form.name.trim()) { setErr('Nama transporter wajib diisi'); return }
      try {
        await upsertTransporter({
          id:               transporter?.id,
          transporter_code: form.transporter_code.trim().toUpperCase(),
          name:             form.name.trim(),
          type:             form.type,
          service_model:    form.type === 'Internal' ? null : form.service_model,
          pic_name:         (form.pic_name  as string)?.trim() || null,
          pic_phone:        (form.pic_phone as string)?.trim() || null,
          pic_email:        (form.pic_email as string)?.trim().toLowerCase() || null,
          is_active:        form.is_active,
          notes:            (form.notes    as string)?.trim() || null,
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
            {transporter ? 'Edit Transporter' : 'Tambah Transporter'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="KODE *">
            <input value={form.transporter_code} onChange={e => up('transporter_code', e.target.value)}
              className="inp font-mono" placeholder="TRANS-EXT-001" disabled={!!transporter} />
          </Field>
          <Field label="NAMA TRANSPORTER *">
            <input value={form.name} onChange={e => up('name', e.target.value)}
              className="inp" placeholder="Nama perusahaan / armada" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TIPE">
              <select value={form.type} onChange={e => up('type', e.target.value)} className="inp">
                <option value="Internal">Internal</option>
                <option value="Eksternal">Eksternal</option>
              </select>
            </Field>
            <Field label="MODEL LAYANAN">
              <select
                value={form.type === 'Internal' ? '' : (form.service_model ?? 'Retail')}
                onChange={e => up('service_model', e.target.value || null)}
                disabled={form.type === 'Internal'}
                className="inp"
              >
                <option value="Retail">Retail (per kg/tujuan)</option>
                <option value="Trucking">Trucking (per trip/FTL)</option>
                {form.type === 'Internal' && <option value="">— Biaya operasional aktual —</option>}
              </select>
            </Field>
          </div>
          {form.type === 'Internal' && (
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded p-2">
              ℹ️ Internal: biaya dihitung dari biaya operasional aktual (BBM, gaji driver, maintenance), bukan per tarif rate card.
            </p>
          )}
          <Field label="PIC NAME">
            <input value={(form.pic_name as string) ?? ''} onChange={e => up('pic_name', e.target.value)}
              className="inp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PIC PHONE">
              <input value={(form.pic_phone as string) ?? ''} onChange={e => up('pic_phone', e.target.value)}
                className="inp" placeholder="+62 ..." />
            </Field>
            <Field label="PIC EMAIL">
              <input value={(form.pic_email as string) ?? ''} onChange={e => up('pic_email', e.target.value)}
                className="inp" placeholder="pic@..." />
            </Field>
          </div>
          <Field label="CATATAN">
            <textarea value={(form.notes as string) ?? ''} onChange={e => up('notes', e.target.value)}
              className="inp" rows={2} />
          </Field>
          <Field label="STATUS">
            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked={!!form.is_active} onChange={e => up('is_active', e.target.checked)} />
              <span className="text-sm">Aktif</span>
            </label>
          </Field>
          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        <div className="flex justify-between border-t p-4 bg-gray-50">
          <div>
            {transporter && (
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
