import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import IssueAddButton from '@/components/issue/IssueAddButton'
import { IssueRow } from '@/components/issue/IssueRow'

export default async function Issues() {
  const { data } = await supabase
    .from('issue_log')
    .select('id, issue_no, issue_date, category, title, description, impact, probability, status, due_date, closed_at, mitigation_plan, pic_name')
    .order('status', { ascending: true })   // Open → In Progress → Closed → Cancelled (alphabetical)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)

  // Urutan status: Open → In Progress → Cancelled → Closed
  const STATUS_ORDER: Record<string, number> = {
    'Open': 0, 'In Progress': 1, 'Cancelled': 2, 'Closed': 3,
  }

  const sorted = (data ?? []).sort((a: any, b: any) => {
    const sA = STATUS_ORDER[a.status ?? ''] ?? 99
    const sB = STATUS_ORDER[b.status ?? ''] ?? 99
    if (sA !== sB) return sA - sB
    // Due date ascending (null paling akhir)
    const dA = a.due_date ?? '9999-12-31'
    const dB = b.due_date ?? '9999-12-31'
    return dA.localeCompare(dB)
  })

  const open       = sorted.filter((r: any) => r.status === 'Open').length
  const inProgress = sorted.filter((r: any) => r.status === 'In Progress').length
  const closed     = sorted.filter((r: any) => r.status === 'Closed').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">ISSUE LOG</h1>
        <IssueAddButton />
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{open} OPEN</span>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">{inProgress} IN PROGRESS</span>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{closed} CLOSED</span>
        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">{sorted.length} TOTAL</span>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900 whitespace-nowrap">NO</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">KATEGORI</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">JUDUL</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">PIC</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">IMPACT</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">STATUS</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900 whitespace-nowrap">UMUR</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">DUE</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r: any) => (
              <IssueRow key={r.id} issue={r} />
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">Belum ada issue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
