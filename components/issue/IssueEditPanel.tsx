'use client'
import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { AlertTriangle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { generateIssueNo, upsertIssue, deleteIssue } from '@/app/(app)/issues/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

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

  async function del() {
    if (!issue) return
    if (!(await confirmAction({ title: 'Hapus issue?', message: `Issue ${issue.issue_no} akan dihapus.` }))) return
    startDeleting(async () => {
      try {
        await deleteIssue(issue.id)
        onClose(); void showSuccess({ title: 'Issue dihapus' }).then(onSaved)
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
        onClose(); void showSuccess({ title: 'Issue tersimpan', message: form.title }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title={issue ? 'Edit Issue' : 'Tambah Issue'} subtitle={issue?.issue_no ?? 'Catat kendala operasional'} icon={AlertTriangle} />

        <div className={dialogBodyClass}>

          {/* PIC */}
          <Field label="PIC (pelapor) *">
            <input
              value={form.pic_name}
              onChange={e => up('pic_name', e.target.value)}
              placeholder="Nama yang membuat laporan..."
              className="inp"
            />
          </Field>

          {/* Kategori & Impact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori *">
              <select value={form.category} onChange={e => up('category', e.target.value)} className="inp">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Impact *">
              <select value={form.impact} onChange={e => up('impact', e.target.value)} className="inp">
                {IMPACTS.map(i => <option key={i}>{i}</option>)}
              </select>
            </Field>
          </div>

          {/* Judul */}
          <Field label="Judul *">
            <input
              value={form.title}
              onChange={e => up('title', e.target.value)}
              placeholder="Deskripsi singkat masalah..."
              className="inp"
            />
          </Field>

          {/* Deskripsi */}
          <Field label="Deskripsi">
            <textarea
              value={form.description}
              onChange={e => up('description', e.target.value)}
              rows={2}
              placeholder="Detail masalah, dampak, dan konteks..."
              className="inp resize-none"
            />
          </Field>

          {/* Mitigasi */}
          <Field label="Rencana mitigasi">
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
            <Field label="Status *">
              <select value={form.status} onChange={e => up('status', e.target.value)} className="inp">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Probability">
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
            <Field label="Tanggal issue *">
              <input type="date" value={form.issue_date} onChange={e => up('issue_date', e.target.value)} className="inp" />
            </Field>
            <Field label="Due date">
              <input type="date" value={form.due_date} onChange={e => up('due_date', e.target.value)} className="inp" />
            </Field>
          </div>

          {/* Closed at — hanya tampil kalau status Closed */}
          {form.status === 'Closed' && (
            <Field label="Tanggal closed">
              <input type="date" value={form.closed_at} onChange={e => up('closed_at', e.target.value)} className="inp" />
            </Field>
          )}

          {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        </div>

        <div className={dialogFooterClass}>
          <div>
            {issue && (
              <button onClick={del} disabled={deleting} className={dialogDangerClass}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className={dialogPrimaryClass} data-busy={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>

    </DialogShell>
  )
}
