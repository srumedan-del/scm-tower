'use client'
import { useState, useTransition, useEffect } from 'react'
import { upsertRoute, deleteRoute, generateRouteCode } from '@/app/(app)/master-data/routes/actions'

type Route = {
  id: number
  route_code: string
  origin: string
  destination: string
  standard_lead_time_hours: number | null
  dk_lk: 'D' | 'L' | null
  notes: string | null
}

export default function RouteEditPanel({ route, onClose, onSaved }: {
  route: Route | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => route ? {
    route_code:               route.route_code ?? '',
    dk_lk:                    route.dk_lk ?? '' as 'D' | 'L' | '',
    origin:                   route.origin ?? '',
    destination:              route.destination ?? '',
    standard_lead_time_hours: route.standard_lead_time_hours,
    notes:                    route.notes ?? '',
  } : {
    route_code:               '',
    dk_lk:                    '' as 'D' | 'L' | '',
    origin:                   'SRU MEDAN',
    destination:              '',
    standard_lead_time_hours: 24 as number | null,
    notes:                    '',
  })

  const [generating,  setGenerating]  = useState(false)
  const [saving,      startSaving]    = useTransition()
  const [deleting,    startDeleting]  = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  // Saat DK/LK dipilih — generate route code untuk form baru, update untuk edit
  async function handleDkLkChange(val: 'D' | 'L' | '') {
    up('dk_lk', val)
    if (!val) return
    setGenerating(true)
    try {
      const code = await generateRouteCode(val)
      up('route_code', code)
    } catch {}
    finally { setGenerating(false) }
  }

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
      if (!form.dk_lk)          { setErr('DK/LK wajib dipilih'); return }
      if (!form.route_code)      { setErr('ROUTE CODE wajib diisi'); return }
      if (!form.destination.trim()) { setErr('DESTINATION wajib diisi'); return }

      const dest = form.destination.trim().toUpperCase()
      const payload = {
        route_code:               form.route_code.trim().toUpperCase(),
        origin:                   form.origin.trim().toUpperCase() || 'SRU MEDAN',
        destination:              dest,
        city:                     dest,   // kompatibilitas kolom DB
        standard_lead_time_hours: form.standard_lead_time_hours == null
                                    ? null : Number(form.standard_lead_time_hours),
        dk_lk:                    form.dk_lk as 'D' | 'L',
        notes:                    form.notes.trim().toUpperCase() || null,
      }
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

          {/* DK / LK */}
          <Field label="TIPE RUTE (DK/LK) *">
            <div className="grid grid-cols-2 gap-2">
              {(['D', 'L'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleDkLkChange(v)}
                  className={`py-2.5 rounded-lg border text-sm font-bold transition-colors ${
                    form.dk_lk === v
                      ? v === 'D'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {v === 'D' ? '🏙 D — DALAM KOTA' : '🛣 L — LUAR KOTA'}
                </button>
              ))}
            </div>
            {!route && !form.dk_lk && (
              <p className="text-xs text-gray-400 mt-1">Pilih tipe rute untuk generate Route Code otomatis</p>
            )}
          </Field>

          {/* Route Code — auto-generated, read-only saat tambah baru; update saat ganti DK/LK */}
          <Field label="ROUTE CODE *">
            <div className="relative">
              <input
                value={generating ? 'Generating...' : form.route_code}
                readOnly
                className="inp bg-gray-50 text-gray-600 font-mono cursor-not-allowed"
                placeholder="Otomatis setelah pilih DK/LK"
              />
              {generating && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">⏳</div>
              )}
            </div>
          </Field>

          <Field label="ORIGIN">
            <input value={form.origin} onChange={e => up('origin', e.target.value)} className="inp" />
          </Field>

          <Field label="DESTINATION *">
            <input value={form.destination} onChange={e => up('destination', e.target.value)} className="inp" placeholder="Nama kota tujuan" />
          </Field>

          <Field label="LEAD TIME (HOURS)">
            <input
              type="number"
              value={form.standard_lead_time_hours ?? ''}
              onChange={e => up('standard_lead_time_hours', e.target.value === '' ? null : Number(e.target.value))}
              className="inp"
            />
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
            <button
              onClick={save}
              disabled={saving || generating || !form.dk_lk || !form.destination.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'MENYIMPAN…' : 'SIMPAN'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#3b82f6}.inp:disabled,.inp[readonly]{background:#f9fafb;color:#6b7280}`}</style>
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
