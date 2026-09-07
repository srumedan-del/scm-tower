import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import IssueAddButton from '@/components/issue/IssueAddButton'
import { IssueRow } from '@/components/issue/IssueRow'

export default async function Issues() {
  const { data } = await supabase
    .from('issue_log')
    .select('id, issue_no, issue_date, category, title, description, impact, probability, status, due_date, closed_at, mitigation_plan, pic_name')
    .order('issue_date', { ascending: false })
    .limit(100)

  const open       = data?.filter(r => r.status === 'Open').length ?? 0
  const inProgress = data?.filter(r => r.status === 'In Progress').length ?? 0
  const closed     = data?.filter(r => r.status === 'Closed').length ?? 0

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
        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">{data?.length ?? 0} TOTAL</span>
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
            {data?.map((r: any) => (
              <IssueRow key={r.id} issue={r} />
            ))}
            {!data?.length && (
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
