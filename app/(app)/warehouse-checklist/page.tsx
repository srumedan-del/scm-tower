import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function Checklist() {
  const { data } = await supabase.from('warehouse_checklist').select('*').order('checklist_date', { ascending: false }).limit(30)
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">WAREHOUSE CHECKLIST</h1>
      <div className="bg-white border border-border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">TANGGAL</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">WAREHOUSE</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">SHIFT</th>
              <th className="px-4 py-3 text-right uppercase tracking-wide text-xs font-bold text-gray-900">COMPLETION</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">ISSUE</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r:any) => (
              <tr key={r.id} className="border-t border-border hover:bg-blue-50">
                <td className="px-4 py-2.5">{r.checklist_date}</td>
                <td className="px-4 py-2.5">{r.warehouse_code}</td>
                <td className="px-4 py-2.5">{r.shift}</td>
                <td className="px-4 py-2.5 text-right">{Number(r.completion_rate ?? 0).toFixed(0)}%</td>
                <td className="px-4 py-2.5">{r.issue_notes}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">Belum ada checklist.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}