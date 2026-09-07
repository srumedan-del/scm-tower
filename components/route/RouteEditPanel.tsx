'use client'
import { useState, useTransition } from 'react'
import { upsertRoute, deleteRoute } from '@/app/(app)/master-data/routes/actions'

type Route = {
  id: number
  route_code: string
  origin: string
  destination: string
  city: string | null
  standard_lead_time_hours: number | null
  notes: string | null
}

export default function RouteEditPanel({ route, onClose, onSaved }: {
  route: Route | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => route ? {
    route_code:                route.route_code   ?? '',
    origin:                    route.origin       ?? '',
    destination:               route.destination  ?? '',
    standard_lead_time_hours:  route.standard_lead_time_hours,
    notes:                     route.notes        ?? '',
  } : {
    route_code: '', origin: 'SRU MEDAN', destination: '',
    standard_lead_time_hours: 24 as number | null, notes: '',
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function del() {
    if (!route) return
    if (!confirm(`HAPUS RUTE ${route.route_code}?`)) return
    startDeleting(async () => {
      try { await deleteRoute(route.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const payload = {
        route_code:               (form.route_code  as string).trim().toUpperCase(),
        origin:                   (form.origin      as string).trim().toUpperCase() || 'SRU MEDAN',
        destination:              (form.destination as string).trim().toUpperCase(),
        city:                     (form.destination as string).trim().toUpperCase() || null,
        standard_lead_time_hours: form.standard_lead_time_hours == null
                                    ? null : Number(form.standard_lead_time_hours),
        notes:                    (form.notes as string).trim().toUpperCase() || null,
      }
      if (!payload.route_code)  { setErr('ROUTE CODE wajib diisi');  return }
      if (!payload.destination) { setErr('DESTINATION wajib diisi'); return }
      try { await upsertRoute(payload, route?.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <h3 className="text-lg font-bold uppercase">{route ? 'EDIT RUTE' : 'TAMBAH RUTE'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="ROUTE CODE *">
            <input value={form.route_code} onChange={e => up('route_code', e.target.value)}
              className="inp font-mono" placeholder="MDN-L-0001" disabled={!!route} />
          </Field>
          <Field label="ORIGIN">
            <input value={form.origin} onChange={e => up('origin', e.target.value)} className="inp" />
          </Field>
          <Field label="DESTINATION *">
            <input value={form.destination} onChange={e => up('destination', e.target.value)} className="inp" />
          </Field>
          <Field label="LEAD TIME (HOURS)">
            <input type="number" value={form.standard_lead_time_hours ?? ''}
              onChange={e => up('standard_lead_time_hours', e.target.value === '' ? null : Number(e.target.value))}
              className="inp" />
          </Field>
          <Field label="NOTES">
            <textarea value={form.notes} onChange={e => up('notes', e.target.value)} className="inp" rows={2} />
          </Field>
          {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        </div>
        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>
            {route && (
              <button onClick={del} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'MENGHAPUS…' : 'HAPUS'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.route_code || !form.destination}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>
      {children}
    </label>
  )
}
