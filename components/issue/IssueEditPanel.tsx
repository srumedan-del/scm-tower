'use client'
import { useState, useTransition } from 'react'
import { generateIssueNo, upsertIssue, deleteIssue } from '@/app/(app)/issues/actions'

type Issue = {
  id: number
  issue_no: string | null
  category: string | null
  title: string | null
  description: string | null
  impact: string | null
  probability: string | null
  status: string | null
  due_date: string | null
  issue_date: string | null
  closed_at: string | null
  mitigation_plan: string | null
  pic_name: string | null
}

const CATEGORIES = ['Shipment', 'Receiving', 'Warehouse', 'Vendor', 'System', 'Inventory', 'Outbound', 'Other']
const IMPACTS    = ['Low', 'Medium', 'High', 'Critical']
const STATUSES   = ['Open', 'In Progress', 'Closed', 'Cancelled']

export default function IssueEditPanel({ issue, onClose, onSaved }: {
  issue: Issue | null
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState(() => issue ? {
    category:        issue.category        ?? 'Other',
    title:           issue.title           ?? '',
    description:     issue.description     ?? '',
    impact:          issue.impact          ?? 'Medium',
    probability:     issue.probability     ?? 'Medium',
    status:          issue.status          ?? 'Open',
    issue_date:      issue.issue_date      ?? today,
    due_date:        issue.due_date        ?? '',
    closed_at:       issue.closed_at       ? issue.closed_at.slice(0, 10) : '',
    mitigation_plan: issue.mitigation_plan ?? '',
    pic_name:        issue.pic_name        ?? '',
  } : {
    category:        'Other',
    title:           '',
    description:     '',
    impact:          'Medium',
    probability:     'Medium',
    status:          'Open',
    issue_date:      today,
    due_date:        '',
    closed_at:       '',
    mitigation_plan: '',
    pic_name:        '',
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function del() {
    if (!issue) return
    if (!confirm(`HAPUS ISSUE ${issue.issue_no}?`)) return
    startDeleting(async () => {
      try {
        await deleteIssue(issue.id)
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const title = form.title.trim().toUpperCase()
      if (!title) { setErr('JUDUL wajib diisi'); return }
      const issueDate = form.issue_date || today

      const payload: Record<string, any> = {
        category:        form.category,
        title,
        description:     form.description.trim()     || null,
        impact:          form.impact,
        probability:     form.probability             || null,
        status:          form.status,
        issue_date:      issueDate,
        due_date:        form.due_date                || null,
        mitigation_plan: form.mitigation_plan.trim()  || null,
        pic_name:        form.pic_name.trim().toUpperCase() || null,
        closed_at:       form.status === 'Closed' && form.closed_at
                           ? new Date(form.closed_at).toISOString()
                           : null,
      }

      try {
        if (!issue) payload.issue_no = await generateIssueNo(issueDate)
        await upsertIssue(payload, issue?.id)
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold uppercase">{issue ? 'EDIT ISSUE' : 'TAMBAH ISSUE'}</h3>
            {issue?.issue_no && <p className="text-xs text-gray-400 font-mono mt-0.5">{issue.issue_no}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">

          {/* PIC */}
          <Field label="PIC (PELAPOR) *">
            <input
              value={form.pic_name}
              onChange={e => up('pic_name', e.target.value)}
              placeholder="Nama yang membuat laporan..."
              className="inp"
            />
          </Field>

          {/* Kategori & Impact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="KATEGORI *">
              <select value={form.category} onChange={e => up('category', e.target.value)} className="inp">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="IMPACT *">
              <select value={form.impact} onChange={e => up('impact', e.target.value)} className="inp">
                {IMPACTS.map(i => <option key={i}>{i}</option>)}
              </select>
            </Field>
          </div>

          {/* Judul */}
          <Field label="JUDUL *">
            <input
              value={form.title}
              onChange={e => up('title', e.target.value)}
              placeholder="Deskripsi singkat masalah..."
              className="inp"
            />
          </Field>

          {/* Deskripsi */}
          <Field label="DESKRIPSI">
            <textarea
              value={form.description}
              onChange={e => up('description', e.target.value)}
              rows={2}
              placeholder="Detail masalah, dampak, dan konteks..."
              className="inp resize-none"
            />
          </Field>

          {/* Mitigasi */}
          <Field label="RENCANA MITIGASI">
            <textarea
              value={form.mitigation_plan}
              onChange={e => up('mitigation_plan', e.target.value)}
              rows={2}
              placeholder="Tindakan yang direncanakan / sudah dilakukan..."
              className="inp resize-none"
            />
          </Field>

          {/* Status & Probability */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="STATUS *">
              <select value={form.status} onChange={e => up('status', e.target.value)} className="inp">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="PROBABILITY">
              <select value={form.probability} onChange={e => up('probability', e.target.value)} className="inp">
                <option value="">-</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </Field>
          </div>

          {/* Tanggal */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="TANGGAL ISSUE *">
              <input type="date" value={form.issue_date} onChange={e => up('issue_date', e.target.value)} className="inp" />
            </Field>
            <Field label="DUE DATE">
              <input type="date" value={form.due_date} onChange={e => up('due_date', e.target.value)} className="inp" />
            </Field>
          </div>

          {/* Closed at — hanya tampil kalau status Closed */}
          {form.status === 'Closed' && (
            <Field label="TANGGAL CLOSED">
              <input type="date" value={form.closed_at} onChange={e => up('closed_at', e.target.value)} className="inp" />
            </Field>
          )}

          {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        </div>

        <div className="flex gap-2 justify-between border-t border-border p-4 bg-gray-50 shrink-0">
          <div>
            {issue && (
              <button onClick={del} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'MENGHAPUS…' : 'HAPUS'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">BATAL</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'MENYIMPAN…' : 'SIMPAN'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#3b82f6}`}</style>
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
