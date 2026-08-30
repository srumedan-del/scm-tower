import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function Issues() {
  const { data } = await supabase.from('issue_log').select('*').order('issue_date', { ascending: false }).limit(50)
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">ISSUE LOG</h1>
      <div className="bg-white border border-border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">NO</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">KATEGORI</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">JUDUL</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">IMPACT</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">STATUS</th>
              <th className="px-4 py-3 text-left uppercase tracking-wide text-xs font-bold text-gray-900">DUE</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r:any) => (
              <tr key={r.id} className="border-t border-border hover:bg-blue-50">
                <td className="px-4 py-2.5">{r.issue_no}</td>
                <td className="px-4 py-2.5">{r.category}</td>
                <td className="px-4 py-2.5">{r.title}</td>
                <td className="px-4 py-2.5">{r.impact}</td>
                <td className="px-4 py-2.5">{r.status}</td>
                <td className="px-4 py-2.5">{r.due_date}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Belum ada issue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}