'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import IssueEditPanel from './IssueEditPanel'

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

const IMPACT_STYLE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-gray-100 text-gray-500',
}

const STATUS_STYLE: Record<string, string> = {
  'Open':        'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Closed':      'bg-green-100 text-green-700',
  'Cancelled':   'bg-gray-100 text-gray-500',
}

/** Hitung umur issue dalam hari dari issue_date sampai sekarang (atau closed_at jika sudah closed) */
function calcAge(issueDate: string | null, closedAt: string | null, status: string | null): number | null {
  if (!issueDate) return null
  const start = new Date(issueDate).getTime()
  const end   = (status === 'Closed' || status === 'Cancelled') && closedAt
    ? new Date(closedAt).getTime()
    : Date.now()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

function AgeBadge({ days, status }: { days: number | null; status: string | null }) {
  if (days === null) return <span className="text-gray-400">-</span>
  const isClosed = status === 'Closed' || status === 'Cancelled'
  let cls = 'bg-green-100 text-green-700'
  if (!isClosed) {
    if (days >= 14) cls = 'bg-red-100 text-red-700'
    else if (days >= 7) cls = 'bg-orange-100 text-orange-700'
    else if (days >= 3) cls = 'bg-yellow-100 text-yellow-700'
  } else {
    cls = 'bg-gray-100 text-gray-500'
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${cls}`}>
      {days}h{isClosed ? ' (selesai)' : ''}
    </span>
  )
}

export function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const impactStyle = IMPACT_STYLE[issue.impact ?? ''] ?? 'bg-gray-100 text-gray-500'
  const statusStyle = STATUS_STYLE[issue.status ?? ''] ?? 'bg-gray-100 text-gray-500'
  const age = calcAge(issue.issue_date, issue.closed_at, issue.status)

  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      <tr className="border-t border-border hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setOpen(true)}>
        <td className="px-4 py-2.5 font-mono text-xs font-bold whitespace-nowrap">{issue.issue_no ?? '-'}</td>
        <td className="px-4 py-2.5 text-xs">{issue.category ?? '-'}</td>
        <td className="px-4 py-2.5 text-xs max-w-xs truncate">{issue.title ?? '-'}</td>
        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{issue.pic_name ?? '-'}</td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${impactStyle}`}>
            {issue.impact ?? '-'}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${statusStyle}`}>
            {issue.status ?? '-'}
          </span>
        </td>
        <td className="px-4 py-2.5"><AgeBadge days={age} status={issue.status} /></td>
        <td className="px-4 py-2.5 text-xs whitespace-nowrap">{issue.due_date ?? '-'}</td>
      </tr>
      {mounted && open && createPortal(
        <IssueEditPanel
          issue={issue}
          onClose={() => setOpen(false)}
          onSaved={() => { if (typeof window !== 'undefined') window.location.reload() }}
        />,
        document.body
      )}
    </>
  )
}
