'use client'
import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Route } from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import { upsertRoute, deleteRoute, generateRouteCode } from '@/app/(app)/master-data/routes/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

type Route = {
  id: number
  route_code: string
  origin: string
  destination: string
  standard_lead_time_hours: number | null
  distance_km: number | null
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
    distance_km:              route.distance_km,
    notes:                    route.notes ?? '',
  } : {
    route_code:               '',
    dk_lk:                    '' as 'D' | 'L' | '',
    origin:                   'SRU MEDAN',
    destination:              '',
    standard_lead_time_hours: 24 as number | null,
    distance_km:              null as number | null,
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

  async function del() {
    if (!route) return
    if (!(await confirmAction({ title: 'Hapus rute?', message: `Rute ${route.route_code} akan dihapus.` }))) return
    startDeleting(async () => {
      try { await deleteRoute(route.id); onClose(); void showSuccess({ title: 'Rute dihapus' }).then(onSaved) }
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
        distance_km:              form.distance_km == null ? null : Number(form.distance_km),
        dk_lk:                    form.dk_lk as 'D' | 'L',
        notes:                    form.notes.trim().toUpperCase() || null,
      }
      try { await upsertRoute(payload, route?.id); onClose(); void showSuccess({ title: 'Rute tersimpan', message: form.destination }).then(onSaved) }
      catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title={route ? 'Edit Rute' : 'Tambah Rute'} subtitle={route ? route.route_code : 'Buat rute pengiriman baru'} icon={Route} />

        <div className={dialogBodyClass}>

          {/* DK / LK */}
          <Field label="Tipe rute (DK/LK) *">
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
          <Field label="Route code *">
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

          <Field label="Origin">
            <input value={form.origin} onChange={e => up('origin', e.target.value)} className="inp" />
          </Field>

          <Field label="Destination *">
            <input value={form.destination} onChange={e => up('destination', e.target.value)} className="inp" placeholder="Nama kota tujuan" />
          </Field>

          <Field label="Lead time (hours)">
            <input
              type="number"
              value={form.standard_lead_time_hours ?? ''}
              onChange={e => up('standard_lead_time_hours', e.target.value === '' ? null : Number(e.target.value))}
              className="inp"
            />
          </Field>

          <Field label="Jarak (KM)">
            <input
              type="number"
              min={0}
              step="0.1"
              value={form.distance_km ?? ''}
              onChange={e => up('distance_km', e.target.value === '' ? null : Number(e.target.value))}
              className="inp"
              placeholder="0"
            />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} onChange={e => up('notes', e.target.value)} className="inp" rows={2} />
          </Field>

          {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        </div>

        <div className={dialogFooterClass}>
          <div>
            {route && (
              <button onClick={del} disabled={deleting}
                className={dialogDangerClass}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button
              onClick={save}
              disabled={saving || generating || !form.dk_lk || !form.destination.trim()}
              className={dialogPrimaryClass} data-busy={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>

    </DialogShell>
  )
}
