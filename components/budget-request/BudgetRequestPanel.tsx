'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  upsertBudgetRequest, deleteBudgetRequest,
  getBudgetRequestById, getRealizationSummary,
  upsertApproval, updateApprovalStatus, deleteApproval,
  type BudgetRequestRow, type BudgetApprovalRow, type RealizationSummary,
} from '@/app/(app)/shipment/budget-request/actions'
import { CheckCircle2, Circle, Trash2, Plus, Copy, Check } from 'lucide-react'

function fmtRp(v: number | null | undefined) {
  if (v == null) return '—'
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}

function periodLabel(p: string) {
  const [y, m] = p.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

// Pembulatan ke atas ke kelipatan 500.000
function roundUp(v: number, step = 500_000) {
  return Math.ceil(v / step) * step
}

type Props = {
  request: BudgetRequestRow | null
  onClose: () => void
  onSaved: () => void
}

export default function BudgetRequestPanel({ request, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 7)

  const [form, setForm] = useState({
    period:                  request?.period ?? today,
    dk_amount_projected:     request?.dk_amount_projected ?? '',
    lk_amount_projected:     request?.lk_amount_projected ?? '',
    buffer_amount:           request?.buffer_amount ?? '',
    rounded_request_amount:  request?.rounded_request_amount ?? '',
    bank_name:               request?.bank_name ?? '',
    bank_account_no:         request?.bank_account_no ?? '',
    bank_account_holder:     request?.bank_account_holder ?? '',
    notes:                   request?.notes ?? '',
  })

  const [approvals,  setApprovals]  = useState<BudgetApprovalRow[]>([])
  const [realization, setRealization] = useState<RealizationSummary | null>(null)
  const [prevRealiz,  setPrevRealiz] = useState<RealizationSummary | null>(null)
  const [newApprover, setNewApprover] = useState('')
  const [copied, setCopied] = useState(false)

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Load existing approvals + realization
  useEffect(() => {
    if (request?.id) {
      getBudgetRequestById(request.id).then(d => {
        if (d) {
          setApprovals(d.approvals)
          setRealization(d.realization)
        }
      }).catch(() => {})
    }
    // Ambil realisasi bulan sebelumnya
    if (form.period) {
      const [y, m] = form.period.split('-').map(Number)
      const prev = m === 1
        ? `${y - 1}-12`
        : `${y}-${String(m - 1).padStart(2, '0')}`
      getRealizationSummary(prev).then(setPrevRealiz).catch(() => {})
      // Ambil juga realisasi bulan berjalan
      getRealizationSummary(form.period).then(setRealization).catch(() => {})
    }
  }, [request?.id])

  // Kalkulasi otomatis
  const dk   = Number(form.dk_amount_projected) || 0
  const lk   = Number(form.lk_amount_projected) || 0
  const buf  = Number(form.buffer_amount) || 0
  const total = dk + lk
  const subtotal = total + buf
  const autoRound = roundUp(subtotal)

  // Auto-isi rounded_request_amount jika belum diubah manual
  useEffect(() => {
    if (!form.rounded_request_amount || form.rounded_request_amount === '') {
      up('rounded_request_amount', autoRound || '')
    }
  }, [subtotal])

  function del() {
    if (!request) return
    if (!confirm(`Hapus pengajuan periode ${periodLabel(request.period)}?`)) return
    startDeleting(async () => {
      try { await deleteBudgetRequest(request.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  async function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.period) { setErr('Periode wajib diisi'); return }
      try {
        const savedId = await upsertBudgetRequest({
          id: request?.id,
          period: form.period,
          dk_amount_projected: dk || null,
          lk_amount_projected: lk || null,
          buffer_amount: buf || null,
          rounded_request_amount: Number(form.rounded_request_amount) || null,
          bank_name: (form.bank_name as string).trim() || null,
          bank_account_no: (form.bank_account_no as string).trim() || null,
          bank_account_holder: (form.bank_account_holder as string).trim() || null,
          notes: (form.notes as string).trim() || null,
        })
        // Simpan approvals baru
        for (const a of approvals.filter(a => !a.id)) {
          await upsertApproval({
            budget_request_id: savedId ?? request!.id,
            approver_name: a.approver_name,
            sequence_no: a.sequence_no,
            status: 'Pending',
          })
        }
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  // Generate teks dokumen pengajuan
  function generateDoc() {
    const period = periodLabel(form.period)
    const prevPeriod = (() => {
      const [y, m] = form.period.split('-').map(Number)
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
      return periodLabel(prev)
    })()

    const lines = [
      `PENGAJUAN DANA BIAYA KIRIM SCM MEDAN`,
      `Periode: ${period}`,
      ``,
      `────────────────────────────────────`,
      `PROYEKSI BIAYA KIRIM`,
      `────────────────────────────────────`,
      `Dalam Kota (DK)   : ${fmtRp(dk)}`,
      `Luar Kota (LK)    : ${fmtRp(lk)}`,
      `Total DK + LK     : ${fmtRp(total)}`,
      `Buffer Biaya SCM  : ${fmtRp(buf)}`,
      `────────────────────────────────────`,
      `SUBTOTAL PENGAJUAN: ${fmtRp(subtotal)}`,
      `PENGAJUAN FINAL   : ${fmtRp(Number(form.rounded_request_amount) || autoRound)}`,
      ``,
      `────────────────────────────────────`,
      `TRANSFER KE REKENING`,
      `────────────────────────────────────`,
      `Bank              : ${form.bank_name || '—'}`,
      `No. Rekening      : ${form.bank_account_no || '—'}`,
      `Atas Nama         : ${form.bank_account_holder || '—'}`,
      ``,
      ...(prevRealiz ? [
        `────────────────────────────────────`,
        `REALISASI BULAN SEBELUMNYA (${prevPeriod})`,
        `────────────────────────────────────`,
        `DK Realisasi      : ${fmtRp(prevRealiz.dk_total)}`,
        `LK Realisasi      : ${fmtRp(prevRealiz.lk_total)}`,
        `Total Realisasi   : ${fmtRp(prevRealiz.grand_total)}`,
        `Jumlah Shipment   : ${prevRealiz.shipment_count}`,
        ``,
      ] : []),
      ...(form.notes ? [`Catatan: ${form.notes}`, ``] : []),
      `────────────────────────────────────`,
      `APPROVAL`,
      `────────────────────────────────────`,
      ...approvals.map((a, i) => `${i + 1}. ${a.approver_name.padEnd(20)} [ ${a.status === 'Approved' ? '✓ Approved' : '  Pending '} ]${a.approved_at ? '  ' + new Date(a.approved_at).toLocaleDateString('id-ID') : ''}`),
    ]

    return lines.join('\n')
  }

  async function copyDoc() {
    await navigator.clipboard.writeText(generateDoc())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <h3 className="font-bold text-lg uppercase">
            {request ? `Edit Pengajuan — ${periodLabel(request.period)}` : 'Buat Pengajuan Dana'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">

          {/* Periode */}
          <Sec title="Periode">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bulan / Tahun *">
                <input
                  type="month" value={form.period}
                  onChange={e => up('period', e.target.value)}
                  className="inp"
                  disabled={!!request}
                />
              </Field>
              <div className="flex items-end pb-1">
                <span className="text-sm text-gray-500">
                  {form.period ? periodLabel(form.period) : ''}
                </span>
              </div>
            </div>
          </Sec>

          {/* Realisasi bulan sebelumnya */}
          {prevRealiz && prevRealiz.shipment_count > 0 && (
            <Sec title={`Realisasi Bulan Sebelumnya (referensi)`}>
              <div className="grid grid-cols-3 gap-2">
                <InfoBox label="DK Realisasi" value={fmtRp(prevRealiz.dk_total)} sub={`${prevRealiz.shipment_count} shipment`} />
                <InfoBox label="LK Realisasi" value={fmtRp(prevRealiz.lk_total)} />
                <InfoBox label="Total Realisasi" value={fmtRp(prevRealiz.grand_total)} bold />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Dari shipment_tracking Internal yang sudah terisi biaya — gunakan sebagai acuan proyeksi bulan ini.
              </div>
            </Sec>
          )}

          {/* Proyeksi biaya */}
          <Sec title="Proyeksi Biaya Bulan Ini">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Proyeksi DK — Dalam Kota (Rp)">
                <input type="number" min={0} value={form.dk_amount_projected as any}
                  onChange={e => up('dk_amount_projected', e.target.value)} className="inp" placeholder="0" />
              </Field>
              <Field label="Proyeksi LK — Luar Kota (Rp)">
                <input type="number" min={0} value={form.lk_amount_projected as any}
                  onChange={e => up('lk_amount_projected', e.target.value)} className="inp" placeholder="0" />
              </Field>
            </div>

            {/* Kalkulasi otomatis */}
            <div className="mt-3 rounded-lg border bg-gray-50 p-3 space-y-1.5 text-sm">
              <Row label="Total SRU Medan DK + LK" value={fmtRp(total)} />
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 flex-1">+ Buffer Biaya SCM (Rp)</span>
                <input
                  type="number" min={0} value={form.buffer_amount as any}
                  onChange={e => up('buffer_amount', e.target.value)}
                  className="w-40 px-2 py-1 border border-gray-300 rounded text-right text-sm font-mono"
                  placeholder="0"
                />
              </div>
              <div className="border-t pt-1.5">
                <Row label="Subtotal Pengajuan Biaya" value={fmtRp(subtotal)} bold />
              </div>
            </div>

            {/* Nilai final */}
            <div className="mt-3">
              <Field label={`Nilai Pengajuan Final (Rp) — dibulatkan ke atas, auto: ${fmtRp(autoRound)}`}>
                <input
                  type="number" min={0} value={form.rounded_request_amount as any}
                  onChange={e => up('rounded_request_amount', e.target.value)}
                  className="inp font-mono text-lg font-bold"
                  placeholder={String(autoRound)}
                />
              </Field>
            </div>

            {form.rounded_request_amount && (
              <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-200 p-3 flex items-center justify-between">
                <span className="text-xs text-indigo-600">Nilai Pengajuan Final</span>
                <span className="text-xl font-bold text-indigo-700">
                  {fmtRp(Number(form.rounded_request_amount))}
                </span>
              </div>
            )}
          </Sec>

          {/* Info rekening */}
          <Sec title="Info Rekening Bank">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Bank">
                <input value={form.bank_name as string} onChange={e => up('bank_name', e.target.value)} className="inp" placeholder="BCA / Mandiri / ..." />
              </Field>
              <Field label="Atas Nama">
                <input value={form.bank_account_holder as string} onChange={e => up('bank_account_holder', e.target.value)} className="inp" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="No. Rekening">
                <input value={form.bank_account_no as string} onChange={e => up('bank_account_no', e.target.value)} className="inp font-mono" />
              </Field>
            </div>
          </Sec>

          {/* Approval checklist */}
          <Sec title="Approval Checklist">
            <div className="space-y-2">
              {approvals.map((a, idx) => (
                <div key={a.id ?? idx} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <button
                    onClick={async () => {
                      if (!a.id) return
                      const newStatus = a.status === 'Approved' ? 'Pending' : 'Approved'
                      await updateApprovalStatus(a.id, newStatus)
                      setApprovals(prev => prev.map(x =>
                        x.id === a.id
                          ? { ...x, status: newStatus, approved_at: newStatus === 'Approved' ? new Date().toISOString() : null }
                          : x
                      ))
                    }}
                    className={`shrink-0 transition-colors ${a.status === 'Approved' ? 'text-green-600' : 'text-gray-300 hover:text-gray-400'}`}
                  >
                    {a.status === 'Approved' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <span className="text-sm flex-1">{a.approver_name}</span>
                  <span className="text-xs text-gray-400 mr-1">
                    {a.approved_at ? new Date(a.approved_at).toLocaleDateString('id-ID') : 'Pending'}
                  </span>
                  <button
                    onClick={async () => {
                      if (a.id) { await deleteApproval(a.id) }
                      setApprovals(prev => prev.filter((_, i) => i !== idx))
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {/* Tambah approver */}
            <div className="flex gap-2 mt-2">
              <input
                value={newApprover}
                onChange={e => setNewApprover(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newApprover.trim()) {
                    setApprovals(prev => [...prev, {
                      id: 0, budget_request_id: request?.id ?? 0,
                      approver_name: newApprover.trim(),
                      sequence_no: prev.length + 1,
                      status: 'Pending', approved_at: null,
                    }])
                    setNewApprover('')
                  }
                }}
                className="inp flex-1"
                placeholder="Nama approver (Enter untuk tambah)"
              />
              <button
                onClick={() => {
                  if (!newApprover.trim()) return
                  setApprovals(prev => [...prev, {
                    id: 0, budget_request_id: request?.id ?? 0,
                    approver_name: newApprover.trim(),
                    sequence_no: prev.length + 1,
                    status: 'Pending', approved_at: null,
                  }])
                  setNewApprover('')
                }}
                className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Sec>

          {/* Catatan */}
          <Field label="Catatan">
            <textarea value={form.notes as string} onChange={e => up('notes', e.target.value)} className="inp" rows={2} placeholder="Opsional" />
          </Field>

          {/* Export dokumen */}
          <Sec title="Export Dokumen Teks">
            <div className="rounded-lg bg-gray-900 text-gray-100 p-4 font-mono text-xs whitespace-pre leading-relaxed max-h-64 overflow-y-auto">
              {generateDoc()}
            </div>
            <button
              onClick={copyDoc}
              className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                copied ? 'bg-green-50 border-green-300 text-green-700' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              {copied ? <><Check className="h-4 w-4" /> Disalin!</> : <><Copy className="h-4 w-4" /> Copy Teks Dokumen</>}
            </button>
          </Sec>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 bg-gray-50 shrink-0">
          <div>
            {request && (
              <button onClick={del} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Simpan Pengajuan'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}.inp:disabled{background:#f9fafb;color:#9ca3af}`}</style>
      </div>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 border-b pb-1">{title}</div>
      {children}
    </section>
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  )
}

function InfoBox({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div className="rounded-lg bg-white border px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm ${bold ? 'font-bold text-indigo-700' : 'font-semibold text-gray-800'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
